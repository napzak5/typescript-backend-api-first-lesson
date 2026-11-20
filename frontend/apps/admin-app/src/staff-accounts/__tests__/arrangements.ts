import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the accounts of the staff arrange in the
 * database, and read back from it. In the seed data of the salon in Tokyo,
 * Hiroshi Tanaka (STF001, the account stylist1), Mika Suzuki (STF002,
 * stylist2), Akiko Mori (STF900, the owner) and Kenji Sato (STF901, the
 * manager) have accounts; Yui Watanabe (STF004) has none.
 */

/** Yui Watanabe, who has no account, and the address the ledger has for her */
export const WATANABE = { code: 'STF004', email: 'yui.watanabe@beautysalon.jp' }

type InvitationArranged = {
  role: string
  /** The address it was mailed to: that of the ledger, unless the ledger changed since */
  email?: string
  /** How long ago it was mailed, as an interval of PostgreSQL */
  mailedAgo: string
  /** How long after it was mailed it expires */
  lastsFor?: string
}

/** Lets a member have been invited, as the owner of the salon did earlier. */
export const arrangeInvitation = (
  staffCode: string,
  { role, email, mailedAgo, lastsFor = '7 days' }: InvitationArranged,
): Promise<unknown> =>
  testApi().query(
    `insert into staff_invitations ("staffId", email, role, "tokenHash", "createdAt", "expiresAt")
     select id, coalesce($3, email), $2::salon_role, 'arranged', now() - $4::interval,
            now() - $4::interval + $5::interval
     from staff where "staffCode" = $1`,
    [staffCode, role, email ?? null, mailedAgo, lastsFor],
  )

const invitationSchema = z.array(
  z.object({ email: z.string(), role: z.string(), hoursLasting: z.number() }),
)

/** The invitation of a member as the database of the API keeps it, with how many hours it lasts; none when there is none. */
export const storedInvitationOf = async (staffCode: string) =>
  invitationSchema.parse(
    await testApi().query(
      `select staff_invitations.email, role::text as role,
              round(extract(epoch from "expiresAt" - staff_invitations."createdAt") / 3600)::int
                as "hoursLasting"
       from staff_invitations join staff on staff.id = staff_invitations."staffId"
       where staff."staffCode" = $1`,
      [staffCode],
    ),
  )

/** Lets the member have taken the invitation in another browser meanwhile: an account is made and linked to them. */
export const acceptedMeanwhile = (staffCode: string): Promise<unknown> =>
  testApi().query(
    `with member as (select id, email from staff where "staffCode" = $1),
          account as (
            insert into users (email, "passwordHash", role, status, "emailVerified", "staffId")
            select email, 'arranged', 'staff', 'active', true, id from member
            returning id, "staffId"
          ),
          linked as (
            update staff set "userId" = account.id from account where staff.id = account."staffId"
          )
     delete from staff_invitations where "staffId" = (select id from member)`,
    [staffCode],
  )

type AccountState = {
  status: string
  twoFactorStatus: string
  /** When the account last signed in, as a moment of PostgreSQL; never when null */
  lastLoginAt: string | null
}

/** Lets the account of the address be in a state: one that set up two factors has a secret and backup codes. */
export const arrangeAccount = (
  email: string,
  { status, twoFactorStatus, lastLoginAt }: AccountState,
): Promise<unknown> =>
  testApi().query(
    `update users set status = $2::account_status, "twoFactorStatus" = $3::two_factor_status,
                      "twoFactorSecret" = case when $3 = 'disabled' then null else 'arranged' end,
                      "backupCodes" = case when $3 = 'disabled' then null else '[]'::jsonb end,
                      "lastLoginAt" = $4::timestamptz
     where email = $1`,
    [email, status, twoFactorStatus, lastLoginAt],
  )

const accountSchema = z.array(
  z.object({ role: z.string(), linked: z.boolean() }),
)

/** The role of the account of the address, and whether it is linked to a member both ways. */
export const storedAccountOf = async (email: string) =>
  accountSchema.parse(
    await testApi().query(
      `select users.role::text as role,
              users."staffId" is not null and staff."userId" = users.id as linked
       from users left join staff on staff.id = users."staffId"
       where users.email = $1`,
      [email],
    ),
  )

/** Lets another owner have unlinked the account of a member meanwhile. */
export const unlinkedMeanwhile = (staffCode: string): Promise<unknown> =>
  testApi().query(
    `with member as (
       update staff set "userId" = null where "staffCode" = $1 returning id
     )
     update users set "staffId" = null where "staffId" = (select id from member)`,
    [staffCode],
  )
