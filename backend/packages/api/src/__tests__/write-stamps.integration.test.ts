import { randomUUID } from 'node:crypto'
import {
  salons,
  serviceCategories,
  services,
  staff,
  staffInvitations,
} from '@beauty-salon-backend/database'
import {
  categoryIdSchema,
  type DomainError,
  salonIdSchema,
  serviceIdSchema,
  sessionIdSchema,
  staffIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import {
  SalonRepository,
  ServiceCategoryRepository,
  ServiceRepository,
  StaffAccountRepository,
  StaffInvitationRepository,
  StaffProfileRepository,
  StaffRepository,
  UserRepository,
} from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertSalon,
  insertStaff,
  insertUser,
  minutesFromNow,
  sha256,
} from './_shared/auth-helpers'
import { getTestDb, getTestDbClient } from './_shared/test-helpers'
import {
  backupCodeHashes,
  SECRET,
  sealSecret,
  twoFactorUser,
} from './_shared/two-factor-helpers'

/**
 * The time a write is stamped with when it had to wait for another write
 * of the same row. `now()` is the moment the transaction of the write
 * began, which is before it waited: by it, the write that came second
 * would be recorded as the earlier of the two. Every write below stamps
 * with the clock of the database at the moment it gets to the row
 * (`CLOCK`), so it is recorded after the write it waited for.
 *
 * Each write is a call of its repository, alone: in a request, a write
 * that follows another write of the same row never waits itself.
 */

/** A row by its table, as the database names it, and its ID. */
type Row = {
  table: 'users' | 'staff' | 'salons' | 'services' | 'service_categories'
  id: string
}

type Write = {
  /** The row another writer is rewriting when the write arrives. */
  held: Row
  /** The call of the repository; what it resolves to tells that it wrote. */
  write: () => Promise<Result<unknown, DomainError>>
  /** What the call resolves to when it wrote. */
  wrote: unknown
  /** The rows the write stamps. */
  stamped: Row[]
}

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

const NEW_HASH = 'a-password-hash-of-the-test'

describe('The time of a write that waited for another write of its row', () => {
  let db: ReturnType<typeof getTestDb>

  beforeEach(() => {
    db = getTestDb()
  })

  const user = (id: string) => userIdSchema.parse(id)
  const salon = (id: string) => salonIdSchema.parse(id)
  const member = (id: string) => staffIdSchema.parse(id)

  /** Waits until a statement of another connection waits for a lock. */
  const untilSomeoneWaits = async (
    client: ReturnType<typeof getTestDbClient>,
  ): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const [activity] = await client<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
      `
      if ((activity?.waiting ?? 0) > 0) {
        return
      }
      await pause(10)
    }
    throw new Error('Nobody waited for a lock')
  }

  /**
   * Rewrites the row as another writer does and keeps that write open,
   * starts the write meanwhile, and commits once the write waits. Tells
   * what the write resolved to and the clock of the database just before
   * the other writer committed, in milliseconds.
   */
  const whileRewritten = async (
    { table, id }: Row,
    write: Write['write'],
  ): Promise<{ result: Result<unknown, DomainError>; letGoAt: number }> => {
    const client = getTestDbClient()
    const rewritten = Promise.withResolvers<void>()
    const mayCommit = Promise.withResolvers<void>()
    const other = client.begin(async (tx) => {
      // Every column keeps its value: the row is a new version all the same.
      await tx`UPDATE ${tx(table)} SET "updatedAt" = "updatedAt" WHERE id = ${id}`
      rewritten.resolve()
      await mayCommit.promise
    })
    await rewritten.promise

    const pending = write()
    await untilSomeoneWaits(client)
    const [moment] = await client<{ ms: number }[]>`
      SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms
    `
    mayCommit.resolve()
    await other
    if (moment === undefined) {
      throw new Error('The database told no time')
    }
    return { result: await pending, letGoAt: moment.ms }
  }

  /** When a row was last written, to the microsecond, in milliseconds. */
  const stampOf = async ({ table, id }: Row): Promise<number> => {
    const client = getTestDbClient()
    const [row] = await client<{ ms: number }[]>`
      SELECT (extract(epoch FROM "updatedAt") * 1000)::float8 AS ms
      FROM ${client(table)} WHERE id = ${id}
    `
    if (row === undefined) {
      throw new Error(`No row ${id} in ${table}`)
    }
    return row.ms
  }

  const mailedToken = () => ({
    tokenHash: sha256(`token-${randomUUID()}`),
    expiresAt: minutesFromNow(60),
  })

  /** A write of the account itself: the account is the row that is held and stamped. */
  const ofAccount = (
    id: string,
    write: Write['write'],
    wrote: unknown,
  ): Write => {
    const account: Row = { table: 'users', id }
    return { held: account, write, wrote, stamped: [account] }
  }

  const insertService = async (salonId: string): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId,
        name: 'Cut and blow-dry',
        duration: 60,
        price: 6600,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
      })
      .returning({ id: services.id })
    if (service === undefined) {
      throw new Error('No service was inserted')
    }
    return service.id
  }

  const insertCategory = async (salonId: string): Promise<string> => {
    const [category] = await db
      .insert(serviceCategories)
      .values({ salonId, name: 'Cut', category: 'cut' })
      .returning({ id: serviceCategories.id })
    if (category === undefined) {
      throw new Error('No category was inserted')
    }
    return category.id
  }

  /** A staff member who holds an invitation for `email`; the hash of its token. */
  const invited = async (
    email: string,
  ): Promise<{ staffId: string; tokenHash: string }> => {
    const staffId = await insertStaff(db, await insertSalon(db), { email })
    const tokenHash = sha256(`token-${randomUUID()}`)
    await db.insert(staffInvitations).values({
      staffId,
      email,
      role: 'manager',
      tokenHash,
      expiresAt: minutesFromNow(60),
    })
    return { staffId, tokenHash }
  }

  /** A staff member of a salon with the account that is linked to them. */
  const linked = async (): Promise<{
    salonId: string
    staffId: string
    userId: string
  }> => {
    const salonId = await insertSalon(db)
    const staffId = await insertStaff(db, salonId)
    const account = await insertUser(db, { role: 'staff', staffId })
    await db
      .update(staff)
      .set({ userId: account.id })
      .where(eq(staff.id, staffId))
    return { salonId, staffId, userId: account.id }
  }

  const writes: [string, () => Promise<Write>][] = [
    [
      'a failed login',
      async () => {
        const { id } = await insertUser(db)
        return ofAccount(
          id,
          () =>
            new UserRepository(db).recordFailedLogin(id, {
              threshold: 5,
              lockedUntil: minutesFromNow(15),
            }),
          null,
        )
      },
    ],
    [
      'a login',
      async () => {
        const { id } = await insertUser(db)
        return ofAccount(
          id,
          () =>
            new UserRepository(db).recordSuccessfulLogin(id, {
              at: minutesFromNow(0),
              ipAddress: null,
              passwordHash: null,
            }),
          expect.objectContaining({ id, failedLoginAttempts: 0 }),
        )
      },
    ],
    [
      'a registration that is made again',
      async () => {
        const { id } = await insertUser(db, {
          status: 'unverified',
          emailVerified: false,
        })
        return ofAccount(
          id,
          () =>
            new UserRepository(db).renewRegistration(id, {
              passwordHash: NEW_HASH,
              emailVerification: mailedToken(),
            }),
          true,
        )
      },
    ],
    [
      'the token of an email verification',
      async () => {
        const { id } = await insertUser(db, {
          status: 'unverified',
          emailVerified: false,
        })
        return ofAccount(
          id,
          () =>
            new UserRepository(db).issueEmailVerification(id, mailedToken()),
          true,
        )
      },
    ],
    [
      'the confirmation of an email address',
      async () => {
        const token = mailedToken()
        const { id } = await insertUser(db, {
          status: 'unverified',
          emailVerified: false,
          emailVerificationTokenHash: token.tokenHash,
          emailVerificationExpiry: token.expiresAt,
        })
        return ofAccount(
          id,
          () =>
            new UserRepository(db).confirmEmail(
              token.tokenHash,
              minutesFromNow(0),
            ),
          expect.objectContaining({ id, emailVerified: true }),
        )
      },
    ],
    [
      'the token of a password reset',
      async () => {
        const { id } = await insertUser(db)
        return ofAccount(
          id,
          () => new UserRepository(db).issuePasswordReset(id, mailedToken()),
          true,
        )
      },
    ],
    [
      'a password reset',
      async () => {
        const token = mailedToken()
        const { id } = await insertUser(db, {
          passwordResetTokenHash: token.tokenHash,
          passwordResetExpiry: token.expiresAt,
        })
        return ofAccount(
          id,
          () =>
            new UserRepository(db).resetPassword(token.tokenHash, {
              passwordHash: NEW_HASH,
              at: minutesFromNow(0),
            }),
          expect.objectContaining({ id, passwordHash: NEW_HASH }),
        )
      },
    ],
    [
      'a password change',
      async () => {
        const { id } = await insertUser(db)
        return ofAccount(
          id,
          () =>
            new UserRepository(db).changePassword(user(id), {
              passwordHash: NEW_HASH,
              at: minutesFromNow(0),
              keepSessionId: sessionIdSchema.parse(randomUUID()),
            }),
          true,
        )
      },
    ],
    [
      'the start of the set-up of two-factor authentication',
      async () => {
        const { id } = await insertUser(db)
        const backupCodes = await backupCodeHashes()
        return ofAccount(
          id,
          () =>
            new UserRepository(db).startTwoFactorSetup(user(id), {
              sealedSecret: sealSecret(SECRET),
              backupCodeHashes: backupCodes,
            }),
          true,
        )
      },
    ],
    [
      'two-factor authentication turned on',
      async () => {
        const sealedSecret = sealSecret(SECRET)
        const { id } = await insertUser(
          db,
          await twoFactorUser('pending', { twoFactorSecret: sealedSecret }),
        )
        return ofAccount(
          id,
          () => new UserRepository(db).enableTwoFactor(user(id), sealedSecret),
          true,
        )
      },
    ],
    [
      'an account unlocked by an administrator',
      async () => {
        const { id } = await insertUser(db, {
          status: 'locked',
          failedLoginAttempts: 5,
          lockedUntil: minutesFromNow(15),
        })
        return ofAccount(
          id,
          () => new UserRepository(db).unlock(user(id), minutesFromNow(0)),
          expect.objectContaining({ id, status: 'active' }),
        )
      },
    ],
    [
      'two-factor authentication turned off',
      async () => {
        const { id } = await insertUser(db, await twoFactorUser('enabled'))
        return ofAccount(
          id,
          () => new UserRepository(db).disableTwoFactor(user(id)),
          true,
        )
      },
    ],
    [
      'new backup codes',
      async () => {
        const { id } = await insertUser(db, await twoFactorUser('enabled'))
        const backupCodes = await backupCodeHashes()
        return ofAccount(
          id,
          () =>
            new UserRepository(db).replaceBackupCodes(user(id), backupCodes),
          true,
        )
      },
    ],
    [
      'a change of a salon',
      async () => {
        const id = await insertSalon(db)
        const row: Row = { table: 'salons', id }
        return {
          held: row,
          write: () =>
            new SalonRepository(db).update(
              salon(id),
              { name: 'Hair Studio Omotesando' },
              { type: 'keep' },
            ),
          wrote: expect.objectContaining({
            salon: expect.objectContaining({ name: 'Hair Studio Omotesando' }),
          }),
          stamped: [row],
        }
      },
    ],
    [
      'a change of a service category',
      async () => {
        const salonId = await insertSalon(db)
        const id = await insertCategory(salonId)
        const row: Row = { table: 'service_categories', id }
        return {
          held: row,
          write: () =>
            new ServiceCategoryRepository(db).update(
              salon(salonId),
              categoryIdSchema.parse(id),
              { name: 'Cut and style' },
            ),
          wrote: expect.objectContaining({ type: 'updated' }),
          stamped: [row],
        }
      },
    ],
    [
      'a change of a service',
      async () => {
        const salonId = await insertSalon(db)
        const id = await insertService(salonId)
        const row: Row = { table: 'services', id }
        return {
          held: row,
          write: () =>
            new ServiceRepository(db).update(
              salon(salonId),
              serviceIdSchema.parse(id),
              { name: 'Cut' },
              { type: 'keep' },
            ),
          wrote: expect.objectContaining({ type: 'updated' }),
          stamped: [row],
        }
      },
    ],
    [
      'a change of a staff member',
      async () => {
        const salonId = await insertSalon(db)
        const id = await insertStaff(db, salonId)
        const row: Row = { table: 'staff', id }
        return {
          held: row,
          write: () =>
            new StaffRepository(db).update(salon(salonId), member(id), {
              displayName: 'Hana',
            }),
          wrote: expect.objectContaining({ id, displayName: 'Hana' }),
          stamped: [row],
        }
      },
    ],
    [
      'a change a staff member makes to their own profile',
      async () => {
        const id = await insertStaff(db, await insertSalon(db))
        const row: Row = { table: 'staff', id }
        return {
          held: row,
          write: () =>
            new StaffProfileRepository(db).update(member(id), {
              bio: 'Colour and care',
            }),
          wrote: expect.objectContaining({ id, bio: 'Colour and care' }),
          stamped: [row],
        }
      },
    ],
    [
      'a change of the role of the account of a staff member',
      async () => {
        const { salonId, staffId, userId } = await linked()
        return {
          held: { table: 'staff', id: staffId },
          write: () =>
            new StaffAccountRepository(db).update(
              salon(salonId),
              member(staffId),
              { role: 'manager' },
            ),
          wrote: expect.objectContaining({ type: 'updated' }),
          stamped: [{ table: 'users', id: userId }],
        }
      },
    ],
    [
      'the account of a staff member unlinked',
      async () => {
        const { salonId, staffId, userId } = await linked()
        return {
          held: { table: 'staff', id: staffId },
          write: () =>
            new StaffAccountRepository(db).unlink(
              salon(salonId),
              member(staffId),
            ),
          wrote: { type: 'unlinked' },
          stamped: [
            { table: 'users', id: userId },
            { table: 'staff', id: staffId },
          ],
        }
      },
    ],
    [
      'an invitation accepted over an account that never confirmed its address',
      async () => {
        const email = `invited-${randomUUID()}@example.com`
        const { id } = await insertUser(db, {
          email,
          status: 'unverified',
          emailVerified: false,
        })
        const { staffId, tokenHash } = await invited(email)
        return {
          held: { table: 'staff', id: staffId },
          write: () =>
            new StaffInvitationRepository(db).accept(tokenHash, {
              passwordHash: NEW_HASH,
              at: minutesFromNow(0),
            }),
          wrote: { type: 'accepted' },
          stamped: [
            { table: 'users', id },
            { table: 'staff', id: staffId },
          ],
        }
      },
    ],
    [
      'an invitation joined by an account that leaves a staff member of a deleted salon',
      async () => {
        const email = `joining-${randomUUID()}@example.com`
        const leftSalonId = await insertSalon(db)
        const leftStaffId = await insertStaff(db, leftSalonId)
        const { id } = await insertUser(db, {
          email,
          role: 'staff',
          staffId: leftStaffId,
        })
        await db
          .update(staff)
          .set({ userId: id })
          .where(eq(staff.id, leftStaffId))
        await db
          .update(salons)
          .set({ deletedAt: sql`now()` })
          .where(eq(salons.id, leftSalonId))
        const { staffId, tokenHash } = await invited(email)
        return {
          held: { table: 'users', id },
          write: () =>
            new StaffInvitationRepository(db).join(
              tokenHash,
              user(id),
              minutesFromNow(0),
            ),
          wrote: { type: 'joined' },
          stamped: [
            { table: 'staff', id: leftStaffId },
            { table: 'users', id },
            { table: 'staff', id: staffId },
          ],
        }
      },
    ],
  ]

  it.each(writes)(
    'stamps %s with the moment it is let through, not the moment it arrived',
    async (_name, prepared) => {
      const { held, write, wrote, stamped } = await prepared()

      const { result, letGoAt } = await whileRewritten(held, write)

      expect(result).toEqual({ type: 'success', data: wrote })
      for (const row of stamped) {
        expect(await stampOf(row), `updatedAt of ${row.table}`).toBeGreaterThan(
          letGoAt,
        )
      }
    },
  )
})
