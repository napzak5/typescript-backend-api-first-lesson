import { randomUUID } from 'node:crypto'
import {
  sessions,
  staff,
  staffInvitations,
  users,
} from '@beauty-salon-backend/database'
import {
  type DomainError,
  type Mail,
  salonIdSchema,
  staffIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import {
  StaffAccountRepository,
  StaffInvitationRepository,
} from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { asc, eq, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AUTH,
  insertCustomer,
  insertMember,
  insertSalon,
  insertSession,
  insertUser,
  loginBody,
  minutesFromNow,
  PASSWORD,
  sha256,
  signedInUser,
  signIn,
  signInAsAdmin,
  type TestUser,
} from '../../../__tests__/_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  PUBLIC_APP_URL,
  request,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

const SALONS = '/api/v1/salons'
const VERIFY = `${AUTH}/staff-invitation/verify`
const ACCEPT = `${AUTH}/staff-invitation/accept`
const JOIN = `${AUTH}/staff-invitation/join`
const LOGIN = `${AUTH}/login`

/** Where a staff member of a salon is in the ledger. */
const staffOf = (salonId: string, staffId: string): string =>
  `${SALONS}/${salonId}/staff/${staffId}`

/** Where the account of a staff member of a salon is. */
const accountOf = (salonId: string, staffId: string): string =>
  `${staffOf(salonId, staffId)}/account`

/** Where the invitation of a staff member of a salon is. */
const invitationOf = (salonId: string, staffId: string): string =>
  `${staffOf(salonId, staffId)}/invitation`

/** A UUID that neither a salon nor a staff member has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The address of the staff member under test, in the ledger and of the account. */
const MEMBER = 'member@example.com'

/** The address of a staff member who is invited and has an account that joins. */
const JOINER = 'joiner@example.com'

/** A password that is long enough and on no blocklist. */
const NEW_PASSWORD = 'violet tram under the bridge'

const SUBJECT = 'スタッフアカウントへの招待'
const LINK = `${PUBLIC_APP_URL}/accept-staff-invitation#token=`

const WEEK_SECONDS = 7 * 24 * 60 * 60

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const alreadyExists = { status: 409, code: '3002', type: 'already-exists' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const OWN_ROLE = 'You cannot change the role of your own account'
const OWN_ACCOUNT = 'You cannot unlink your own account'
const BELONGS = 'Your account already belongs to a staff member'
const OTHER_ADDRESS = 'The invitation was sent to another address'

type Role = 'owner' | 'manager' | 'staff'

const ROLES: Role[] = ['owner', 'manager', 'staff']

/** Exactly the properties of StaffAccountResponse. */
const ACCOUNT_PROPERTIES = [
  'createdAt',
  'email',
  'id',
  'lastLoginAt',
  'role',
  'status',
  'twoFactorStatus',
  'updatedAt',
]

type NewStaff = typeof staff.$inferInsert
type NewUser = typeof users.$inferInsert

const escapeForRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The tokens in the links of a mail that lead to the page of an invitation. */
const tokensIn = ({ text }: Mail): string[] =>
  [
    ...text.matchAll(
      new RegExp(`${escapeForRegExp(LINK)}([A-Za-z0-9_-]*)`, 'g'),
    ),
  ].map(([, token]) => token ?? '')

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
  ['a UUID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
]

/**
 * A response in a few words: its status and, for a validation problem, the
 * broken rules, or else what the problem says.
 */
const outcomeOf = (response: Response): string => {
  if (response.status === 400 && response.body.code === '2001') {
    return `400 ${brokenRules(response).join(',')}`
  }
  return response.status === 404 || response.status === 409
    ? `${response.status} ${response.body.detail}`
    : String(response.status)
}

/** The status and the code of a problem. */
const statusAndCode = (response: Response): string =>
  `${response.status} ${response.body.code}`

/** An answer without a body. */
const expectNoContent = (response: Response): void => {
  expect(response.status).toBe(204)
  expect(response.text).toBe('')
  expect(response.headers['content-type']).toBeUndefined()
  expect(response.headers['location']).toBeUndefined()
}

/** A rejected token: the one answer for an invitation that cannot be used. */
const expectTokenRefused = (response: Response): void => {
  expectProblem(response, badRequest)
  expect(response.body.detail).toBe('Invalid staff invitation')
  expect(response.body.errors).toEqual([
    {
      field: 'token',
      rule: 'invalid_token',
      message: 'The token is invalid or has expired',
      value: null,
      constraint: null,
    },
  ])
  expect(response.headers['cache-control']).toBe('no-store')
}

/** A refusal that tells of a rule and names nothing that was sent. */
const expectNotAllowed = (response: Response, detail: string): void => {
  expectProblem(response, notAllowed)
  expect(response.body.detail).toBe(detail)
}

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('Staff account API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let mails: Mail[]
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of the staff member under test. */
  let salonId: string
  /** The staff member under test: active, with the address `MEMBER` and the account below. */
  let staffId: string
  /** The account of the staff member under test: a staff account with `PASSWORD`. */
  let account: TestUser

  /** Inserts a staff member as a row and returns its ID. */
  const insertStaffRow = async (
    salon: string = salonId,
    overrides: Partial<NewStaff> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(staff)
      .values({
        salonId: salon,
        firstName: 'Hanako',
        lastName: 'Yamada',
        displayName: 'Hanako',
        email: `staff-${randomUUID()}@example.com`,
        phoneNumber: '090-1234-5678',
        specialties: [],
        certifications: [],
        ...overrides,
      })
      .returning({ id: staff.id })
    if (row === undefined) {
      throw new Error('No staff member was inserted')
    }
    return row.id
  }

  /**
   * Gives a staff member an account as an accepted invitation does: the
   * user names the staff member, and the ledger names the user.
   */
  const link = async (
    member: string,
    overrides: Partial<NewUser> = {},
  ): Promise<TestUser> => {
    const user = await insertUser(db, {
      role: 'staff',
      staffId: member,
      ...overrides,
    })
    await db.update(staff).set({ userId: user.id }).where(eq(staff.id, member))
    return user
  }

  beforeEach(async () => {
    mails = []
    app = createTestApp({ mails })
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
    staffId = await insertStaffRow(salonId, { email: MEMBER })
    account = await link(staffId, { email: MEMBER })
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const get = (
    as: string | null = asAdmin,
    id: string = staffId,
    salon: string = salonId,
  ) => authorized(request(app).get(accountOf(salon, id)), as)

  const patch = (
    body: unknown,
    as: string | null = asAdmin,
    id: string = staffId,
    salon: string = salonId,
  ) =>
    authorized(request(app).patch(accountOf(salon, id)), as)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body))

  const remove = (
    as: string | null = asAdmin,
    id: string = staffId,
    salon: string = salonId,
  ) => authorized(request(app).delete(accountOf(salon, id)), as)

  /** Asks for the staff ledger of a salon: 200 for whoever keeps it. */
  const ledger = (as: string, salon: string = salonId) =>
    request(app).get(`${SALONS}/${salon}/staff`).set('Authorization', as)

  const verify = (token: string) => request(app).post(VERIFY).send({ token })

  const accept = (token: string, password: string = NEW_PASSWORD) =>
    request(app).post(ACCEPT).send({ token, password })

  const join = (token: string, as: string | null) =>
    authorized(request(app).post(JOIN), as)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ token }))

  const login = (email: string, password: string = PASSWORD) =>
    request(app).post(LOGIN).send(loginBody(email, { password }))

  /** The stored row of a user. */
  const userRow = async (id: string) => {
    const [row] = await db.select().from(users).where(eq(users.id, id))
    if (row === undefined) {
      throw new Error(`No user ${id}`)
    }
    return row
  }

  /** The stored row of a staff member, deleted or not. */
  const staffRow = async (id: string = staffId) => {
    const [row] = await db.select().from(staff).where(eq(staff.id, id))
    if (row === undefined) {
      throw new Error(`No staff member ${id}`)
    }
    return row
  }

  /** Everything an operation on an account can change, as it is stored. */
  const stored = async () => ({
    invitations: await db
      .select()
      .from(staffInvitations)
      .orderBy(asc(staffInvitations.id)),
    users: await db.select().from(users).orderBy(asc(users.id)),
    staff: await db.select().from(staff).orderBy(asc(staff.id)),
    sessions: await db.$count(sessions),
  })

  /** How an account and a staff member are linked, as it is stored. */
  const linkOf = async (userId: string, member: string) => {
    const user = await userRow(userId)
    return {
      role: user.role,
      staffId: user.staffId,
      userId: (await staffRow(member)).userId,
    }
  }

  /** The token of the last invitation that was mailed to `email`. */
  const tokenMailedTo = (email: string): string => {
    const token = mails
      .filter(({ to, subject }) => to === email && subject === SUBJECT)
      .flatMap(tokensIn)
      .at(-1)
    if (token === undefined) {
      throw new Error(`No invitation was mailed to ${email}`)
    }
    return token
  }

  /** Invites a staff member through the API as the admin, and returns the mailed token. */
  const invite = async (
    id: string,
    role: Role = 'staff',
    salon: string = salonId,
  ): Promise<string> => {
    const response = await request(app)
      .post(invitationOf(salon, id))
      .set('Authorization', asAdmin)
      .send({ role })
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return tokenMailedTo(response.body.data.email)
  }

  /** Changes a staff member in the ledger through the API, as the admin. */
  const changeStaff = async (
    changes: object,
    id: string,
    salon: string = salonId,
  ): Promise<void> => {
    const response = await request(app)
      .patch(staffOf(salon, id))
      .set('Authorization', asAdmin)
      .send(changes)
    expect(response.status).toBe(200)
  }

  const deleteStaff = async (
    id: string,
    salon: string = salonId,
  ): Promise<void> => {
    const response = await request(app)
      .delete(staffOf(salon, id))
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

  /** Hides a salon as `DELETE /api/v1/salons/:id` does; its rows stay. */
  const deleteSalon = async (id: string = salonId): Promise<void> => {
    const response = await request(app)
      .delete(`${SALONS}/${id}`)
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

  /** A signed-in user with a role at a salon, linked to a new staff member in both tables. */
  const linkedMember = async (
    role: Role,
    salon: string = salonId,
    staffOverrides: Partial<NewStaff> = {},
  ) => {
    const member = await insertStaffRow(salon, staffOverrides)
    const user = await link(member, { role })
    const { authorization } = await signIn(app, user.email)
    return { ...user, staffId: member, authorization }
  }

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = (salon: string, otherSalon: string) => Promise<string>

  const member =
    (
      role: Role,
      staffOverrides: Parameters<typeof insertMember>[3] = {},
    ): SignInAs =>
    async (salon) => {
      const { email } = await insertMember(db, role, salon, staffOverrides)
      return (await signIn(app, email)).authorization
    }

  const memberOfOther =
    (role: Role): SignInAs =>
    async (salon, otherSalon) =>
      member(role)(otherSalon, salon)

  /** Who keeps the accounts of the staff of the salon under test. */
  const keepers: [string, SignInAs][] = [
    ['an admin', async () => asAdmin],
    ['the owner of the salon', member('owner')],
  ]

  /** Who does not. The last four have a role without the record it needs. */
  const outsiders: [string, SignInAs][] = [
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
    ['the owner of another salon', memberOfOther('owner')],
    ['a manager of another salon', memberOfOther('manager')],
    ['a staff member of another salon', memberOfOther('staff')],
    [
      'a customer',
      async () =>
        (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
          .authorization,
    ],
    [
      'an owner user without a staff member',
      async () =>
        (await signedInUser(app, db, { role: 'owner' })).authorization,
    ],
    [
      'a customer user without a customer',
      async () => (await signedInUser(app, db)).authorization,
    ],
    [
      'an owner whose staff member is inactive',
      member('owner', { isActive: false }),
    ],
    [
      'an owner whose staff member is deleted',
      member('owner', { deletedAt: '2026-11-01T00:00:00.000Z' }),
    ],
  ]

  /**
   * Tokens that every operation refuses, before anything else is looked
   * at: none, one that names no session, one that has run out.
   */
  const unauthenticated: [
    string,
    () => Promise<string | null>,
    ExpectedProblem,
    string,
  ][] = [
    ['no access token', async () => null, authenticationRequired, CHALLENGE],
    [
      'a token that names no session',
      async () => `Bearer ${'t'.repeat(43)}`,
      invalidToken,
      INVALID_TOKEN_CHALLENGE,
    ],
    [
      'an access token of an admin that has run out',
      async () =>
        (
          await insertSession(
            db,
            (
              await insertUser(db, { role: 'admin' })
            ).id,
            {
              expiresAt: minutesFromNow(-1),
            },
          )
        ).authorization,
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  describe('GET /api/v1/salons/:salonId/staff/:id/account', () => {
    it('returns the account of the staff member as the salon is shown it, with where it and the staff member are', async () => {
      const response = await get()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          id: account.id,
          email: MEMBER,
          role: 'staff',
          status: 'active',
          twoFactorStatus: 'disabled',
          lastLoginAt: null,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: accountOf(salonId, staffId),
          staff: staffOf(salonId, staffId),
        },
      })
    })

    it('shows nothing of what authenticates the account', async () => {
      const row = await userRow(account.id)

      const response = await get()

      expect(Object.keys(response.body.data).sort()).toEqual(ACCOUNT_PROPERTIES)
      expect(response.text).not.toContain(row.passwordHash)
      expect(response.text).not.toContain('passwordHash')
      expect(response.text).not.toContain('failedLoginAttempts')
    })

    it('tells when the account signed in last', async () => {
      const before = Date.now()
      await signIn(app, MEMBER)

      const { lastLoginAt } = (await get()).body.data

      expect(lastLoginAt).toMatch(ISO_TIMESTAMP)
      expect(Date.parse(lastLoginAt)).toBeGreaterThanOrEqual(before - 1000)
    })

    it.each(ROLES)('shows an account with the role %s', async (role) => {
      const colleague = await insertStaffRow()
      const user = await link(colleague, { role })

      const response = await get(asAdmin, colleague)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ id: user.id, role })
    })

    it('shows the status and the two-factor status of the account as they are stored', async () => {
      const colleague = await insertStaffRow()
      await link(colleague, { status: 'suspended' })

      const response = await get(asAdmin, colleague)

      expect(response.body.data).toMatchObject({
        status: 'suspended',
        twoFactorStatus: 'disabled',
      })
    })

    it('shows the account of a staff member who is inactive: it is still theirs', async () => {
      await changeStaff({ isActive: false }, staffId)

      const response = await get()

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(account.id)
    })

    it('takes the account from the user that names the staff member, whatever the ledger names', async () => {
      const namedByUserOnly = await insertStaffRow()
      const user = await insertUser(db, {
        role: 'manager',
        staffId: namedByUserOnly,
      })
      const namedByLedgerOnly = await insertStaffRow(salonId, {
        userId: (await insertUser(db, { role: 'staff' })).id,
      })

      const responses = [
        await get(asAdmin, namedByUserOnly),
        await get(asAdmin, namedByLedgerOnly),
      ]

      expect(responses.map(({ status }) => status)).toEqual([200, 404])
      expect(responses[0]?.body.data.id).toBe(user.id)
    })

    it('answers 404 for a staff member without an account, and for one whose account is deleted', async () => {
      const never = await insertStaffRow()
      const deleted = await insertStaffRow()
      await link(deleted, { deletedAt: '2026-11-01T00:00:00.000Z' })

      const responses = [await get(asAdmin, never), await get(asAdmin, deleted)]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses.map(({ body }) => body.detail)).toEqual([
        `Account of staff member ${never} was not found`,
        `Account of staff member ${deleted} was not found`,
      ])
    })

    it('answers 404 for a staff member the salon does not have, for one that is deleted and for a salon that is not there', async () => {
      const otherSalon = await insertSalon(db)
      const ofOther = (await linkedMember('staff', otherSalon)).staffId
      const deleted = await insertStaffRow(salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await link(deleted)
      const gone = await insertSalon(db, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      const ofGone = await insertStaffRow(gone)
      await link(ofGone)

      const responses = [
        await get(asAdmin, ofOther),
        await get(asAdmin, deleted),
        await get(asAdmin, UNKNOWN_ID),
        await get(asAdmin, staffId, UNKNOWN_ID),
        await get(asAdmin, ofGone, gone),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        `404 Staff member ${ofOther} was not found`,
        `404 Staff member ${deleted} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Salon ${gone} was not found`,
      ])
    })

    it.each(malformedIds)(
      'rejects %s as the salon and as the staff member',
      async (_case, id) => {
        const responses = [
          await get(asAdmin, staffId, id),
          await get(asAdmin, id),
        ]

        expect(responses.map(outcomeOf)).toEqual([
          '400 salonId:invalid_format',
          '400 id:invalid_format',
        ])
      },
    )

    it('takes IDs in upper case for the same salon and staff member', async () => {
      const response = await get(
        asAdmin,
        staffId.toUpperCase(),
        salonId.toUpperCase(),
      )

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(account.id)
    })

    it('changes nothing', async () => {
      const before = await stored()

      await get()

      expect(await stored()).toEqual(before)
    })
  })

  describe('PATCH /api/v1/salons/:salonId/staff/:id/account', () => {
    it('changes the role of the account and returns the account as it is then', async () => {
      const before = await userRow(account.id)
      await pause(5)

      const response = await patch({ role: 'manager' })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          id: account.id,
          email: MEMBER,
          role: 'manager',
          status: 'active',
          twoFactorStatus: 'disabled',
          lastLoginAt: null,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: accountOf(salonId, staffId),
          staff: staffOf(salonId, staffId),
        },
      })
      const after = await userRow(account.id)
      expect(after).toEqual({
        ...before,
        role: 'manager',
        updatedAt: after.updatedAt,
      })
      expect(Date.parse(after.updatedAt)).toBeGreaterThan(
        Date.parse(before.updatedAt),
      )
      expect((await get()).body.data).toEqual(response.body.data)
    })

    it('changes nothing but the one user: the ledger, the other accounts and the sessions stay', async () => {
      const colleague = await linkedMember('staff')
      const before = await stored()

      expect((await patch({ role: 'owner' })).status).toBe(200)

      const after = await stored()
      expect(after.staff).toEqual(before.staff)
      expect(after.sessions).toBe(before.sessions)
      expect(after.invitations).toEqual(before.invitations)
      expect(after.users.filter(({ id }) => id !== account.id)).toEqual(
        before.users.filter(({ id }) => id !== account.id),
      )
      expect((await userRow(colleague.id)).role).toBe('staff')
    })

    it('gives the account the new role from its next request on, with the access token it has', async () => {
      const { authorization } = await signIn(app, MEMBER)
      const asked: number[] = []

      asked.push((await ledger(authorization)).status)
      expect((await patch({ role: 'owner' })).status).toBe(200)
      asked.push((await ledger(authorization)).status)
      expect((await patch({ role: 'manager' })).status).toBe(200)
      asked.push((await ledger(authorization)).status)

      expect(asked).toEqual([403, 200, 403])
    })

    it.each(ROLES)(
      'lets an admin give the role %s, also to an account that has it',
      async (role) => {
        const responses = [await patch({ role }), await patch({ role })]

        expect(responses.map(({ status }) => status)).toEqual([200, 200])
        expect(responses.map(({ body }) => body.data.role)).toEqual([
          role,
          role,
        ])
        expect((await userRow(account.id)).role).toBe(role)
      },
    )

    it('lets the owner of the salon give the roles of a manager and of staff, and not the one of an owner', async () => {
      const owner = await linkedMember('owner')

      const responses = [
        await patch({ role: 'manager' }, owner.authorization),
        await patch({ role: 'staff' }, owner.authorization),
        await patch({ role: 'owner' }, owner.authorization),
      ]

      expect(responses.map(({ status }) => status)).toEqual([200, 200, 403])
      expectProblem(responses[2] ?? (await get(null)), forbidden)
      expect((await userRow(account.id)).role).toBe('staff')
    })

    it('lets the owner take the role of an owner from another owner of the salon, which only an admin gives back', async () => {
      const owner = await linkedMember('owner')
      const other = await linkedMember('owner')

      const taken = await patch(
        { role: 'manager' },
        owner.authorization,
        other.staffId,
      )
      const givenBack = await patch(
        { role: 'owner' },
        owner.authorization,
        other.staffId,
      )
      const byAdmin = await patch({ role: 'owner' }, asAdmin, other.staffId)

      expect([taken.status, givenBack.status, byAdmin.status]).toEqual([
        200, 403, 200,
      ])
      expect((await userRow(other.id)).role).toBe('owner')
    })

    it('does not let an owner change the role of their own account', async () => {
      const owner = await linkedMember('owner')
      const before = await stored()

      const responses = [
        await patch({ role: 'manager' }, owner.authorization, owner.staffId),
        await patch({ role: 'staff' }, owner.authorization, owner.staffId),
      ]

      for (const response of responses) {
        expectNotAllowed(response, OWN_ROLE)
      }
      expect(await stored()).toEqual(before)
      expect((await ledger(owner.authorization)).status).toBe(200)
    })

    it('answers an owner who asks for the role of an owner for their own account that they may not give it', async () => {
      const owner = await linkedMember('owner')

      const response = await patch(
        { role: 'owner' },
        owner.authorization,
        owner.staffId,
      )

      expectProblem(response, forbidden)
    })

    it('lets an admin change the role of the account of an owner, the last one too', async () => {
      const owner = await linkedMember('owner')

      const response = await patch({ role: 'staff' }, asAdmin, owner.staffId)

      expect(response.status).toBe(200)
      expect((await ledger(owner.authorization)).status).toBe(403)
    })

    it('changes the role of the account of a staff member who is inactive', async () => {
      await changeStaff({ isActive: false }, staffId)

      const response = await patch({ role: 'manager' })

      expect(response.status).toBe(200)
      expect((await userRow(account.id)).role).toBe('manager')
    })

    it.each([
      ['a body without a property', {}, [':custom']],
      ['the role of a customer', { role: 'customer' }, ['role:invalid_value']],
      ['the role of an admin', { role: 'admin' }, ['role:invalid_value']],
      ['a role that is null', { role: null }, ['role:invalid_value']],
      ['a role in upper case', { role: 'OWNER' }, ['role:invalid_value']],
      ['a list of roles', { role: ['staff'] }, ['role:invalid_value']],
      [
        'a status next to the role',
        { role: 'manager', status: 'suspended' },
        ['status:unrecognized_keys'],
      ],
      [
        'an address next to the role',
        { role: 'manager', email: 'other@example.com' },
        ['email:unrecognized_keys'],
      ],
      [
        'another staff member next to the role',
        { role: 'manager', staffId: UNKNOWN_ID },
        ['staffId:unrecognized_keys'],
      ],
      ['a list as the body', [], [':invalid_type']],
    ])('rejects %s and changes nothing', async (_case, body, expected) => {
      const before = await stored()

      const response = await patch(body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid staff account update')
      expect(brokenRules(response)).toEqual(expected)
      expect(await stored()).toEqual(before)
    })

    it('answers 404 when there is no account, no such staff member or no such salon, and changes nothing', async () => {
      const never = await insertStaffRow()
      const otherSalon = await insertSalon(db)
      const ofOther = (await linkedMember('staff', otherSalon)).staffId
      const deleted = await insertStaffRow(salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await link(deleted)
      const before = await stored()

      const responses = [
        await patch({ role: 'manager' }, asAdmin, never),
        await patch({ role: 'manager' }, asAdmin, ofOther),
        await patch({ role: 'manager' }, asAdmin, deleted),
        await patch({ role: 'manager' }, asAdmin, UNKNOWN_ID),
        await patch({ role: 'manager' }, asAdmin, staffId, UNKNOWN_ID),
        await patch({ role: 'manager' }, asAdmin, staffId, otherSalon),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        `404 Account of staff member ${never} was not found`,
        `404 Staff member ${ofOther} was not found`,
        `404 Staff member ${deleted} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${staffId} was not found`,
      ])
      expect(await stored()).toEqual(before)
    })

    it('does not change the role of a deleted user that names the staff member', async () => {
      const colleague = await insertStaffRow()
      const former = await insertUser(db, {
        role: 'staff',
        staffId: colleague,
        deletedAt: '2026-11-01T00:00:00.000Z',
      })

      const response = await patch({ role: 'manager' }, asAdmin, colleague)

      expectProblem(response, notFound)
      expect((await userRow(former.id)).role).toBe('staff')
    })

    it('checks a change in order: the token, the salon ID, the permission for the salon, the staff ID, the body, the permission for the role, the own account, the salon, the staff member, the account', async () => {
      const refused = await member('manager')(salonId, salonId)
      const owner = await linkedMember('owner')
      const never = await insertStaffRow()
      const invalid = { role: 'nobody' }

      const responses = [
        await patch(invalid, null, 'latest', 'latest'),
        await patch(invalid, refused, 'latest', 'latest'),
        await patch(invalid, refused, 'latest', UNKNOWN_ID),
        await patch(invalid, refused, 'latest'),
        await patch(invalid, asAdmin, 'latest', UNKNOWN_ID),
        await patch(invalid, asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await patch(invalid, owner.authorization, owner.staffId),
        await patch({ role: 'owner' }, owner.authorization, owner.staffId),
        await patch({ role: 'owner' }, owner.authorization, UNKNOWN_ID),
        await patch({ role: 'staff' }, owner.authorization, owner.staffId),
        await patch({ role: 'staff' }, asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await patch({ role: 'staff' }, asAdmin, UNKNOWN_ID),
        await patch({ role: 'staff' }, asAdmin, never),
        await patch({ role: 'staff' }, owner.authorization, never),
        await patch({ role: 'staff' }),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401',
        '400 salonId:invalid_format',
        '403',
        '403',
        '400 id:invalid_format',
        '400 role:invalid_value',
        '400 role:invalid_value',
        '403',
        '403',
        `409 ${OWN_ROLE}`,
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Account of staff member ${never} was not found`,
        `404 Account of staff member ${never} was not found`,
        '200',
      ])
    })

    it('answers a body it cannot read before it looks at the token or the permission, as every route does', async () => {
      const refused = await member('manager')(salonId, salonId)
      const path = accountOf(salonId, staffId)
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).patch(path), authorization)
          .set('Content-Type', 'application/json')
          .send('{"role": "manager"')

      const responses = [
        await notJson(null),
        await notJson(refused),
        await notJson(asAdmin),
        await authorized(request(app).patch(path), asAdmin)
          .set('Content-Type', 'text/plain')
          .send('manager'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect((await userRow(account.id)).role).toBe('staff')
    })
  })

  describe('DELETE /api/v1/salons/:salonId/staff/:id/account', () => {
    it('unlinks the account: the user names no staff member, the ledger no user, and both are still there', async () => {
      const before = await stored()
      const user = await userRow(account.id)
      const row = await staffRow()

      const response = await remove()

      expectNoContent(response)
      const after = await stored()
      const userAfter = await userRow(account.id)
      const rowAfter = await staffRow()
      expect(userAfter).toEqual({
        ...user,
        staffId: null,
        updatedAt: userAfter.updatedAt,
      })
      expect(rowAfter).toEqual({
        ...row,
        userId: null,
        updatedAt: rowAfter.updatedAt,
      })
      expect(after.users).toHaveLength(before.users.length)
      expect(after.staff).toHaveLength(before.staff.length)
      expect(after.sessions).toBe(before.sessions)
      expect(after.invitations).toEqual([])
    })

    it('keeps the role of the account, which reaches no salon from its next request on and can still sign in', async () => {
      const owner = await linkedMember('owner')
      const asked: number[] = []

      asked.push((await ledger(owner.authorization)).status)
      expectNoContent(await remove(asAdmin, owner.staffId))
      asked.push((await ledger(owner.authorization)).status)

      expect(asked).toEqual([200, 403])
      expect((await userRow(owner.id)).role).toBe('owner')
      expect((await login(owner.email)).status).toBe(200)
    })

    it('leaves a staff member who has no account, can be invited again and whose account is not found', async () => {
      expectNoContent(await remove())

      const responses = [
        await get(),
        await remove(),
        await patch({ role: 'manager' }),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Account of staff member ${staffId} was not found`,
        )
      }
      expect(await invite(staffId, 'manager')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })

    it('unlinks no other account', async () => {
      const colleague = await linkedMember('manager')

      expectNoContent(await remove())

      expect(await linkOf(colleague.id, colleague.staffId)).toEqual({
        role: 'manager',
        staffId: colleague.staffId,
        userId: colleague.id,
      })
      expect((await get(asAdmin, colleague.staffId)).status).toBe(200)
    })

    it('unlinks the account of a staff member who is inactive', async () => {
      await changeStaff({ isActive: false }, staffId)

      expectNoContent(await remove())

      expect(await linkOf(account.id, staffId)).toEqual({
        role: 'staff',
        staffId: null,
        userId: null,
      })
    })

    it('unlinks what only one of the two tables names', async () => {
      const namedByUserOnly = await insertStaffRow()
      const user = await insertUser(db, {
        role: 'manager',
        staffId: namedByUserOnly,
      })
      const stale = await insertUser(db, { role: 'staff' })
      const namedByLedgerOnly = await insertStaffRow(salonId, {
        userId: stale.id,
      })

      expectNoContent(await remove(asAdmin, namedByUserOnly))
      expectNoContent(await remove(asAdmin, namedByLedgerOnly))

      expect((await userRow(user.id)).staffId).toBeNull()
      expect((await staffRow(namedByLedgerOnly)).userId).toBeNull()
      // A ledger that named a user kept the staff member from being invited.
      expect(await invite(namedByLedgerOnly)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })

    it('leaves a deleted user that names the staff member as it is', async () => {
      const former = await insertUser(db, {
        role: 'staff',
        staffId,
        deletedAt: '2026-11-01T00:00:00.000Z',
      })

      expectNoContent(await remove())

      expect((await userRow(former.id)).staffId).toBe(staffId)
      expect((await userRow(account.id)).staffId).toBeNull()
    })

    it('lets the owner of the salon unlink the account of another owner, and not their own', async () => {
      const owner = await linkedMember('owner')
      const other = await linkedMember('owner')

      const own = await remove(owner.authorization, owner.staffId)
      const others = await remove(owner.authorization, other.staffId)

      expectNotAllowed(own, OWN_ACCOUNT)
      expectNoContent(others)
      expect((await ledger(owner.authorization)).status).toBe(200)
      expect((await ledger(other.authorization)).status).toBe(403)
      expect(await linkOf(owner.id, owner.staffId)).toEqual({
        role: 'owner',
        staffId: owner.staffId,
        userId: owner.id,
      })
    })

    it('answers 404 when there is no account, no such staff member or no such salon, and changes nothing', async () => {
      const never = await insertStaffRow()
      const otherSalon = await insertSalon(db)
      const ofOther = (await linkedMember('staff', otherSalon)).staffId
      const deleted = await insertStaffRow(salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await link(deleted)
      const before = await stored()

      const responses = [
        await remove(asAdmin, never),
        await remove(asAdmin, ofOther),
        await remove(asAdmin, deleted),
        await remove(asAdmin, UNKNOWN_ID),
        await remove(asAdmin, staffId, UNKNOWN_ID),
        await remove(asAdmin, staffId, otherSalon),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        `404 Account of staff member ${never} was not found`,
        `404 Staff member ${ofOther} was not found`,
        `404 Staff member ${deleted} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${staffId} was not found`,
      ])
      expect(await stored()).toEqual(before)
    })

    it('checks an unlinking in order: the token, the salon ID, the permission for the salon, the staff ID, the own account, the salon, the staff member, the account', async () => {
      const refused = await member('manager')(salonId, salonId)
      const owner = await linkedMember('owner')
      const never = await insertStaffRow()

      const responses = [
        await remove(null, 'latest', 'latest'),
        await remove(refused, 'latest', 'latest'),
        await remove(refused, 'latest', UNKNOWN_ID),
        await remove(refused, 'latest'),
        await remove(asAdmin, 'latest', UNKNOWN_ID),
        await remove(owner.authorization, owner.staffId),
        await remove(asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await remove(asAdmin, UNKNOWN_ID),
        await remove(asAdmin, never),
        await remove(),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401',
        '400 salonId:invalid_format',
        '403',
        '403',
        '400 id:invalid_format',
        `409 ${OWN_ACCOUNT}`,
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Account of staff member ${never} was not found`,
        '204',
      ])
    })

    it('takes IDs in upper case for the same salon and staff member, the own one too', async () => {
      const owner = await linkedMember('owner')

      const own = await remove(
        owner.authorization,
        owner.staffId.toUpperCase(),
        salonId.toUpperCase(),
      )
      const response = await remove(
        asAdmin,
        staffId.toUpperCase(),
        salonId.toUpperCase(),
      )

      expectNotAllowed(own, OWN_ACCOUNT)
      expectNoContent(response)
    })
  })

  describe('who may keep the accounts of the staff of a salon', () => {
    it.each(unauthenticated)(
      'answers %s with 401 in every operation before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const invitee = await insertStaffRow(salonId, { email: JOINER })
        const token = await invite(invitee)
        const authorization = await tokenOf()
        const before = await stored()

        const responses = [
          await get(authorization),
          await get(authorization, 'latest', 'latest'),
          await get(authorization, UNKNOWN_ID, UNKNOWN_ID),
          await patch({ role: 'manager' }, authorization),
          await patch({ role: 'nobody' }, authorization),
          await patch({ role: 'manager' }, authorization, 'latest', 'latest'),
          await remove(authorization),
          await remove(authorization, 'latest', 'latest'),
          await remove(authorization, UNKNOWN_ID, UNKNOWN_ID),
          await join(token, authorization),
          await join('', authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await stored()).toEqual(before)
      },
    )

    it.each(keepers)(
      'lets %s read the account of a staff member of the salon, change its role and unlink it',
      async (_case, signInAs) => {
        const authorization = await signInAs(salonId, await insertSalon(db))

        const read = await get(authorization)
        const changed = await patch({ role: 'manager' }, authorization)
        const unlinked = await remove(authorization)

        expect(read.status).toBe(200)
        expect(changed.status).toBe(200)
        expect(changed.body.data).toMatchObject({
          id: account.id,
          role: 'manager',
        })
        expectNoContent(unlinked)
        expect(await linkOf(account.id, staffId)).toEqual({
          role: 'manager',
          staffId: null,
          userId: null,
        })
      },
    )

    it.each(outsiders)(
      'answers %s with 403 in every operation, whatever else is wrong with the request, and changes nothing',
      async (_case, signInAs) => {
        const authorization = await signInAs(salonId, await insertSalon(db))
        const never = await insertStaffRow()
        const before = await stored()

        const responses = [
          await get(authorization),
          await get(authorization, 'latest'),
          await get(authorization, UNKNOWN_ID),
          await get(authorization, never),
          await patch({ role: 'manager' }, authorization),
          await patch({ role: 'owner' }, authorization),
          await patch({ role: 'nobody' }, authorization),
          await patch({}, authorization, 'latest'),
          await patch({ role: 'manager' }, authorization, never),
          await remove(authorization),
          await remove(authorization, 'latest'),
          await remove(authorization, UNKNOWN_ID),
          await remove(authorization, never),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await stored()).toEqual(before)
      },
    )

    it('answers a salon that is not there with 403 to whoever is no admin, and with 404 to an admin', async () => {
      const owner = await linkedMember('owner')

      const responses = [
        await get(owner.authorization, staffId, UNKNOWN_ID),
        await patch(
          { role: 'manager' },
          owner.authorization,
          staffId,
          UNKNOWN_ID,
        ),
        await remove(owner.authorization, staffId, UNKNOWN_ID),
        await get(asAdmin, staffId, UNKNOWN_ID),
      ]

      expect(responses.map(({ status }) => status)).toEqual([
        403, 403, 403, 404,
      ])
    })

    it('does not let a staff member read, change or unlink their own account', async () => {
      const { authorization } = await signIn(app, MEMBER)
      const before = await linkOf(account.id, staffId)

      const responses = [
        await get(authorization),
        await patch({ role: 'owner' }, authorization),
        await remove(authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await linkOf(account.id, staffId)).toEqual(before)
    })

    it('lets the owner of a salon read their own account', async () => {
      const owner = await linkedMember('owner')

      const response = await get(owner.authorization, owner.staffId)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ id: owner.id, role: 'owner' })
    })
  })

  describe('what an account does not have', () => {
    it.each<['put' | 'post']>([['put'], ['post']])(
      'has no %s: an account is not replaced or created here, an invitation links one',
      async (method) => {
        const before = await stored()
        const path = accountOf(salonId, staffId)

        const response = await request(app)
          [method](path)
          .set('Authorization', asAdmin)
          .send({ role: 'manager' })

        expectProblem(response, routeNotFound)
        expect(response.body.detail).toBe(
          `${method.toUpperCase()} ${path} is not part of the API`,
        )
        expect(await stored()).toEqual(before)
      },
    )
  })

  describe('an account that joins an invitation', () => {
    /** The staff member who is invited: active, without an account, with the address `JOINER`. */
    let invitee: string

    beforeEach(async () => {
      invitee = await insertStaffRow(salonId, { email: JOINER })
    })

    /**
     * A signed-in account with the address `JOINER` and a role of a salon
     * that reaches no salon, unless overridden.
     */
    const joiner = (overrides: Partial<NewUser> = {}) =>
      signedInUser(app, db, { email: JOINER, role: 'staff', ...overrides })

    /** A staff member as a row that names the user, which names it. */
    const linkedBefore = async (
      salon: string,
      staffOverrides: Partial<NewStaff> = {},
    ): Promise<{ old: string; user: Partial<NewUser> }> => {
      const id = randomUUID()
      const old = await insertStaffRow(salon, staffOverrides)
      return { old, user: { id, staffId: old } }
    }

    /** Makes the ledger name the user that names the staff member. */
    const nameInLedger = async (old: string, userId: string): Promise<void> => {
      await db.update(staff).set({ userId }).where(eq(staff.id, old))
    }

    /**
     * Accounts that join: they have a role of a salon and reach no salon.
     * Each resolves to the user to insert and to the staff member the
     * account names before, with whether that staff member keeps naming the
     * account afterwards.
     */
    const joining: [
      string,
      () => Promise<{
        user: Partial<NewUser>
        old: string | null
        keepsNaming: boolean
      }>,
    ][] = [
      [
        'an account that was unlinked',
        async () => ({ user: {}, old: null, keepsNaming: false }),
      ],
      [
        'the account of an owner without a staff member',
        async () => ({
          user: { role: 'owner' },
          old: null,
          keepsNaming: false,
        }),
      ],
      [
        'an account whose staff member was deleted',
        async () => ({
          ...(await linkedBefore(salonId, {
            deletedAt: '2026-11-01T00:00:00.000Z',
          })),
          keepsNaming: true,
        }),
      ],
      [
        'an account whose staff member is inactive',
        async () => ({
          ...(await linkedBefore(await insertSalon(db), { isActive: false })),
          keepsNaming: false,
        }),
      ],
      [
        'an account whose salon was deleted',
        async () => ({
          ...(await linkedBefore(
            await insertSalon(db, { deletedAt: '2026-11-01T00:00:00.000Z' }),
          )),
          keepsNaming: false,
        }),
      ],
    ]

    /** Accounts that have a role of a salon and reach one. */
    const belonging: [string, () => Promise<string>][] = [
      ['a staff member of the salon', () => insertStaffRow()],
      [
        'a staff member of another salon',
        async () => insertStaffRow(await insertSalon(db)),
      ],
    ]

    describe('POST /api/v1/auth/staff-invitation/verify', () => {
      it.each(joining)(
        'tells the holder of the token that %s joins: the invitation, and where to join',
        async (_case, prepare) => {
          const { user, old } = await prepare()
          const { id } = await insertUser(db, {
            email: JOINER,
            role: 'staff',
            ...user,
          })
          if (old !== null) {
            await nameInLedger(old, id)
          }
          const token = await invite(invitee, 'manager')
          const before = await stored()

          const response = await verify(token)

          expect(response.status).toBe(200)
          expect(response.headers['cache-control']).toBe('no-store')
          expect(response.body.data).toMatchObject({
            staffId: invitee,
            email: JOINER,
            role: 'manager',
          })
          expect(response.body.links).toEqual({ join: JOIN })
          expect(await stored()).toEqual(before)
        },
      )

      it.each(belonging)(
        'still answers 409 when the address has the account of %s',
        async (_case, staffMember) => {
          await link(await staffMember(), { email: JOINER })
          const token = await invite(invitee)

          const response = await verify(token)

          expectProblem(response, alreadyExists)
          expect(response.body.detail).toBe(
            `User with email ${JOINER} already exists`,
          )
        },
      )

      it('tells where to accept when the address has no account, and where to join once it has one that joins', async () => {
        const token = await invite(invitee)

        const without = await verify(token)
        await insertUser(db, { email: JOINER, role: 'staff' })
        const withAccount = await verify(token)

        expect(without.body.links).toEqual({ accept: ACCEPT })
        expect(withAccount.body.links).toEqual({ join: JOIN })
        expect(withAccount.body.data).toEqual(without.body.data)
      })
    })

    describe('POST /api/v1/auth/staff-invitation/accept', () => {
      it('answers an account that joins with 409, as any account of the address: the token does not stand in for its password', async () => {
        const { id } = await joiner()
        const token = await invite(invitee)
        const before = await stored()

        const response = await accept(token)

        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(
          `User with email ${JOINER} already exists`,
        )
        expect(await stored()).toEqual(before)
        expect((await login(JOINER, NEW_PASSWORD)).status).toBe(401)
        expect((await userRow(id)).staffId).toBeNull()
      })
    })

    describe('POST /api/v1/auth/staff-invitation/join', () => {
      it('links the signed-in account to the staff member of the invitation, gives it the role of the invitation and uses the invitation up', async () => {
        const { id, authorization } = await joiner()
        const token = await invite(invitee, 'manager')
        const before = await stored()
        const user = await userRow(id)
        const row = await staffRow(invitee)

        const response = await join(token, authorization)

        expectNoContent(response)
        expect(response.headers['cache-control']).toBe('no-store')
        const after = await stored()
        const userAfter = await userRow(id)
        const rowAfter = await staffRow(invitee)
        expect(userAfter).toEqual({
          ...user,
          role: 'manager',
          staffId: invitee,
          updatedAt: userAfter.updatedAt,
        })
        expect(rowAfter).toEqual({
          ...row,
          userId: id,
          updatedAt: rowAfter.updatedAt,
        })
        expect(after.invitations).toEqual([])
        expect(after.users).toHaveLength(before.users.length)
        expect(after.sessions).toBe(before.sessions)
        expect(mails).toHaveLength(1)
      })

      it('gives the account the salon from its next request on, with the access token and the password it has', async () => {
        const { authorization } = await joiner()
        const token = await invite(invitee, 'owner')
        const asked: number[] = []

        asked.push((await ledger(authorization)).status)
        expectNoContent(await join(token, authorization))
        asked.push((await ledger(authorization)).status)

        expect(asked).toEqual([403, 200])
        expect((await login(JOINER)).status).toBe(200)
        expect((await login(JOINER, NEW_PASSWORD)).status).toBe(401)
      })

      it('shows the account to whoever keeps the accounts of the salon, and the staff member cannot be invited any more', async () => {
        const { id, authorization } = await joiner()
        expectNoContent(
          await join(await invite(invitee, 'manager'), authorization),
        )

        const read = await get(asAdmin, invitee)
        const invited = await request(app)
          .post(invitationOf(salonId, invitee))
          .set('Authorization', asAdmin)
          .send({ role: 'staff' })

        expect(read.body.data).toMatchObject({
          id,
          email: JOINER,
          role: 'manager',
        })
        expectNotAllowed(
          invited,
          `Staff member ${invitee} already has an account`,
        )
      })

      it.each(joining)('lets %s join', async (_case, prepare) => {
        const { user, old, keepsNaming } = await prepare()
        const { id } = await insertUser(db, {
          email: JOINER,
          role: 'staff',
          ...user,
        })
        if (old !== null) {
          await nameInLedger(old, id)
        }
        const { authorization } = await signIn(app, JOINER)
        const token = await invite(invitee, 'manager')

        const response = await join(token, authorization)

        expectNoContent(response)
        expect(await linkOf(id, invitee)).toEqual({
          role: 'manager',
          staffId: invitee,
          userId: id,
        })
        if (old !== null) {
          // The ledger the account left names it no more; a staff member
          // that is deleted keeps what it had.
          expect((await staffRow(old)).userId).toBe(keepsNaming ? id : null)
        }
        expect((await ledger(authorization)).status).toBe(403)
        expect((await get(asAdmin, invitee)).body.data.id).toBe(id)
      })

      it.each(ROLES)(
        'gives an account that had the role of an owner the role %s of the invitation',
        async (role) => {
          const { id, authorization } = await joiner({ role: 'owner' })

          expectNoContent(
            await join(await invite(invitee, role), authorization),
          )

          expect((await userRow(id)).role).toBe(role)
        },
      )

      it('lets an account that was unlinked come back to the staff member it had, with another role', async () => {
        const { authorization } = await signIn(app, MEMBER)
        expectNoContent(await remove())
        const token = await invite(staffId, 'manager')

        const verified = await verify(token)
        const response = await join(token, authorization)

        expect(verified.body.links).toEqual({ join: JOIN })
        expectNoContent(response)
        expect(await linkOf(account.id, staffId)).toEqual({
          role: 'manager',
          staffId,
          userId: account.id,
        })
      })

      it('uses the token up: it joins once', async () => {
        const { id, authorization } = await joiner()
        const other = await signedInUser(app, db, { role: 'staff' })
        const token = await invite(invitee)
        expectNoContent(await join(token, authorization))
        const before = await stored()

        const again = await join(token, authorization)
        const responses = [
          await join(token, other.authorization),
          await verify(token),
          await accept(token),
        ]

        // The account that joined has a salon now, which is told first.
        expectNotAllowed(again, BELONGS)
        for (const response of responses) {
          expectTokenRefused(response)
        }
        expect(await stored()).toEqual(before)
        expect((await userRow(id)).staffId).toBe(invitee)
      })

      it.each([
        [
          'a customer',
          async (): Promise<Partial<NewUser>> => ({ role: 'customer' }),
        ],
        [
          'a customer with a record',
          async (): Promise<Partial<NewUser>> => ({
            role: 'customer',
            customerId: await insertCustomer(db),
          }),
        ],
        [
          'an admin',
          async (): Promise<Partial<NewUser>> => ({ role: 'admin' }),
        ],
      ])(
        'answers %s with 403, whatever the body is, and changes nothing',
        async (_case, overrides) => {
          const { authorization } = await joiner(await overrides())
          const token = await invite(invitee)
          const before = await stored()

          const responses = [
            await join(token, authorization),
            await join('', authorization),
            await join('i'.repeat(43), authorization),
            await authorized(request(app).post(JOIN), authorization).send({
              password: NEW_PASSWORD,
            }),
          ]

          for (const response of responses) {
            expectProblem(response, forbidden)
            expect(response.headers['cache-control']).toBe('no-store')
          }
          expect(await stored()).toEqual(before)
        },
      )

      it.each(belonging)(
        'answers the account of %s with 409, whether or not the token works, and changes nothing',
        async (_case, staffMember) => {
          const user = await link(await staffMember(), { email: JOINER })
          const { authorization } = await signIn(app, user.email)
          // The address has an account that reaches a salon, and the
          // invitation is issued all the same.
          const token = await invite(invitee)
          const before = await stored()

          const responses = [
            await join(token, authorization),
            await join('i'.repeat(43), authorization),
          ]

          for (const response of responses) {
            expectNotAllowed(response, BELONGS)
            expect(response.headers['cache-control']).toBe('no-store')
          }
          expect(await stored()).toEqual(before)
        },
      )

      it('answers an account with another address with 409, and the invitation stays for the account it went to', async () => {
        const stranger = await signedInUser(app, db, { role: 'staff' })
        const { id, authorization } = await joiner()
        const token = await invite(invitee)
        const before = await stored()

        const response = await join(token, stranger.authorization)

        expectNotAllowed(response, OTHER_ADDRESS)
        expect(response.text).not.toContain(JOINER)
        expect(await stored()).toEqual(before)
        expectNoContent(await join(token, authorization))
        expect(await linkOf(id, invitee)).toMatchObject({ staffId: invitee })
        expect((await userRow(stranger.id)).staffId).toBeNull()
      })

      /**
       * What makes an invitation that was mailed stop working, each told
       * from the other by nothing in the answer. Resolves to the token to
       * send.
       */
      const unusable: [string, (token: string) => Promise<string>][] = [
        ['a token nobody holds', async () => 'i'.repeat(43)],
        [
          'the hash that is stored of the token',
          async (token) => sha256(token),
        ],
        [
          'a token that ran out a moment ago',
          async (token) => {
            await db
              .update(staffInvitations)
              .set({
                expiresAt: sql`${staffInvitations.expiresAt} - make_interval(secs => ${WEEK_SECONDS})`,
              })
              .where(eq(staffInvitations.staffId, invitee))
            return token
          },
        ],
        [
          'an invitation that was taken back',
          async (token) => {
            const response = await request(app)
              .delete(invitationOf(salonId, invitee))
              .set('Authorization', asAdmin)
            expect(response.status).toBe(204)
            return token
          },
        ],
        [
          'a staff member who is not active any more',
          async (token) => {
            await changeStaff({ isActive: false }, invitee)
            return token
          },
        ],
        [
          'a staff member who was deleted',
          async (token) => {
            await deleteStaff(invitee)
            return token
          },
        ],
        [
          'a salon that was deleted',
          async (token) => {
            await deleteSalon()
            return token
          },
        ],
        [
          'a staff member whose address in the ledger is another one by now',
          async (token) => {
            await changeStaff({ email: 'renamed@example.com' }, invitee)
            return token
          },
        ],
        [
          'a staff member whom another account names by now',
          async (token) => {
            await insertUser(db, { role: 'staff', staffId: invitee })
            return token
          },
        ],
      ]

      it.each(unusable)(
        'refuses %s with the one answer of a token that cannot be used, and changes nothing',
        async (_case, tokenOf) => {
          const { id, authorization } = await joiner()
          const token = await tokenOf(await invite(invitee))
          const before = await stored()

          const response = await join(token, authorization)

          expectTokenRefused(response)
          expect(response.text).not.toContain(token)
          expect(await stored()).toEqual(before)
          expect((await userRow(id)).staffId).toBeNull()
        },
      )

      it.each([
        ['a missing token', {}, ['token:invalid_type']],
        ['an empty token', { token: '' }, ['token:too_small']],
        [
          'a token over 255 characters',
          { token: 't'.repeat(256) },
          ['token:too_big'],
        ],
        ['a token that is null', { token: null }, ['token:invalid_type']],
        [
          'a password next to the token',
          { token: 'i'.repeat(43), password: NEW_PASSWORD },
          ['password:unrecognized_keys'],
        ],
        [
          'a role next to the token',
          { token: 'i'.repeat(43), role: 'owner' },
          ['role:unrecognized_keys'],
        ],
        ['a list as the body', [], [':invalid_type']],
      ])('rejects %s', async (_case, body, expected) => {
        const { authorization } = await joiner()

        const response = await request(app)
          .post(JOIN)
          .set('Authorization', authorization)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(body))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid staff invitation')
        expect(brokenRules(response)).toEqual(expected)
        expect(response.headers['cache-control']).toBe('no-store')
      })

      it('checks a joining in order: the token of the session, the role, the body, the salon the account has, the token of the invitation, the address', async () => {
        const customer = await signedInUser(app, db)
        const belongs = await linkedMember('staff')
        const stranger = await signedInUser(app, db, { role: 'manager' })
        const { authorization } = await joiner()
        const token = await invite(invitee)
        const unknown = 'i'.repeat(43)

        const responses = [
          await join('', null),
          await join('', customer.authorization),
          await join('', belongs.authorization),
          await join(unknown, belongs.authorization),
          await join(unknown, stranger.authorization),
          await join(token, stranger.authorization),
          await join(token, authorization),
        ]

        expect(responses.map(outcomeOf)).toEqual([
          '401',
          '403',
          '400 token:too_small',
          `409 ${BELONGS}`,
          '400 token:invalid_token',
          `409 ${OTHER_ADDRESS}`,
          '204',
        ])
      })

      it('answers a body it cannot read before it looks at the token of the session', async () => {
        const { authorization } = await joiner()
        const notJson = (as: string | null): Test =>
          authorized(request(app).post(JOIN), as)
            .set('Content-Type', 'application/json')
            .send('{"token": "')

        const responses = [
          await notJson(null),
          await notJson(authorization),
          await authorized(request(app).post(JOIN), authorization)
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send(`token=${'i'.repeat(43)}`),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '400 2002',
          '400 2002',
          '415 2002',
        ])
      })

      it('is a POST only: a GET of the route reads nothing and joins nothing', async () => {
        const { authorization } = await joiner()
        await invite(invitee)
        const before = await stored()

        const response = await request(app)
          .get(JOIN)
          .set('Authorization', authorization)

        expectProblem(response, routeNotFound)
        expect(response.body.detail).toBe(`GET ${JOIN} is not part of the API`)
        expect(await stored()).toEqual(before)
      })

      it('signs nobody in and nobody out', async () => {
        const { authorization } = await joiner()
        const before = await db.$count(sessions)

        expectNoContent(await join(await invite(invitee), authorization))

        expect(await db.$count(sessions)).toBe(before)
      })
    })

    describe('requests at the same moment', () => {
      it('lets one of several joinings of one token link the account, and refuses the others: the token is used, or the account is seen to belong to the staff member', async () => {
        const { id, authorization } = await joiner()
        for (let round = 0; round < 4; round += 1) {
          const token = await invite(invitee)

          const responses = await Promise.all([
            join(token, authorization),
            join(token, authorization),
            join(token, authorization),
          ])

          const refused = responses.filter(({ status }) => status !== 204)
          expect(refused).toHaveLength(2)
          for (const response of refused) {
            // A request whose session is read once the first has joined is
            // told that the account has a salon, as a request that follows
            // it is. One that is read before waits for the first, and
            // finds the token used.
            if (response.status === 409) {
              expectNotAllowed(response, BELONGS)
            } else {
              expectTokenRefused(response)
            }
          }
          expect(await linkOf(id, invitee)).toEqual({
            role: 'staff',
            staffId: invitee,
            userId: id,
          })
          expectNoContent(await remove(asAdmin, invitee))
        }
      })

      it('lets an account that is invited by two salons at once join one of them, and tells it for the other that it belongs to a staff member', async () => {
        for (let round = 0; round < 4; round += 1) {
          const email = `race-${round}@example.com`
          const user = await signedInUser(app, db, { email, role: 'staff' })
          const otherSalon = await insertSalon(db)
          const here = await insertStaffRow(salonId, { email })
          const there = await insertStaffRow(otherSalon, { email })
          const tokens = [
            await invite(here, 'manager'),
            await invite(there, 'staff', otherSalon),
          ]

          const responses = await Promise.all(
            tokens.map((token) => join(token, user.authorization)),
          )

          expect(responses.map(({ status }) => status).sort()).toEqual([
            204, 409,
          ])
          const joined = responses[0]?.status === 204 ? here : there
          const other = joined === here ? there : here
          expect(await linkOf(user.id, joined)).toEqual({
            role: joined === here ? 'manager' : 'staff',
            staffId: joined,
            userId: user.id,
          })
          expect((await staffRow(other)).userId).toBeNull()
          expect(await db.$count(staffInvitations)).toBe(round + 1)
          for (const response of responses) {
            if (response.status === 409) {
              expect(response.body.detail).toBe(BELONGS)
            }
          }
        }
      })

      it('answers a joining that meets the taking back of the invitation with 204 or 400, and the account is linked exactly when it joined', async () => {
        for (let round = 0; round < 5; round += 1) {
          const email = `race-${round}@example.com`
          const user = await signedInUser(app, db, { email, role: 'staff' })
          const invited = await insertStaffRow(salonId, { email })
          const token = await invite(invited)

          const [joined, revoked] = await Promise.all([
            join(token, user.authorization),
            request(app)
              .delete(invitationOf(salonId, invited))
              .set('Authorization', asAdmin),
          ])

          expect([
            [204, 404],
            [400, 204],
          ]).toContainEqual([joined.status, revoked.status])
          expect(await linkOf(user.id, invited)).toMatchObject(
            joined.status === 204
              ? { staffId: invited, userId: user.id }
              : { staffId: null, userId: null },
          )
        }
        expect(await db.$count(staffInvitations)).toBe(0)
      })

      it('links the account once when a joining meets an acceptance of the same token, which is answered with 409 or 400', async () => {
        for (let round = 0; round < 4; round += 1) {
          const email = `race-${round}@example.com`
          const user = await signedInUser(app, db, { email, role: 'staff' })
          const invited = await insertStaffRow(salonId, { email })
          const token = await invite(invited)

          const [joined, accepted] = await Promise.all([
            join(token, user.authorization),
            accept(token),
          ])

          expectNoContent(joined)
          expect([400, 409]).toContain(accepted.status)
          expect(await linkOf(user.id, invited)).toMatchObject({
            staffId: invited,
            userId: user.id,
          })
          expect((await login(email)).status).toBe(200)
        }
      })

      it('lets an account leave a staff member while that staff member is unlinked, without either request failing', async () => {
        for (let round = 0; round < 5; round += 1) {
          const email = `race-${round}@example.com`
          const old = await insertStaffRow(salonId, { isActive: false })
          const user = await link(old, { email })
          const { authorization } = await signIn(app, email)
          const invited = await insertStaffRow(salonId, { email })
          const token = await invite(invited, 'manager')

          const [joined, unlinked] = await Promise.all([
            join(token, authorization),
            remove(asAdmin, old),
          ])

          expectNoContent(joined)
          expect([204, 404]).toContain(unlinked.status)
          expect(await linkOf(user.id, invited)).toEqual({
            role: 'manager',
            staffId: invited,
            userId: user.id,
          })
          expect((await staffRow(old)).userId).toBeNull()
        }
      })

      it('answers a change of the role that meets the unlinking with 200 or 404, and the account is unlinked', async () => {
        for (let round = 0; round < 5; round += 1) {
          const colleague = await insertStaffRow()
          const user = await link(colleague)

          const [changed, unlinked] = await Promise.all([
            patch({ role: 'manager' }, asAdmin, colleague),
            remove(asAdmin, colleague),
          ])

          expectNoContent(unlinked)
          expect([200, 404]).toContain(changed.status)
          expect(await linkOf(user.id, colleague)).toEqual({
            role: changed.status === 200 ? 'manager' : 'staff',
            staffId: null,
            userId: null,
          })
        }
      })

      it('unlinks once when several unlinkings of one account arrive together', async () => {
        const responses = await Promise.all([remove(), remove(), remove()])

        expect(responses.map(({ status }) => status).sort()).toEqual([
          204, 404, 404,
        ])
        expect(await linkOf(account.id, staffId)).toMatchObject({
          staffId: null,
          userId: null,
        })
      })

      it('lets a joining wait for a change of the staff member that is under way, then refuses the token', async () => {
        const { id, authorization } = await joiner()
        const token = await invite(invitee)

        const { pending } = await db.transaction(async (tx) => {
          await tx
            .select({ id: staff.id })
            .from(staff)
            .where(eq(staff.id, invitee))
            .for('update')
          const underWay = join(token, authorization).then(
            (response) => response,
          )
          await pause(300)
          await tx
            .update(staff)
            .set({ isActive: false })
            .where(eq(staff.id, invitee))

          return { pending: underWay }
        })

        expectTokenRefused(await pending)
        expect(await linkOf(id, invitee)).toMatchObject({
          staffId: null,
          userId: null,
        })
        expect(await db.$count(staffInvitations)).toBe(1)
      })

      // The second staff member gives the account no salon, so the account
      // would still join. The joining did not lock that staff member,
      // though, and writes no staff member it did not lock: with an
      // unlinking of that one it could wait for each other otherwise.
      it.each<[string, Partial<NewStaff>]>([
        ['one that gives it a salon', {}],
        ['one that is inactive', { isActive: false }],
      ])(
        'lets a joining wait for a linking of the account that is under way, to %s, then tells the account that it belongs to a staff member',
        async (_case, overrides) => {
          const { id, authorization } = await joiner()
          const token = await invite(invitee)
          const elsewhere = await insertStaffRow(
            await insertSalon(db),
            overrides,
          )

          const { pending } = await db.transaction(async (tx) => {
            // The user is held: the joining locks the staff member it joins
            // and waits for the user, which meanwhile gets another staff
            // member.
            await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, id))
              .for('update')
            const underWay = join(token, authorization).then(
              (response) => response,
            )
            await pause(300)
            await tx
              .update(users)
              .set({ staffId: elsewhere })
              .where(eq(users.id, id))
            await tx
              .update(staff)
              .set({ userId: id })
              .where(eq(staff.id, elsewhere))

            return { pending: underWay }
          })

          expectNotAllowed(await pending, BELONGS)
          expect(await linkOf(id, elsewhere)).toMatchObject({
            staffId: elsewhere,
            userId: id,
          })
          expect((await staffRow(invitee)).userId).toBeNull()
          expect(await db.$count(staffInvitations)).toBe(1)
        },
      )

      it('lets an unlinking wait for a joining that is under way, then unlinks the account that joined', async () => {
        const { id } = await joiner()
        await invite(invitee, 'manager')

        const { pending } = await db.transaction(async (tx) => {
          await tx
            .select({ id: staff.id })
            .from(staff)
            .where(eq(staff.id, invitee))
            .for('update')
          const underWay = remove(asAdmin, invitee).then((response) => response)
          await pause(300)
          await tx
            .update(users)
            .set({ staffId: invitee, role: 'manager' })
            .where(eq(users.id, id))
          await tx
            .update(staff)
            .set({ userId: id })
            .where(eq(staff.id, invitee))

          return { pending: underWay }
        })

        expectNoContent(await pending)
        expect(await linkOf(id, invitee)).toEqual({
          role: 'manager',
          staffId: null,
          userId: null,
        })
      })

      it('lets a change of the role wait for a joining that is under way, then changes the role of the account that joined', async () => {
        const { id } = await joiner()

        const { pending } = await db.transaction(async (tx) => {
          await tx
            .select({ id: staff.id })
            .from(staff)
            .where(eq(staff.id, invitee))
            .for('update')
          const underWay = patch({ role: 'manager' }, asAdmin, invitee).then(
            (response) => response,
          )
          await pause(300)
          await tx
            .update(users)
            .set({ staffId: invitee })
            .where(eq(users.id, id))
          await tx
            .update(staff)
            .set({ userId: id })
            .where(eq(staff.id, invitee))

          return { pending: underWay }
        })

        const response = await pending
        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({ id, role: 'manager' })
        expect(await linkOf(id, invitee)).toEqual({
          role: 'manager',
          staffId: invitee,
          userId: id,
        })
      })
    })
  })

  describe('the repositories', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const salon = (id: string) => salonIdSchema.parse(id)
    const staffMember = (id: string) => staffIdSchema.parse(id)
    const user = (id: string) => userIdSchema.parse(id)

    describe('StaffAccountRepository', () => {
      const repository = () => new StaffAccountRepository(db)

      it('finds the account with the columns the salon is shown and no other', async () => {
        const found = dataOf(
          await repository().findByStaff(salon(salonId), staffMember(staffId)),
        )

        expect(found).toEqual({
          type: 'found',
          account: {
            id: account.id,
            email: MEMBER,
            role: 'staff',
            status: 'active',
            twoFactorStatus: 'disabled',
            lastLoginAt: null,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        })
      })

      it('tells a staff member the salon does not have from one without an account', async () => {
        const never = await insertStaffRow()
        const otherSalon = await insertSalon(db)

        const found = [
          dataOf(
            await repository().findByStaff(salon(salonId), staffMember(never)),
          ),
          dataOf(
            await repository().findByStaff(
              salon(otherSalon),
              staffMember(staffId),
            ),
          ),
          dataOf(
            await repository().findByStaff(
              salon(salonId),
              staffMember(UNKNOWN_ID),
            ),
          ),
        ]

        expect(found).toEqual([
          { type: 'none' },
          { type: 'staffNotFound' },
          { type: 'staffNotFound' },
        ])
      })

      it('updates the role and resolves to the account as it is stored then', async () => {
        const updated = dataOf(
          await repository().update(salon(salonId), staffMember(staffId), {
            role: 'owner',
          }),
        )

        expect(updated).toMatchObject({
          type: 'updated',
          account: { id: account.id, role: 'owner' },
        })
        expect((await userRow(account.id)).role).toBe('owner')
      })

      it('leaves the role as it is when the changes name none', async () => {
        const updated = dataOf(
          await repository().update(salon(salonId), staffMember(staffId), {}),
        )

        expect(updated).toMatchObject({
          type: 'updated',
          account: { id: account.id, role: 'staff' },
        })
      })

      it('writes nothing for a staff member the salon does not have, or one without an account', async () => {
        const never = await insertStaffRow()
        const otherSalon = await insertSalon(db)
        const before = await stored()

        const outcomes = [
          dataOf(
            await repository().update(salon(otherSalon), staffMember(staffId), {
              role: 'owner',
            }),
          ),
          dataOf(
            await repository().update(salon(salonId), staffMember(never), {
              role: 'owner',
            }),
          ),
          dataOf(
            await repository().unlink(salon(otherSalon), staffMember(staffId)),
          ),
          dataOf(await repository().unlink(salon(salonId), staffMember(never))),
        ]

        expect(outcomes).toEqual([
          { type: 'staffNotFound' },
          { type: 'none' },
          { type: 'staffNotFound' },
          { type: 'none' },
        ])
        expect(await stored()).toEqual(before)
      })

      it('unlinks in both tables', async () => {
        const unlinked = dataOf(
          await repository().unlink(salon(salonId), staffMember(staffId)),
        )

        expect(unlinked).toEqual({ type: 'unlinked' })
        expect(await linkOf(account.id, staffId)).toEqual({
          role: 'staff',
          staffId: null,
          userId: null,
        })
      })
    })

    describe('StaffInvitationRepository', () => {
      const repository = () => new StaffInvitationRepository(db)
      const NOW = '2026-11-20T00:00:00.000Z'

      /** A staff member with the address `JOINER` who holds an invitation, and the hash of its token. */
      const invited = async (role: Role = 'manager') => {
        const invitee = await insertStaffRow(salonId, { email: JOINER })
        const tokenHash = sha256(`token-${randomUUID()}`)
        await db.insert(staffInvitations).values({
          staffId: invitee,
          email: JOINER,
          role,
          tokenHash,
          expiresAt: '2026-12-01T00:00:00.000Z',
        })
        return { invitee, tokenHash }
      }

      it('finds that the account of the address joins when it has a role of a salon and reaches none', async () => {
        const { tokenHash } = await invited()
        await insertUser(db, { email: JOINER, role: 'owner' })

        const found = dataOf(await repository().findUsable(tokenHash, NOW))

        expect(found).toMatchObject({
          type: 'accountMayJoin',
          invitation: { email: JOINER, role: 'manager' },
        })
      })

      it.each<[string, Partial<NewUser>]>([
        ['a customer', { role: 'customer' }],
        ['an admin', { role: 'admin' }],
      ])(
        'finds that the account of %s is in the way, with or without a salon',
        async (_case, overrides) => {
          const { tokenHash } = await invited()
          await insertUser(db, { email: JOINER, ...overrides })

          const found = dataOf(await repository().findUsable(tokenHash, NOW))

          expect(found.type).toBe('accountExists')
        },
      )

      it('joins: the account gets the staff member and the role, the ledger the account, and the invitation is gone', async () => {
        const { invitee, tokenHash } = await invited('manager')
        const { id } = await insertUser(db, { email: JOINER, role: 'staff' })

        const joined = dataOf(await repository().join(tokenHash, user(id), NOW))

        expect(joined).toEqual({ type: 'joined' })
        expect(await linkOf(id, invitee)).toEqual({
          role: 'manager',
          staffId: invitee,
          userId: id,
        })
        expect(await db.$count(staffInvitations)).toBe(0)
      })

      it.each<[string, Partial<NewUser>]>([
        ['a customer', { role: 'customer' }],
        ['an admin', { role: 'admin' }],
        ['a user that is deleted', { role: 'staff', deletedAt: NOW }],
      ])(
        'does not let the account of %s join, whoever asks',
        async (_case, overrides) => {
          const { tokenHash } = await invited()
          const { id } = await insertUser(db, { email: JOINER, ...overrides })
          const before = await stored()

          const joined = dataOf(
            await repository().join(tokenHash, user(id), NOW),
          )

          expect(joined).toEqual({ type: 'accountNotFree' })
          expect(await stored()).toEqual(before)
        },
      )

      it('does not let an account that reaches a salon join', async () => {
        const { tokenHash } = await invited()
        const colleague = await link(await insertStaffRow(), { email: JOINER })
        const before = await stored()

        const joined = dataOf(
          await repository().join(tokenHash, user(colleague.id), NOW),
        )

        expect(joined).toEqual({ type: 'accountNotFree' })
        expect(await stored()).toEqual(before)
      })

      it('tells a token that cannot be used from an invitation to another address, and writes nothing for either', async () => {
        const { tokenHash } = await invited()
        const stranger = await insertUser(db, { role: 'staff' })
        const before = await stored()

        const outcomes = [
          dataOf(
            await repository().join(sha256('unknown'), user(stranger.id), NOW),
          ),
          dataOf(
            await repository().join(
              tokenHash,
              user(stranger.id),
              '2026-12-01T00:00:00.000Z',
            ),
          ),
          dataOf(await repository().join(tokenHash, user(stranger.id), NOW)),
        ]

        expect(outcomes).toEqual([
          { type: 'unusable' },
          { type: 'unusable' },
          { type: 'otherAddress' },
        ])
        expect(await stored()).toEqual(before)
      })

      it('tells that the token cannot be used before it looks at the account', async () => {
        const { id } = await insertUser(db, { role: 'customer' })

        const joined = dataOf(
          await repository().join(sha256('unknown'), user(id), NOW),
        )

        expect(joined).toEqual({ type: 'unusable' })
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })
    const NEEDS_SALON_ROLE = violationOf(
      '23514',
      'users_staff_needs_salon_role',
    )

    it.each<NewUser['role']>(['customer', 'admin'])(
      'refuses a user with the role %s that names a staff member',
      async (role) => {
        const colleague = await insertStaffRow()

        await expect(
          insertUser(db, { role, staffId: colleague }),
        ).rejects.toMatchObject(NEEDS_SALON_ROLE)
      },
    )

    it.each<NewUser['role']>(['customer', 'admin'])(
      'refuses to give the account of a staff member the role %s, and to give a user with that role a staff member',
      async (role) => {
        const plain = await insertUser(db, { role })

        await expect(
          db.update(users).set({ role }).where(eq(users.id, account.id)),
        ).rejects.toMatchObject(NEEDS_SALON_ROLE)
        await expect(
          db
            .update(users)
            .set({ staffId: await insertStaffRow() })
            .where(eq(users.id, plain.id)),
        ).rejects.toMatchObject(NEEDS_SALON_ROLE)
      },
    )

    it('accepts the roles of a salon with a staff member, and every role without one', async () => {
      for (const role of ROLES) {
        await insertUser(db, { role, staffId: await insertStaffRow() })
        await insertUser(db, { role })
      }
      await insertUser(db, { role: 'customer' })
      await insertUser(db, { role: 'admin' })

      expect(await db.$count(users)).toBe(10)
    })
  })
})
