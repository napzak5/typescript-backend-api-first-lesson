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
} from '@beauty-salon-backend/domain'
import { StaffInvitationRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AUTH,
  epochMs,
  insertCustomer,
  insertMember,
  insertSalon,
  insertSession,
  insertUser,
  loginBody,
  minutesFromNow,
  sha256,
  signedInUser,
  signIn,
  signInAsAdmin,
} from './_shared/auth-helpers'
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
} from './_shared/test-helpers'

const SALONS = '/api/v1/salons'
const VERIFY = `${AUTH}/staff-invitation/verify`
const ACCEPT = `${AUTH}/staff-invitation/accept`
const REGISTER = `${AUTH}/register`
const CONFIRM_VERIFICATION = `${AUTH}/verify-email/confirm`
const LOGIN = `${AUTH}/login`

/** Where a staff member of a salon is in the ledger. */
const staffOf = (salonId: string, staffId: string): string =>
  `${SALONS}/${salonId}/staff/${staffId}`

/** Where the invitation of a staff member of a salon is. */
const invitationOf = (salonId: string, staffId: string): string =>
  `${staffOf(salonId, staffId)}/invitation`

/** A UUID that neither a salon nor a staff member has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The address the ledger has for the staff member the tests invite. */
const INVITED = 'invited@example.com'

/** The name `insertSalon` gives a salon. */
const SALON_NAME = 'Hair Studio Aoyama'

/** Passwords that are long enough and on no blocklist. */
const NEW_PASSWORD = 'violet tram under the bridge'
const OTHER_PASSWORD = 'quiet morning by the river'

const SUBJECT = 'スタッフアカウントへの招待'

/** 32 random bytes in base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const ARGON2ID =
  /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/

const WEEK_SECONDS = 7 * 24 * 60 * 60
const WEEK_MS = WEEK_SECONDS * 1000

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

type Role = 'owner' | 'manager' | 'staff'

const ROLES: Role[] = ['owner', 'manager', 'staff']

/** An invitation as the API returns it. */
type Invitation = {
  id: string
  staffId: string
  email: string
  role: Role
  expiresAt: string
  createdAt: string
}

/** An invitation with the token that was mailed for it. */
type Invited = Invitation & { token: string }

/** Exactly the properties of StaffInvitationResponse. */
const INVITATION_PROPERTIES = [
  'createdAt',
  'email',
  'expiresAt',
  'id',
  'role',
  'staffId',
]

type NewStaff = typeof staff.$inferInsert
type NewUser = typeof users.$inferInsert
type NewInvitation = typeof staffInvitations.$inferInsert

const escapeForRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const LINK = `${PUBLIC_APP_URL}/accept-staff-invitation#token=`

/** The tokens in the links of a mail that lead to the page of an invitation. */
const tokensIn = ({ text }: Mail): string[] =>
  [
    ...text.matchAll(
      new RegExp(`${escapeForRegExp(LINK)}([A-Za-z0-9_-]*)`, 'g'),
    ),
  ].map(([, token]) => token ?? '')

/** The whole text of the mail of an invitation. */
const mailTextOf = (salonName: string, token: string): string =>
  [
    `${salonName} から、スタッフアカウントへの招待が届いています。`,
    '',
    '招待を受けるには、次のリンクを開いてください。パスワードを設定して、アカウントを作成します。このメールアドレスのスタッフアカウントをすでにお持ちの場合は、ログインして参加します。',
    '',
    `${LINK}${token}`,
    '',
    'このリンクは 7 日間有効で、1 回だけ使えます。新しい招待メールを受け取った場合は、新しいメールのリンクを使ってください。',
    '',
    'このメールに心当たりがない場合は、何もせずに破棄してください。リンクを開かなければ、何も変わりません。',
  ].join('\n')

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

/** What a problem says, apart from what identifies the one response. */
const problemOf = ({ status, body }: Response) => ({
  status,
  type: body.type,
  title: body.title,
  detail: body.detail,
  code: body.code,
  errors: body.errors,
})

/** What an answer with an invitation has, apart from the invitation's own values. */
const shapeOf = ({ status, headers, body }: Response) => ({
  status,
  contentType: headers['content-type'],
  cacheControl: headers['cache-control'],
  properties: Object.keys(body).sort(),
  data: Object.keys(body.data).sort(),
  role: body.data.role,
  links: Object.keys(body.links).sort(),
})

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
      // The token that was sent is not repeated.
      value: null,
      constraint: null,
    },
  ])
  expect(response.headers['cache-control']).toBe('no-store')
}

describe('Staff invitation API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let mails: Mail[]
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of the staff member the tests invite. */
  let salonId: string
  /** The staff member the tests invite: active, without an account, with the address `INVITED`. */
  let staffId: string

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

  beforeEach(async () => {
    mails = []
    app = createTestApp({ mails })
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
    staffId = await insertStaffRow(salonId, { email: INVITED })
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const get = (
    as: string | null = asAdmin,
    id: string = staffId,
    salon: string = salonId,
  ) => authorized(request(app).get(invitationOf(salon, id)), as)

  const post = (
    body: unknown,
    as: string | null = asAdmin,
    id: string = staffId,
    salon: string = salonId,
  ) =>
    authorized(request(app).post(invitationOf(salon, id)), as)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body))

  const remove = (
    as: string | null = asAdmin,
    id: string = staffId,
    salon: string = salonId,
  ) => authorized(request(app).delete(invitationOf(salon, id)), as)

  const verify = (token: string) => request(app).post(VERIFY).send({ token })

  const accept = (token: string, password: string = NEW_PASSWORD) =>
    request(app).post(ACCEPT).send({ token, password })

  const login = (email: string, password: string) =>
    request(app).post(LOGIN).send(loginBody(email, { password }))

  /** The mails of invitations to an address, oldest first. */
  const invitationMailsTo = (email: string): Mail[] =>
    mails.filter(({ to, subject }) => to === email && subject === SUBJECT)

  /** The token of the last invitation that was mailed to `email`. */
  const tokenMailedTo = (email: string): string => {
    const token = invitationMailsTo(email).flatMap(tokensIn).at(-1)
    if (token === undefined) {
      throw new Error(`No invitation was mailed to ${email}`)
    }
    return token
  }

  /** Invites through the API as the admin, and returns the invitation with the mailed token. */
  const invite = async (
    role: Role = 'staff',
    id: string = staffId,
    salon: string = salonId,
  ): Promise<Invited> => {
    const response = await post({ role }, asAdmin, id, salon)
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    const invitation: Invitation = response.body.data
    return { ...invitation, token: tokenMailedTo(invitation.email) }
  }

  /** Every stored invitation, oldest first, with its times in milliseconds. */
  const storedInvitations = () =>
    db
      .select({
        ...getTableColumns(staffInvitations),
        endsAt: epochMs(staffInvitations.expiresAt),
        startedAt: epochMs(staffInvitations.createdAt),
      })
      .from(staffInvitations)
      .orderBy(asc(staffInvitations.createdAt), asc(staffInvitations.id))

  /** Everything an invitation can change, as it is stored. */
  const stored = async () => ({
    invitations: await db
      .select()
      .from(staffInvitations)
      .orderBy(asc(staffInvitations.id)),
    users: await db.select().from(users).orderBy(asc(users.id)),
    staff: await db.select().from(staff).orderBy(asc(staff.id)),
    sessions: await db.$count(sessions),
  })

  /** The stored row of a staff member, deleted or not. */
  const staffRow = async (id: string = staffId) => {
    const [row] = await db.select().from(staff).where(eq(staff.id, id))
    if (row === undefined) {
      throw new Error(`No staff member ${id}`)
    }
    return row
  }

  /** The users that are not deleted and have `email`. */
  const liveUsersWith = (email: string) =>
    db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))

  /** The one user that is not deleted and has `email`. */
  const liveUser = async (email: string) => {
    const [user, ...others] = await liveUsersWith(email)
    if (user === undefined || others.length > 0) {
      throw new Error(`Expected one user with ${email}`)
    }
    return user
  }

  /**
   * Makes the invitation of a staff member `seconds` older: mailed that much
   * earlier, and ending that much earlier.
   */
  const age = async (seconds: number, id: string = staffId): Promise<void> => {
    await db
      .update(staffInvitations)
      .set({
        expiresAt: sql`${staffInvitations.expiresAt} - make_interval(secs => ${seconds})`,
        createdAt: sql`${staffInvitations.createdAt} - make_interval(secs => ${seconds})`,
      })
      .where(eq(staffInvitations.staffId, id))
  }

  /** Changes a staff member in the ledger through the API, as the admin. */
  const changeStaff = async (
    changes: object,
    id: string = staffId,
    salon: string = salonId,
  ): Promise<void> => {
    const response = await request(app)
      .patch(staffOf(salon, id))
      .set('Authorization', asAdmin)
      .send(changes)
    expect(response.status).toBe(200)
  }

  const deleteStaff = async (
    id: string = staffId,
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

  /** Takes the invitation of a staff member back through the API, as the admin. */
  const revoke = async (id: string = staffId): Promise<void> => {
    expect((await remove(asAdmin, id)).status).toBe(204)
  }

  /** An account that registered with an address and has yet to confirm it. */
  const insertRegistered = (email: string, overrides: Partial<NewUser> = {}) =>
    insertUser(db, {
      email,
      status: 'unverified',
      emailVerified: false,
      emailVerificationTokenHash: sha256(`verification of ${email}`),
      emailVerificationExpiry: minutesFromNow(60),
      ...overrides,
    })

  /**
   * Tokens that every operation of a salon refuses, before anything else is
   * looked at: none, one that names no session, one that has run out.
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

  /**
   * What makes an invitation that was mailed stop working, each told from
   * the other by nothing in the answer. Resolves to the token to send.
   */
  const unusable: [string, (invited: Invited) => Promise<string>][] = [
    ['a token nobody holds', async () => 'i'.repeat(43)],
    [
      'the hash that is stored of the token',
      async ({ token }) => sha256(token),
    ],
    [
      'a token that ran out a moment ago',
      async ({ token }) => {
        await age(WEEK_SECONDS)
        return token
      },
    ],
    [
      'an invitation that was taken back',
      async ({ token }) => {
        await revoke()
        return token
      },
    ],
    [
      'an invitation that a newer one replaced',
      async ({ token }) => {
        await age(61)
        await invite('manager')
        return token
      },
    ],
    [
      'a staff member who is not active any more',
      async ({ token }) => {
        await changeStaff({ isActive: false })
        return token
      },
    ],
    [
      'a staff member who was deleted',
      async ({ token }) => {
        await deleteStaff()
        return token
      },
    ],
    [
      'a salon that was deleted',
      async ({ token }) => {
        await deleteSalon()
        return token
      },
    ],
    [
      'a staff member whose address in the ledger is another one by now',
      async ({ token }) => {
        await changeStaff({ email: 'renamed@example.com' })
        return token
      },
    ],
    [
      'a staff member whom an account names by now',
      async ({ token }) => {
        await insertUser(db, { role: 'staff', staffId })
        return token
      },
    ],
    [
      'a staff member whose row names an account by now',
      async ({ token }) => {
        const { id } = await insertUser(db, { role: 'staff' })
        await db.update(staff).set({ userId: id }).where(eq(staff.id, staffId))
        return token
      },
    ],
  ]

  /**
   * Accounts that keep the address of an invitation: every one that is not
   * deleted, except a registration that never confirmed the address.
   */
  const accountsInTheWay: [string, () => Promise<Partial<NewUser>>][] = [
    ['an active customer account', async () => ({})],
    ['an admin account', async () => ({ role: 'admin' })],
    ['an account that is inactive', async () => ({ status: 'inactive' })],
    [
      'an account that is locked for a while',
      async () => ({ status: 'locked', lockedUntil: minutesFromNow(15) }),
    ],
    ['an account that is suspended', async () => ({ status: 'suspended' })],
    [
      'an account of a customer with a record',
      async () => ({ customerId: await insertCustomer(db) }),
    ],
    [
      'an unconfirmed account that has the record of a customer',
      async () => ({
        status: 'unverified',
        emailVerified: false,
        customerId: await insertCustomer(db),
      }),
    ],
    [
      'an unconfirmed account that is the one of another staff member',
      async () => ({
        status: 'unverified',
        emailVerified: false,
        role: 'staff',
        staffId: await insertStaffRow(),
      }),
    ],
    [
      'the account of a staff member of another salon',
      async () => ({
        role: 'manager',
        staffId: await insertStaffRow(await insertSalon(db)),
      }),
    ],
  ]

  describe('POST /api/v1/salons/:salonId/staff/:id/invitation', () => {
    it('invites a staff member: stores the invitation for 7 days with the hash of a token, mails the link to the address of the ledger, and answers 201 with where the invitation is', async () => {
      const usersBefore = await db.$count(users)
      const before = Date.now()

      const response = await post({ role: 'manager' })
      const after = Date.now()

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.headers['location']).toBe(invitationOf(salonId, staffId))
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          staffId,
          email: INVITED,
          role: 'manager',
          expiresAt: expect.stringMatching(ISO_TIMESTAMP),
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: invitationOf(salonId, staffId),
          staff: staffOf(salonId, staffId),
        },
      })
      const invitation: Invitation = response.body.data
      const endsAt = Date.parse(invitation.expiresAt)
      expect(endsAt).toBeGreaterThanOrEqual(before + WEEK_MS)
      expect(endsAt).toBeLessThanOrEqual(after + WEEK_MS)

      expect(mails).toHaveLength(1)
      const token = tokenMailedTo(INVITED)
      expect(token).toMatch(TOKEN)
      expect(mails).toEqual([
        {
          to: INVITED,
          subject: SUBJECT,
          text: mailTextOf(SALON_NAME, token),
        },
      ])

      const rows = await storedInvitations()
      expect(rows).toEqual([
        {
          id: invitation.id,
          staffId,
          email: INVITED,
          role: 'manager',
          tokenHash: sha256(token),
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          endsAt,
          startedAt: expect.any(Number),
        },
      ])
      // The database keeps microseconds, the API tells milliseconds.
      expect(rows.map(({ startedAt }) => Math.floor(startedAt))).toEqual([
        Date.parse(invitation.createdAt),
      ])
      // The token is in the mail alone: neither the answer nor the row has it.
      expect(JSON.stringify(response.body)).not.toContain(token)
      expect(JSON.stringify(response.body)).not.toContain(sha256(token))
      expect(JSON.stringify(rows)).not.toContain(token)
      // No account exists before the invitation is accepted.
      expect(await db.$count(users)).toBe(usersBefore)
      expect((await staffRow()).userId).toBeNull()
    })

    it.each(ROLES)('lets an admin invite to the role %s', async (role) => {
      const response = await post({ role })

      expect(response.status).toBe(201)
      expect(response.body.data.role).toBe(role)
      expect((await storedInvitations()).map((row) => row.role)).toEqual([role])
    })

    it('names the salon of the staff member in the mail, as the salon is called now', async () => {
      const other = await insertSalon(db, { name: 'サロン・ド・渋谷 & Co.' })
      const colleague = await insertStaffRow(other, {
        email: 'shibuya@example.com',
      })

      const { token } = await invite('staff', colleague, other)

      expect(invitationMailsTo('shibuya@example.com')).toEqual([
        {
          to: 'shibuya@example.com',
          subject: SUBJECT,
          text: mailTextOf('サロン・ド・渋谷 & Co.', token),
        },
      ])
      expect(invitationMailsTo(INVITED)).toEqual([])
    })

    it('mails the address the ledger has at that moment, and keeps it with the invitation', async () => {
      await changeStaff({ email: 'moved@example.com' })

      const invitation = await invite()

      expect(invitation.email).toBe('moved@example.com')
      expect(mails.map(({ to }) => to)).toEqual(['moved@example.com'])
      expect((await storedInvitations()).map(({ email }) => email)).toEqual([
        'moved@example.com',
      ])
    })

    it('puts a new invitation in the place of the one the staff member holds: a new token, a new role, a new end, and the token before stops working', async () => {
      const first = await invite('staff')
      await age(61)

      const second = await invite('manager')

      expect(second.id).not.toBe(first.id)
      expect(second.token).not.toBe(first.token)
      expect(second.role).toBe('manager')
      expect(invitationMailsTo(INVITED)).toHaveLength(2)
      expect(await storedInvitations()).toEqual([
        expect.objectContaining({
          id: second.id,
          role: 'manager',
          tokenHash: sha256(second.token),
        }),
      ])
      expectTokenRefused(await verify(first.token))
      expectTokenRefused(await accept(first.token))
      expect((await verify(second.token)).status).toBe(200)
    })

    it('mails a staff member once in 60 seconds: an invitation sooner than that is answered with 409, and the one before stays as it is', async () => {
      const first = await invite('staff')
      await age(50)
      const before = await stored()

      const response = await post({ role: 'manager' })

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        `An invitation was mailed to staff member ${staffId} moments ago`,
      )
      expect(await stored()).toEqual(before)
      expect(mails).toHaveLength(1)
      expect((await verify(first.token)).body.data.role).toBe('staff')
    })

    it('invites again once the 60 seconds are over, and an invitation that has ended at once', async () => {
      const colleague = await insertStaffRow()
      await invite('staff')
      await invite('staff', colleague)
      await age(61)
      await age(WEEK_SECONDS, colleague)

      const responses = [
        await post({ role: 'staff' }),
        await post({ role: 'staff' }, asAdmin, colleague),
      ]

      expect(responses.map(({ status }) => status)).toEqual([201, 201])
      expect(mails).toHaveLength(4)
    })

    it('counts the 60 seconds for each staff member alone', async () => {
      const colleague = await insertStaffRow()
      await invite('staff')

      const responses = [
        await post({ role: 'staff' }, asAdmin, colleague),
        await post({ role: 'staff' }),
        await post({ role: 'staff' }, asAdmin, colleague),
      ]

      expect(responses.map(({ status }) => status)).toEqual([201, 409, 409])
      expect(mails).toHaveLength(2)
    })

    it.each<[string, () => Promise<unknown>]>([
      ['no account', async () => null],
      ['an active account', () => insertUser(db, { email: INVITED })],
      [
        'the account of a customer with a record',
        async () =>
          insertUser(db, {
            email: INVITED,
            customerId: await insertCustomer(db),
          }),
      ],
      [
        'an account that has yet to confirm it',
        () => insertRegistered(INVITED),
      ],
      [
        'a deleted account',
        () =>
          insertUser(db, {
            email: INVITED,
            deletedAt: '2026-11-01T00:00:00.000Z',
          }),
      ],
    ])(
      'answers and mails the same when the address has %s: who invites does not learn which addresses have accounts',
      async (_case, arrange) => {
        await arrange()
        const colleague = await insertStaffRow(salonId, {
          email: 'nobody-yet@example.com',
        })
        const usersBefore = await db.select().from(users).orderBy(asc(users.id))

        const response = await post({ role: 'staff' })
        const reference = await post({ role: 'staff' }, asAdmin, colleague)

        expect(response.status).toBe(201)
        expect(shapeOf(response)).toEqual(shapeOf(reference))
        expect(Object.keys(response.body.data).sort()).toEqual(
          INVITATION_PROPERTIES,
        )
        expect(invitationMailsTo(INVITED)).toEqual([
          {
            to: INVITED,
            subject: SUBJECT,
            text: mailTextOf(SALON_NAME, tokenMailedTo(INVITED)),
          },
        ])
        expect(await db.select().from(users).orderBy(asc(users.id))).toEqual(
          usersBefore,
        )
      },
    )

    it.each<[string, (id: string) => Promise<unknown>]>([
      [
        'whom an account names',
        (id) => insertUser(db, { role: 'staff', staffId: id }),
      ],
      [
        'whose row names an account',
        async (id) => {
          const user = await insertUser(db, { role: 'staff' })
          await db
            .update(staff)
            .set({ userId: user.id })
            .where(eq(staff.id, id))
        },
      ],
      [
        'whom an account names that cannot be used for now',
        (id) =>
          insertUser(db, { role: 'staff', staffId: id, status: 'suspended' }),
      ],
    ])(
      'refuses to invite a staff member %s with 409, and neither stores nor mails',
      async (_case, link) => {
        await link(staffId)
        const before = await stored()

        const response = await post({ role: 'staff' })

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          `Staff member ${staffId} already has an account`,
        )
        expect(await stored()).toEqual(before)
        expect(mails).toEqual([])
      },
    )

    it('invites a staff member whom only a deleted account names', async () => {
      await insertUser(db, {
        role: 'staff',
        staffId,
        deletedAt: '2026-11-01T00:00:00.000Z',
      })

      const response = await post({ role: 'staff' })

      expect(response.status).toBe(201)
      expect(mails).toHaveLength(1)
    })

    it('refuses to invite a staff member who is inactive with 409, and neither stores nor mails', async () => {
      await changeStaff({ isActive: false })
      const before = await stored()

      const response = await post({ role: 'staff' })

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(`Staff member ${staffId} is inactive`)
      expect(await stored()).toEqual(before)
      expect(mails).toEqual([])
    })

    it('tells of the account before the inactivity and of both before the 60 seconds', async () => {
      const inactive = await insertStaffRow(salonId, { isActive: false })
      const linkedAndInactive = (
        await insertMember(db, 'staff', salonId, { isActive: false })
      ).staffId
      const invitedThenInactive = await insertStaffRow()
      await invite('staff', invitedThenInactive)
      await changeStaff({ isActive: false }, invitedThenInactive)
      const invitedThenLinked = await insertStaffRow()
      await invite('staff', invitedThenLinked)
      await insertUser(db, { role: 'staff', staffId: invitedThenLinked })

      const outcomes = [
        await post({ role: 'staff' }, asAdmin, inactive),
        await post({ role: 'staff' }, asAdmin, linkedAndInactive),
        await post({ role: 'staff' }, asAdmin, invitedThenInactive),
        await post({ role: 'staff' }, asAdmin, invitedThenLinked),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        `409 Staff member ${inactive} is inactive`,
        `409 Staff member ${linkedAndInactive} already has an account`,
        `409 Staff member ${invitedThenInactive} is inactive`,
        `409 Staff member ${invitedThenLinked} already has an account`,
      ])
    })

    it.each<[string, unknown, string[]]>([
      ['no role', {}, ['role:invalid_value']],
      ['a role that is null', { role: null }, ['role:invalid_value']],
      ['the role of a customer', { role: 'customer' }, ['role:invalid_value']],
      ['the role of an admin', { role: 'admin' }, ['role:invalid_value']],
      ['a role in upper case', { role: 'Owner' }, ['role:invalid_value']],
      ['a list of roles', { role: ['staff'] }, ['role:invalid_value']],
      [
        'an address to mail',
        { role: 'staff', email: 'elsewhere@example.com' },
        ['email:unrecognized_keys'],
      ],
      [
        'an end of its own',
        { role: 'staff', expiresAt: '2030-01-01T00:00:00.000Z' },
        ['expiresAt:unrecognized_keys'],
      ],
      [
        'the staff member in the body',
        { role: 'staff', staffId: UNKNOWN_ID },
        ['staffId:unrecognized_keys'],
      ],
      ['a body that is a list', ['staff'], [':invalid_type']],
    ])(
      'rejects %s with 400, and neither stores nor mails',
      async (_case, body, expected) => {
        const response = await post(body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid staff invitation')
        expect(brokenRules(response)).toEqual(expected)
        expect(await storedInvitations()).toEqual([])
        expect(mails).toEqual([])
      },
    )

    it.each(malformedIds)(
      'rejects %s as the ID of the salon or of the staff member with 400',
      async (_case, id) => {
        const ofSalon = await post({ role: 'staff' }, asAdmin, staffId, id)
        const ofStaff = await post({ role: 'staff' }, asAdmin, id)

        expectProblem(ofSalon, badRequest)
        expect(brokenRules(ofSalon)).toEqual(['salonId:invalid_format'])
        expectProblem(ofStaff, badRequest)
        expect(brokenRules(ofStaff)).toEqual(['id:invalid_format'])
        expect(await storedInvitations()).toEqual([])
        expect(mails).toEqual([])
      },
    )

    it('answers 404 for a salon or a staff member that is not there, and neither stores nor mails', async () => {
      const otherSalon = await insertSalon(db)
      const ofOtherSalon = await insertStaffRow(otherSalon)
      const deleted = await insertStaffRow()
      await deleteStaff(deleted)
      const deletedSalon = await insertSalon(db)
      const ofDeletedSalon = await insertStaffRow(deletedSalon)
      await deleteSalon(deletedSalon)

      const outcomes = [
        await post({ role: 'staff' }, asAdmin, staffId, UNKNOWN_ID),
        await post({ role: 'staff' }, asAdmin, ofDeletedSalon, deletedSalon),
        await post({ role: 'staff' }, asAdmin, UNKNOWN_ID),
        await post({ role: 'staff' }, asAdmin, ofOtherSalon),
        await post({ role: 'staff' }, asAdmin, staffId, otherSalon),
        await post({ role: 'staff' }, asAdmin, deleted),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Salon ${deletedSalon} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Staff member ${ofOtherSalon} was not found`,
        `404 Staff member ${staffId} was not found`,
        `404 Staff member ${deleted} was not found`,
      ])
      expect(await storedInvitations()).toEqual([])
      expect(mails).toEqual([])
    })

    it('answers a problem as every route does', async () => {
      const response = await post({ role: 'staff' }, asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.headers['location']).toBeUndefined()
    })
  })

  describe('GET /api/v1/salons/:salonId/staff/:id/invitation', () => {
    it('returns the invitation the staff member holds, without the token or its hash', async () => {
      const { token, ...invitation } = await invite('owner')

      const response = await get()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: invitation,
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: invitationOf(salonId, staffId),
          staff: staffOf(salonId, staffId),
        },
      })
      expect(Object.keys(response.body.data).sort()).toEqual(
        INVITATION_PROPERTIES,
      )
      expect(response.text).not.toContain(token)
      expect(response.text).not.toContain(sha256(token))
    })

    it('returns an invitation whose token has ended, until another takes its place or it is taken back', async () => {
      const invitation = await invite()
      await age(WEEK_SECONDS + 3600)

      const response = await get()

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(invitation.id)
      expect(Date.parse(response.body.data.expiresAt)).toBeLessThan(Date.now())
      expect(Date.parse(response.body.data.expiresAt)).toBe(
        Date.parse(invitation.expiresAt) - (WEEK_SECONDS + 3600) * 1000,
      )
    })

    it('returns the invitation of the staff member in the path alone', async () => {
      const colleague = await insertStaffRow()
      const own = await invite('staff')
      const others = await invite('manager', colleague)

      expect((await get()).body.data.id).toBe(own.id)
      expect((await get(asAdmin, colleague)).body.data.id).toBe(others.id)
    })

    it('reads without changing or mailing anything', async () => {
      await invite()
      const before = await stored()

      await get()
      await get()

      expect(await stored()).toEqual(before)
      expect(mails).toHaveLength(1)
    })

    it('answers 404 for a staff member who holds no invitation: never invited, taken back, or accepted', async () => {
      const neverInvited = await insertStaffRow()
      const takenBack = await insertStaffRow()
      await invite('staff', takenBack)
      await revoke(takenBack)
      const accepted = await invite()
      expect((await accept(accepted.token)).status).toBe(204)

      const responses = [
        await get(asAdmin, neverInvited),
        await get(asAdmin, takenBack),
        await get(),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses.map(({ body }) => body.detail)).toEqual([
        `Invitation of staff member ${neverInvited} was not found`,
        `Invitation of staff member ${takenBack} was not found`,
        `Invitation of staff member ${staffId} was not found`,
      ])
    })

    it.each(malformedIds)(
      'rejects %s as the ID of the salon or of the staff member with 400',
      async (_case, id) => {
        const ofSalon = await get(asAdmin, staffId, id)
        const ofStaff = await get(asAdmin, id)

        expectProblem(ofSalon, badRequest)
        expect(brokenRules(ofSalon)).toEqual(['salonId:invalid_format'])
        expectProblem(ofStaff, badRequest)
        expect(brokenRules(ofStaff)).toEqual(['id:invalid_format'])
      },
    )

    it('answers 404 for a salon or a staff member that is not there, also when the invitation is still stored', async () => {
      const otherSalon = await insertSalon(db)
      const ofOtherSalon = await insertStaffRow(otherSalon)
      await invite('staff', ofOtherSalon, otherSalon)
      const deleted = await insertStaffRow()
      await invite('staff', deleted)
      await deleteStaff(deleted)
      const deletedSalon = await insertSalon(db)
      const ofDeletedSalon = await insertStaffRow(deletedSalon)
      await invite('staff', ofDeletedSalon, deletedSalon)
      await deleteSalon(deletedSalon)
      await invite()

      const outcomes = [
        await get(asAdmin, staffId, UNKNOWN_ID),
        await get(asAdmin, ofDeletedSalon, deletedSalon),
        await get(asAdmin, UNKNOWN_ID),
        await get(asAdmin, ofOtherSalon),
        await get(asAdmin, staffId, otherSalon),
        await get(asAdmin, deleted),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Salon ${deletedSalon} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Staff member ${ofOtherSalon} was not found`,
        `404 Staff member ${staffId} was not found`,
        `404 Staff member ${deleted} was not found`,
      ])
      expect(await storedInvitations()).toHaveLength(4)
    })
  })

  describe('DELETE /api/v1/salons/:salonId/staff/:id/invitation', () => {
    it('takes the invitation back: 204 without a body, the row is gone, the token stops working, and nobody is mailed', async () => {
      const colleague = await insertStaffRow()
      const kept = await invite('staff', colleague)
      const { token } = await invite()

      const response = await remove()

      expectNoContent(response)
      expect((await storedInvitations()).map(({ id }) => id)).toEqual([kept.id])
      expectTokenRefused(await verify(token))
      expectTokenRefused(await accept(token))
      expect(await liveUsersWith(INVITED)).toEqual([])
      expect((await staffRow()).userId).toBeNull()
      expect(mails).toHaveLength(2)
      expect((await verify(kept.token)).status).toBe(200)
    })

    it('takes an invitation back whose token has ended', async () => {
      await invite()
      await age(WEEK_SECONDS + 60)

      expectNoContent(await remove())
      expect(await storedInvitations()).toEqual([])
    })

    it('answers 404 once the invitation is taken back, and a staff member can be invited again at once: the 60 seconds belong to the invitation that is held', async () => {
      await invite()
      await revoke()

      const again = await remove()
      const invited = await post({ role: 'manager' })

      expectProblem(again, notFound)
      expect(again.body.detail).toBe(
        `Invitation of staff member ${staffId} was not found`,
      )
      expect(invited.status).toBe(201)
      expect(invitationMailsTo(INVITED)).toHaveLength(2)
    })

    it('answers 404 for a staff member who holds no invitation, and changes nothing', async () => {
      const colleague = await insertStaffRow()
      await invite('staff', colleague)
      const before = await stored()

      const response = await remove()

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Invitation of staff member ${staffId} was not found`,
      )
      expect(await stored()).toEqual(before)
    })

    it.each(malformedIds)(
      'rejects %s as the ID of the salon or of the staff member with 400',
      async (_case, id) => {
        await invite()
        const before = await stored()

        const ofSalon = await remove(asAdmin, staffId, id)
        const ofStaff = await remove(asAdmin, id)

        expectProblem(ofSalon, badRequest)
        expect(brokenRules(ofSalon)).toEqual(['salonId:invalid_format'])
        expectProblem(ofStaff, badRequest)
        expect(brokenRules(ofStaff)).toEqual(['id:invalid_format'])
        expect(await stored()).toEqual(before)
      },
    )

    it('answers 404 for a salon or a staff member that is not there, and leaves what is stored', async () => {
      const otherSalon = await insertSalon(db)
      const ofOtherSalon = await insertStaffRow(otherSalon)
      await invite('staff', ofOtherSalon, otherSalon)
      const deleted = await insertStaffRow()
      await invite('staff', deleted)
      await deleteStaff(deleted)
      const deletedSalon = await insertSalon(db)
      const ofDeletedSalon = await insertStaffRow(deletedSalon)
      await invite('staff', ofDeletedSalon, deletedSalon)
      await deleteSalon(deletedSalon)
      await invite()
      const before = await stored()

      const outcomes = [
        await remove(asAdmin, staffId, UNKNOWN_ID),
        await remove(asAdmin, ofDeletedSalon, deletedSalon),
        await remove(asAdmin, UNKNOWN_ID),
        await remove(asAdmin, ofOtherSalon),
        await remove(asAdmin, staffId, otherSalon),
        await remove(asAdmin, deleted),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Salon ${deletedSalon} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Staff member ${ofOtherSalon} was not found`,
        `404 Staff member ${staffId} was not found`,
        `404 Staff member ${deleted} was not found`,
      ])
      expect(await stored()).toEqual(before)
    })
  })

  describe('what an invitation does not have', () => {
    it.each<['put' | 'patch']>([['put'], ['patch']])(
      'has no %s: an invitation is not changed, another one takes its place',
      async (method) => {
        await invite()
        const before = await stored()
        const path = invitationOf(salonId, staffId)

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

    it('has no route by its own ID, no list of a salon, and nothing to read with a token', async () => {
      const invitation = await invite()
      const paths = [
        `${invitationOf(salonId, staffId)}/${invitation.id}`,
        `${SALONS}/${salonId}/invitations`,
        VERIFY,
        ACCEPT,
        `${AUTH}/staff-invitation`,
        `${AUTH}/staff-invitation/${invitation.token}`,
      ]

      for (const path of paths) {
        const response = await request(app)
          .get(path)
          .set('Authorization', asAdmin)

        expectProblem(response, routeNotFound)
        expect(response.body.detail).toBe(`GET ${path} is not part of the API`)
      }
    })
  })

  describe('IDs written in upper case', () => {
    it('name the same salon and the same staff member', async () => {
      const salonInUpperCase = salonId.toUpperCase()
      const idInUpperCase = staffId.toUpperCase()

      const created = await post(
        { role: 'staff' },
        asAdmin,
        idInUpperCase,
        salonInUpperCase,
      )
      const read = await get(asAdmin, idInUpperCase, salonInUpperCase)
      const removed = await remove(asAdmin, idInUpperCase, salonInUpperCase)

      expect(created.status).toBe(201)
      expect(created.body.data.staffId).toBe(staffId)
      expect(read.status).toBe(200)
      expect(read.body.data).toEqual(created.body.data)
      expect(removed.status).toBe(204)
      expect(await storedInvitations()).toEqual([])
    })
  })

  describe('who may invite the staff of a salon', () => {
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

    const customer: SignInAs = async () =>
      (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
        .authorization

    /** Who invites the staff of the salon under test, reads their invitations and takes them back. */
    const inviters: [string, SignInAs][] = [
      ['an admin', async () => asAdmin],
      ['the owner of the salon', member('owner')],
    ]

    /** Who does none of it. The last four have a role without the record it needs. */
    const outsiders: [string, SignInAs][] = [
      ['a manager of the salon', member('manager')],
      ['a staff member of the salon', member('staff')],
      ['the owner of another salon', memberOfOther('owner')],
      ['a manager of another salon', memberOfOther('manager')],
      ['a staff member of another salon', memberOfOther('staff')],
      ['a customer', customer],
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

    it.each(unauthenticated)(
      'answers %s with 401 in every operation before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        await invite()
        const authorization = await tokenOf()
        const before = await stored()

        const responses = [
          await get(authorization),
          await get(authorization, 'latest', 'latest'),
          await get(authorization, UNKNOWN_ID, UNKNOWN_ID),
          await post({ role: 'staff' }, authorization),
          await post({ role: 'nobody' }, authorization),
          await post({ role: 'staff' }, authorization, 'latest', 'latest'),
          await post({ role: 'staff' }, authorization, UNKNOWN_ID, UNKNOWN_ID),
          await remove(authorization),
          await remove(authorization, 'latest', 'latest'),
          await remove(authorization, UNKNOWN_ID, UNKNOWN_ID),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await stored()).toEqual(before)
        expect(mails).toHaveLength(1)
      },
    )

    it.each(inviters)(
      'lets %s invite a staff member of the salon, read the invitation and take it back',
      async (_case, signInAs) => {
        const authorization = await signInAs(salonId, await insertSalon(db))

        const created = await post({ role: 'staff' }, authorization)
        const read = await get(authorization)
        const removed = await remove(authorization)

        expect(created.status).toBe(201)
        expect(read.status).toBe(200)
        expect(read.body.data).toEqual(created.body.data)
        expect(removed.status).toBe(204)
        expect(await storedInvitations()).toEqual([])
        expect(invitationMailsTo(INVITED)).toHaveLength(1)
      },
    )

    it.each(outsiders)(
      'answers %s with 403 in every operation, and neither changes nor mails anything',
      async (_case, signInAs) => {
        await invite()
        const authorization = await signInAs(salonId, await insertSalon(db))
        const before = await stored()

        const responses = [
          await get(authorization),
          await post({ role: 'staff' }, authorization),
          await post({ role: 'manager' }, authorization),
          await post({ role: 'owner' }, authorization),
          await remove(authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await stored()).toEqual(before)
        expect(mails).toHaveLength(1)
      },
    )

    it.each(outsiders)(
      'does not tell %s whether a salon, a staff member or an invitation is there',
      async (_case, signInAs) => {
        const neverInvited = await insertStaffRow()
        const authorization = await signInAs(salonId, await insertSalon(db))

        const responses = [
          await get(authorization, neverInvited),
          await get(authorization, UNKNOWN_ID),
          await get(authorization, staffId, UNKNOWN_ID),
          await post({ role: 'staff' }, authorization, UNKNOWN_ID),
          await post({ role: 'staff' }, authorization, staffId, UNKNOWN_ID),
          await remove(authorization, neverInvited),
          await remove(authorization, UNKNOWN_ID),
          await remove(authorization, staffId, UNKNOWN_ID),
        ]

        expect(responses.map(({ status }) => status)).toEqual(
          responses.map(() => 403),
        )
      },
    )

    it('lets an admin give every role, and the owner of a salon the roles of a manager and of a staff member alone', async () => {
      const ownerOfSalon = await member('owner')(salonId, salonId)

      const outcomes = [
        await post({ role: 'owner' }, asAdmin, await insertStaffRow()),
        await post({ role: 'manager' }, asAdmin, await insertStaffRow()),
        await post({ role: 'staff' }, asAdmin, await insertStaffRow()),
        await post({ role: 'owner' }, ownerOfSalon, await insertStaffRow()),
        await post({ role: 'manager' }, ownerOfSalon, await insertStaffRow()),
        await post({ role: 'staff' }, ownerOfSalon, await insertStaffRow()),
      ].map(({ status }) => status)

      expect(outcomes).toEqual([201, 201, 201, 403, 201, 201])
      expect(
        (await storedInvitations()).map(({ role }) => role).sort(),
      ).toEqual(['manager', 'manager', 'owner', 'staff', 'staff'])
      expect(mails).toHaveLength(5)
    })

    it('answers an owner who asks for another owner with 403, and neither stores nor mails: who runs a salon is for the platform to say', async () => {
      const ownerOfSalon = await member('owner')(salonId, salonId)
      const first = await invite('staff')
      await age(61)
      const before = await stored()

      const response = await post({ role: 'owner' }, ownerOfSalon)

      expectProblem(response, forbidden)
      expect(await stored()).toEqual(before)
      expect(invitationMailsTo(INVITED)).toHaveLength(1)
      expect((await verify(first.token)).status).toBe(200)
    })

    it('lets an owner read and take back the invitation of an owner that an admin made', async () => {
      const ownerOfSalon = await member('owner')(salonId, salonId)
      const invitation = await invite('owner')

      const read = await get(ownerOfSalon)
      const removed = await remove(ownerOfSalon)

      expect(read.status).toBe(200)
      expect(read.body.data.id).toBe(invitation.id)
      expect(read.body.data.role).toBe('owner')
      expect(removed.status).toBe(204)
    })

    /** Sends a body that says it is JSON but is not. */
    const notJson = (call: Test, authorization: string | null): Test =>
      authorized(call, authorization)
        .set('Content-Type', 'application/json')
        .send('{"role": "staff"')

    it('answers a body it cannot read before it looks at the token or the permission, as every route does', async () => {
      const refused = await member('manager')(salonId, salonId)
      const path = invitationOf(salonId, staffId)

      const responses = [
        await notJson(request(app).post(path), null),
        await authorized(request(app).post(path), null)
          .set('Content-Type', 'text/plain')
          .send('staff'),
        await notJson(request(app).post(path), refused),
        await notJson(
          request(app).post(invitationOf('latest', 'latest')),
          refused,
        ),
        await notJson(request(app).post(path), asAdmin),
        await authorized(request(app).post(path), asAdmin)
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('role=staff'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '415 2002',
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect(await storedInvitations()).toEqual([])
      expect(mails).toEqual([])
    })

    it('checks an invitation in order: the token, the salon ID, the permission for the salon, the staff ID, the body, the permission for the role, the salon, the staff member, the account, the activity, the 60 seconds', async () => {
      const refused = await member('manager')(salonId, salonId)
      const ownerOfSalon = await member('owner')(salonId, salonId)
      const linkedAndInactive = (
        await insertMember(db, 'staff', salonId, { isActive: false })
      ).staffId
      const inactive = await insertStaffRow(salonId, { isActive: false })
      const invalid = { role: 'nobody' }
      const ofOwner = { role: 'owner' }
      const valid = { role: 'staff' }

      const outcomes = [
        await post(invalid, null, 'latest', 'latest'),
        await post(invalid, refused, 'latest', 'latest'),
        await post(invalid, refused, 'latest', UNKNOWN_ID),
        await post(invalid, refused, 'latest'),
        await post(invalid, asAdmin, 'latest', UNKNOWN_ID),
        await post(invalid, asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await post(invalid, ownerOfSalon, UNKNOWN_ID),
        await post(ofOwner, ownerOfSalon, UNKNOWN_ID),
        await post(ofOwner, asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await post(ofOwner, asAdmin, UNKNOWN_ID),
        await post(valid, ownerOfSalon, UNKNOWN_ID),
        await post(valid, asAdmin, linkedAndInactive),
        await post(valid, asAdmin, inactive),
        await post(valid, asAdmin),
        await post(valid, asAdmin),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '400 salonId:invalid_format',
        '403',
        '403',
        '400 id:invalid_format',
        '400 role:invalid_value',
        '400 role:invalid_value',
        '403',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `409 Staff member ${linkedAndInactive} already has an account`,
        `409 Staff member ${inactive} is inactive`,
        '201',
        `409 An invitation was mailed to staff member ${staffId} moments ago`,
      ])
    })

    it.each<['get' | 'delete']>([['get'], ['delete']])(
      'checks a %s in order: the token, the salon ID, the permission, the staff ID, the salon, the staff member, the invitation',
      async (method) => {
        const refused = await member('manager')(salonId, salonId)
        const call = (
          as: string | null,
          id: string = staffId,
          salon: string = salonId,
        ) => (method === 'get' ? get(as, id, salon) : remove(as, id, salon))
        const neverInvited = await insertStaffRow()
        await invite()

        const outcomes = [
          await call(null, 'latest', 'latest'),
          await call(refused, 'latest', 'latest'),
          await call(refused, 'latest', UNKNOWN_ID),
          await call(refused, 'latest'),
          await call(asAdmin, 'latest', UNKNOWN_ID),
          await call(asAdmin, UNKNOWN_ID, UNKNOWN_ID),
          await call(asAdmin, UNKNOWN_ID),
          await call(asAdmin, neverInvited),
          await call(asAdmin),
        ].map(outcomeOf)

        expect(outcomes).toEqual([
          '401',
          '400 salonId:invalid_format',
          '403',
          '403',
          '400 id:invalid_format',
          `404 Salon ${UNKNOWN_ID} was not found`,
          `404 Staff member ${UNKNOWN_ID} was not found`,
          `404 Invitation of staff member ${neverInvited} was not found`,
          method === 'get' ? '200' : '204',
        ])
      },
    )
  })

  describe('POST /api/v1/auth/staff-invitation/verify', () => {
    it('returns the invitation of the token and where to accept it, to anyone who holds the token, and no cache may keep it', async () => {
      const { token, ...invitation } = await invite('manager')

      const response = await verify(token)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.body).toEqual({
        data: invitation,
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { accept: ACCEPT },
      })
      expect(response.text).not.toContain(token)
      expect(response.text).not.toContain(sha256(token))
    })

    it('does not use the token up and changes nothing', async () => {
      const { token } = await invite()
      const before = await stored()

      const responses = [await verify(token), await verify(token)]

      expect(responses.map(({ status }) => status)).toEqual([200, 200])
      expect(await stored()).toEqual(before)
      expect(mails).toHaveLength(1)
      expect((await accept(token)).status).toBe(204)
    })

    it('needs no access token, and takes none into account', async () => {
      const { token } = await invite()
      const outsider = await signedInUser(app, db)

      const responses = [
        await verify(token),
        await request(app)
          .post(VERIFY)
          .set('Authorization', outsider.authorization)
          .send({ token }),
        await request(app)
          .post(VERIFY)
          .set('Authorization', `Bearer ${'t'.repeat(43)}`)
          .send({ token }),
      ]

      expect(responses.map(({ status }) => status)).toEqual([200, 200, 200])
    })

    it('works until the token ends: with a minute left it does', async () => {
      const { token } = await invite()
      await age(WEEK_SECONDS - 60)

      expect((await verify(token)).status).toBe(200)
    })

    it.each(unusable)(
      'refuses %s with the one answer of a token that cannot be used',
      async (_case, arrange) => {
        const token = await arrange(await invite())
        const before = await stored()

        const response = await verify(token)

        expectTokenRefused(response)
        expect(problemOf(response)).toEqual(
          problemOf(await verify('n'.repeat(43))),
        )
        expect(await stored()).toEqual(before)
      },
    )

    it('works again once the staff member is as they were when invited', async () => {
      const { token } = await invite()
      await changeStaff({ isActive: false, email: 'renamed@example.com' })
      expectTokenRefused(await verify(token))

      await changeStaff({ isActive: true, email: INVITED })

      expect((await verify(token)).status).toBe(200)
    })

    it.each(accountsInTheWay)(
      'tells the holder of the token with 409 that the address has %s',
      async (_case, accountOf) => {
        const { token } = await invite()
        await insertUser(db, { email: INVITED, ...(await accountOf()) })
        const before = await stored()

        const response = await verify(token)

        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(
          `User with email ${INVITED} already exists`,
        )
        expect(response.headers['cache-control']).toBe('no-store')
        expect(await stored()).toEqual(before)
      },
    )

    it.each<[string, () => Promise<unknown>]>([
      [
        'a registration that never confirmed it',
        () => insertRegistered(INVITED),
      ],
      [
        'a deleted account',
        () =>
          insertUser(db, {
            email: INVITED,
            deletedAt: '2026-11-01T00:00:00.000Z',
          }),
      ],
      [
        'an account under another address that differs by a letter',
        () => insertUser(db, { email: 'invited2@example.com' }),
      ],
    ])(
      'returns the invitation when the address has %s',
      async (_case, arrange) => {
        const { token } = await invite()
        await arrange()

        expect((await verify(token)).status).toBe(200)
      },
    )

    it.each<[string, unknown, string[]]>([
      ['a missing token', {}, ['token:invalid_type']],
      ['an empty token', { token: '' }, ['token:too_small']],
      [
        'a token over 255 characters',
        { token: 'i'.repeat(256) },
        ['token:too_big'],
      ],
      ['a token that is a number', { token: 43 }, ['token:invalid_type']],
      [
        'a password next to the token',
        { token: 'i'.repeat(43), password: NEW_PASSWORD },
        ['password:unrecognized_keys'],
      ],
      ['a body that is a list', ['i'.repeat(43)], [':invalid_type']],
    ])('rejects %s with 400', async (_case, body, expected) => {
      const response = await request(app)
        .post(VERIFY)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(body))

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid staff invitation')
      expect(brokenRules(response)).toEqual(expected)
      expect(response.headers['cache-control']).toBe('no-store')
    })

    it('rejects a body it cannot read', async () => {
      const responses = [
        await request(app)
          .post(VERIFY)
          .set('Content-Type', 'application/json')
          .send('{"token": "'),
        await request(app)
          .post(VERIFY)
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(`token=${'i'.repeat(43)}`),
      ]

      expect(responses.map(statusAndCode)).toEqual(['400 2002', '415 2002'])
    })
  })

  describe('POST /api/v1/auth/staff-invitation/accept', () => {
    it('creates the account of the invitation with the password of its holder, links it to the staff member, and uses the invitation up: 204 without a body', async () => {
      const { token } = await invite('manager')
      const usersBefore = await db.$count(users)
      const staffBefore = await staffRow()
      const before = Date.now()

      const response = await accept(token)
      const after = Date.now()

      expectNoContent(response)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(await db.$count(users)).toBe(usersBefore + 1)
      const account = await liveUser(INVITED)
      expect(account).toMatchObject({
        id: expect.stringMatching(UUID),
        email: INVITED,
        passwordHash: expect.stringMatching(ARGON2ID),
        role: 'manager',
        status: 'active',
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiry: null,
        passwordResetTokenHash: null,
        passwordResetExpiry: null,
        twoFactorStatus: 'disabled',
        twoFactorSecret: null,
        backupCodes: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        customerId: null,
        staffId,
        deletedAt: null,
      })
      const [times] = await db
        .select({ lastPasswordChange: epochMs(users.lastPasswordChange) })
        .from(users)
        .where(eq(users.id, account.id))
      expect(times?.lastPasswordChange).toBeGreaterThanOrEqual(before)
      expect(times?.lastPasswordChange).toBeLessThanOrEqual(after)

      const member = await staffRow()
      expect(member).toEqual({
        ...staffBefore,
        userId: account.id,
        updatedAt: expect.any(String),
      })
      expect(Date.parse(member.updatedAt)).toBeGreaterThan(
        Date.parse(staffBefore.updatedAt),
      )
      expect(await storedInvitations()).toEqual([])
      // Nobody is signed in by it, and nothing more is mailed.
      expect(await db.$count(sessions, eq(sessions.userId, account.id))).toBe(0)
      expect(mails).toHaveLength(1)
    })

    it.each(ROLES)(
      'gives the account the role %s of the invitation',
      async (role) => {
        const { token } = await invite(role)

        expectNoContent(await accept(token))

        expect((await liveUser(INVITED)).role).toBe(role)
      },
    )

    it('makes an account that signs in with the password and has the role at the salon', async () => {
      const colleague = await insertStaffRow()
      const { token } = await invite('owner')
      expectNoContent(await accept(token))

      const wrong = await login(INVITED, OTHER_PASSWORD)
      const session = await signIn(app, INVITED, { password: NEW_PASSWORD })
      const ledger = await request(app)
        .get(staffOf(salonId, staffId))
        .set('Authorization', session.authorization)
      const invited = await post(
        { role: 'staff' },
        session.authorization,
        colleague,
      )

      expect(wrong.status).toBe(401)
      expect(session.user).toMatchObject({ email: INVITED, role: 'owner' })
      expect(ledger.status).toBe(200)
      expect(ledger.body.data.userId).toBe((await liveUser(INVITED)).id)
      expect(invited.status).toBe(201)
    })

    it('lets an admin start a salon: the first owner is invited by the admin, and the owner invites a manager who then plans the schedules and invites nobody', async () => {
      const startedSalon = await insertSalon(db, { name: 'New Salon' })
      const first = await insertStaffRow(startedSalon, {
        email: 'first-owner@example.com',
      })
      const second = await insertStaffRow(startedSalon, {
        email: 'first-manager@example.com',
      })

      const ofOwner = await invite('owner', first, startedSalon)
      expectNoContent(await accept(ofOwner.token))
      const asOwner = (
        await signIn(app, 'first-owner@example.com', { password: NEW_PASSWORD })
      ).authorization
      const created = await post(
        { role: 'manager' },
        asOwner,
        second,
        startedSalon,
      )
      expect(created.status).toBe(201)
      expectNoContent(
        await accept(
          tokenMailedTo('first-manager@example.com'),
          OTHER_PASSWORD,
        ),
      )
      const asManager = (
        await signIn(app, 'first-manager@example.com', {
          password: OTHER_PASSWORD,
        })
      ).authorization

      const schedules = await request(app)
        .get(`${staffOf(startedSalon, first)}/schedules`)
        .set('Authorization', asManager)
      const refused = await get(asManager, first, startedSalon)
      const elsewhere = await get(asOwner)

      expect(schedules.status).toBe(200)
      expectProblem(refused, forbidden)
      expectProblem(elsewhere, forbidden)
    })

    it('works once: the token is refused afterwards, and the staff member cannot be invited again', async () => {
      const { token } = await invite()
      expectNoContent(await accept(token))
      const before = await stored()

      const again = await accept(token, OTHER_PASSWORD)
      const verified = await verify(token)
      const invitedAgain = await post({ role: 'manager' })

      expectTokenRefused(again)
      expectTokenRefused(verified)
      expectProblem(invitedAgain, notAllowed)
      expect(invitedAgain.body.detail).toBe(
        `Staff member ${staffId} already has an account`,
      )
      expect(await stored()).toEqual(before)
      expect((await login(INVITED, NEW_PASSWORD)).status).toBe(200)
      expect((await login(INVITED, OTHER_PASSWORD)).status).toBe(401)
    })

    it('needs no access token, and takes none into account', async () => {
      const { token } = await invite()
      const outsider = await signedInUser(app, db)

      const response = await request(app)
        .post(ACCEPT)
        .set('Authorization', outsider.authorization)
        .send({ token, password: NEW_PASSWORD })

      expectNoContent(response)
      expect((await liveUser(INVITED)).staffId).toBe(staffId)
      expect((await liveUser(outsider.email)).staffId).toBeNull()
    })

    it('works until the token ends: with a minute left it does', async () => {
      const { token } = await invite()
      await age(WEEK_SECONDS - 60)

      expectNoContent(await accept(token))
    })

    it.each(unusable)(
      'refuses %s with the one answer of a token that cannot be used, and writes nothing',
      async (_case, arrange) => {
        const token = await arrange(await invite())
        const before = await stored()

        const response = await accept(token)

        expectTokenRefused(response)
        expect(problemOf(response)).toEqual(
          problemOf(await accept('n'.repeat(43))),
        )
        expect(await stored()).toEqual(before)
        expect(await liveUsersWith(INVITED)).toEqual([])
      },
    )

    it('works again once the staff member is as they were when invited', async () => {
      const { token } = await invite()
      await changeStaff({ isActive: false, email: 'renamed@example.com' })
      expectTokenRefused(await accept(token))

      await changeStaff({ isActive: true, email: INVITED })

      expectNoContent(await accept(token))
    })

    it.each(accountsInTheWay)(
      'tells the holder of the token with 409 that the address has %s, writes nothing and leaves the invitation',
      async (_case, accountOf) => {
        const { token } = await invite()
        const existing = await insertUser(db, {
          email: INVITED,
          ...(await accountOf()),
        })
        await insertSession(db, existing.id)
        const before = await stored()

        const response = await accept(token)

        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(
          `User with email ${INVITED} already exists`,
        )
        expect(response.headers['cache-control']).toBe('no-store')
        expect(await stored()).toEqual(before)
        expect((await staffRow()).userId).toBeNull()
      },
    )

    it('can be answered by another address: the ledger gets it, a new invitation is mailed there, and that one works', async () => {
      const first = await invite()
      const existing = await insertUser(db, { email: INVITED })
      expectProblem(await accept(first.token), alreadyExists)

      await changeStaff({ email: 'work@example.com' })
      await age(61)
      const second = await invite()

      expectNoContent(await accept(second.token))
      expect((await liveUser('work@example.com')).staffId).toBe(staffId)
      expect((await liveUser(INVITED)).id).toBe(existing.id)
      expect((await liveUser(INVITED)).staffId).toBeNull()
    })

    it('makes a registration that never confirmed the address the account of the invitation: the password of the registration, its token and its sessions are gone', async () => {
      const registration = await request(app)
        .post(REGISTER)
        .send({ email: INVITED, password: OTHER_PASSWORD })
      expect(registration.status).toBe(204)
      const registered = await liveUser(INVITED)
      const [verificationMail] = mails.filter(({ to }) => to === INVITED)
      const verificationToken =
        verificationMail?.text.match(/#token=([A-Za-z0-9_-]+)/)?.[1] ?? ''
      expect(registered.emailVerificationTokenHash).toBe(
        sha256(verificationToken),
      )
      const leftover = await insertSession(db, registered.id)
      const { token } = await invite('manager')
      const usersBefore = await db.$count(users)

      const response = await accept(token)

      expectNoContent(response)
      expect(await db.$count(users)).toBe(usersBefore)
      const account = await liveUser(INVITED)
      expect(account).toMatchObject({
        id: registered.id,
        role: 'manager',
        status: 'active',
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiry: null,
        passwordResetTokenHash: null,
        passwordResetExpiry: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        customerId: null,
        staffId,
      })
      expect(account.passwordHash).not.toBe(registered.passwordHash)
      expect(Date.parse(account.updatedAt)).toBeGreaterThan(
        Date.parse(registered.updatedAt),
      )
      expect((await staffRow()).userId).toBe(registered.id)
      expect(
        await db.$count(sessions, eq(sessions.userId, registered.id)),
      ).toBe(0)
      expect(
        (
          await request(app)
            .get(`${AUTH}/me`)
            .set('Authorization', leftover.authorization)
        ).status,
      ).toBe(401)
      expect((await login(INVITED, OTHER_PASSWORD)).status).toBe(401)
      expect((await login(INVITED, NEW_PASSWORD)).status).toBe(200)
      const confirmed = await request(app)
        .post(CONFIRM_VERIFICATION)
        .send({ token: verificationToken })
      expect(confirmed.status).toBe(400)
      expect(brokenRules(confirmed)).toEqual(['token:invalid_token'])
    })

    it('unlocks a registration that wrong guesses had locked when it becomes the account', async () => {
      await insertRegistered(INVITED, {
        failedLoginAttempts: 5,
        lockedUntil: minutesFromNow(15),
        passwordResetTokenHash: sha256('reset of the registration'),
        passwordResetExpiry: minutesFromNow(30),
      })
      const { token } = await invite()

      expectNoContent(await accept(token))

      expect(await liveUser(INVITED)).toMatchObject({
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordResetTokenHash: null,
        passwordResetExpiry: null,
        staffId,
      })
      expect((await login(INVITED, NEW_PASSWORD)).status).toBe(200)
    })

    it('creates a new account next to a deleted one that had the address', async () => {
      const deleted = await insertUser(db, {
        email: INVITED,
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      const { token } = await invite()

      expectNoContent(await accept(token))

      const account = await liveUser(INVITED)
      expect(account.id).not.toBe(deleted.id)
      expect(account.staffId).toBe(staffId)
      const [untouched] = await db
        .select()
        .from(users)
        .where(eq(users.id, deleted.id))
      expect(untouched).toMatchObject({
        staffId: null,
        deletedAt: expect.any(String),
      })
    })

    it.each<[string, unknown, string[]]>([
      ['a missing token', { password: NEW_PASSWORD }, ['token:invalid_type']],
      [
        'a missing password',
        { token: 'i'.repeat(43) },
        ['password:invalid_type'],
      ],
      [
        'an empty token',
        { token: '', password: NEW_PASSWORD },
        ['token:too_small'],
      ],
      [
        'a token over 255 characters',
        { token: 'i'.repeat(256), password: NEW_PASSWORD },
        ['token:too_big'],
      ],
      [
        'a password of 14 characters',
        { token: 'i'.repeat(43), password: 'violet tram un' },
        ['password:too_small'],
      ],
      [
        'a password of 129 characters',
        { token: 'i'.repeat(43), password: '🌸'.repeat(129) },
        ['password:too_big'],
      ],
      [
        'a role of its own',
        { token: 'i'.repeat(43), password: NEW_PASSWORD, role: 'owner' },
        ['role:unrecognized_keys'],
      ],
      [
        'an address of its own',
        { token: 'i'.repeat(43), password: NEW_PASSWORD, email: INVITED },
        ['email:unrecognized_keys'],
      ],
      [
        'the name the password has in a reset',
        { token: 'i'.repeat(43), newPassword: NEW_PASSWORD },
        ['password:invalid_type', 'newPassword:unrecognized_keys'],
      ],
      [
        'a body that is a list',
        ['i'.repeat(43), NEW_PASSWORD],
        [':invalid_type'],
      ],
    ])(
      'rejects %s with 400 before it looks at the token',
      async (_case, body, expected) => {
        const response = await request(app)
          .post(ACCEPT)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(body))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid staff invitation')
        expect(brokenRules(response)).toEqual(expected)
        expect(response.headers['cache-control']).toBe('no-store')
      },
    )

    it.each<[string, string]>([
      ['a well-known long password', 'correct horse battery staple'],
      ['a password that is the address', 'Invited@Example.com'],
    ])(
      'rejects %s with 400, and the invitation still works with another one',
      async (_case, password) => {
        const { token } = await invite()
        const before = await stored()

        const response = await accept(token, password)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid staff invitation')
        expect(brokenRules(response)).toEqual(['password:blocklisted'])
        expect(await stored()).toEqual(before)
        expectNoContent(await accept(token))
      },
    )

    it('rejects a body it cannot read', async () => {
      const { token } = await invite()

      const responses = [
        await request(app)
          .post(ACCEPT)
          .set('Content-Type', 'application/json')
          .send(`{"token": "${token}", "password": `),
        await request(app)
          .post(ACCEPT)
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(`token=${token}&password=${NEW_PASSWORD}`),
      ]

      expect(responses.map(statusAndCode)).toEqual(['400 2002', '415 2002'])
      expect(await liveUsersWith(INVITED)).toEqual([])
    })

    it('checks in order: the body, the token, the account of the address, the password', async () => {
      const { token } = await invite()
      const common = 'correct horse battery staple'
      const colleague = await insertStaffRow(salonId, {
        email: 'taken@example.com',
      })
      await insertUser(db, { email: 'taken@example.com' })
      const ofTaken = await invite('staff', colleague)

      const outcomes = [
        await accept('n'.repeat(43), 'short'),
        await accept('n'.repeat(43), common),
        await accept(ofTaken.token, common),
        await accept(token, common),
        await accept(token),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '400 password:too_small',
        '400 token:invalid_token',
        '409 User with email taken@example.com already exists',
        '400 password:blocklisted',
        '204',
      ])
    })
  })

  describe('requests at the same moment', () => {
    it('lets one of several acceptances of one token create the account, and refuses the others', async () => {
      for (let round = 0; round < 4; round += 1) {
        const email = `race-${round}@example.com`
        const invitee = await insertStaffRow(salonId, { email })
        const { token } = await invite('staff', invitee)

        const responses = await Promise.all([
          accept(token, NEW_PASSWORD),
          accept(token, OTHER_PASSWORD),
          accept(token, NEW_PASSWORD),
        ])

        expect(responses.map(({ status }) => status).sort()).toEqual([
          204, 400, 400,
        ])
        for (const response of responses) {
          if (response.status === 400) {
            expectTokenRefused(response)
          }
        }
        const account = await liveUser(email)
        expect(account.staffId).toBe(invitee)
        expect((await staffRow(invitee)).userId).toBe(account.id)
        // The password is the one of the request that was accepted.
        const winner = responses.findIndex(({ status }) => status === 204)
        const password = winner === 1 ? OTHER_PASSWORD : NEW_PASSWORD
        const other = winner === 1 ? NEW_PASSWORD : OTHER_PASSWORD
        expect((await login(email, password)).status).toBe(200)
        expect((await login(email, other)).status).toBe(401)
      }
      expect(await storedInvitations()).toEqual([])
    })

    it('stores and mails one of several invitations of one staff member that arrive together, and answers the others that one was mailed moments ago', async () => {
      for (let round = 0; round < 4; round += 1) {
        const email = `race-${round}@example.com`
        const invitee = await insertStaffRow(salonId, { email })

        const responses = await Promise.all([
          post({ role: 'staff' }, asAdmin, invitee),
          post({ role: 'manager' }, asAdmin, invitee),
          post({ role: 'owner' }, asAdmin, invitee),
          post({ role: 'staff' }, asAdmin, invitee),
        ])

        expect(responses.map(({ status }) => status).sort()).toEqual([
          201, 409, 409, 409,
        ])
        const created = responses.find(({ status }) => status === 201)
        for (const response of responses) {
          if (response.status === 409) {
            expect(response.body.detail).toBe(
              `An invitation was mailed to staff member ${invitee} moments ago`,
            )
          }
        }
        expect(
          (await storedInvitations()).filter(
            ({ staffId: holder }) => holder === invitee,
          ),
        ).toEqual([
          expect.objectContaining({
            id: created?.body.data.id,
            role: created?.body.data.role,
            tokenHash: sha256(tokenMailedTo(email)),
          }),
        ])
        expect(invitationMailsTo(email)).toHaveLength(1)
      }
    })

    it('answers an acceptance that meets the taking back with 204 or 400, and the account is there exactly when it was accepted', async () => {
      for (let round = 0; round < 5; round += 1) {
        const email = `race-${round}@example.com`
        const invitee = await insertStaffRow(salonId, { email })
        const { token } = await invite('staff', invitee)

        const [accepted, removed] = await Promise.all([
          accept(token),
          remove(asAdmin, invitee),
        ])

        expect([
          [204, 404],
          [400, 204],
        ]).toContainEqual([accepted.status, removed.status])
        expect(await liveUsersWith(email)).toHaveLength(
          accepted.status === 204 ? 1 : 0,
        )
        expect((await staffRow(invitee)).userId === null).toBe(
          accepted.status !== 204,
        )
      }
      expect(await storedInvitations()).toEqual([])
    })

    it('answers an acceptance that meets a new invitation with 204 or 400, and the new invitation with 409 or 201', async () => {
      for (let round = 0; round < 5; round += 1) {
        const email = `race-${round}@example.com`
        const invitee = await insertStaffRow(salonId, { email })
        const { token } = await invite('staff', invitee)
        await age(61, invitee)

        const [accepted, invitedAgain] = await Promise.all([
          accept(token),
          post({ role: 'manager' }, asAdmin, invitee),
        ])

        expect([
          [204, 409],
          [400, 201],
        ]).toContainEqual([accepted.status, invitedAgain.status])
        const accounts = await liveUsersWith(email)
        expect(accounts.map(({ role }) => role)).toEqual(
          accepted.status === 204 ? ['staff'] : [],
        )
        expect(
          (await storedInvitations()).filter(
            ({ staffId: holder }) => holder === invitee,
          ),
        ).toHaveLength(accepted.status === 204 ? 0 : 1)
      }
    })

    it('answers an acceptance that meets the deletion of the staff member with 204 or 400, and no account is made for a staff member who was deleted first', async () => {
      for (let round = 0; round < 5; round += 1) {
        const email = `race-${round}@example.com`
        const invitee = await insertStaffRow(salonId, { email })
        const { token } = await invite('staff', invitee)

        const [accepted, deleted] = await Promise.all([
          accept(token),
          request(app)
            .delete(staffOf(salonId, invitee))
            .set('Authorization', asAdmin),
        ])

        expect(deleted.status).toBe(204)
        expect([204, 400]).toContain(accepted.status)
        expect(await liveUsersWith(email)).toHaveLength(
          accepted.status === 204 ? 1 : 0,
        )
      }
    })

    it('waits for a change of the staff member that is under way, then creates no account and refuses the token', async () => {
      const { token } = await invite()
      const before = await stored()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(staff)
          .set({ isActive: false })
          .where(eq(staff.id, staffId))
        // The request is under way while the change is not committed yet.
        const underWay = accept(token).then((response) => response)
        await new Promise((resolve) => setTimeout(resolve, 300))

        return { pending: underWay }
      })
      const response = await pending

      expectTokenRefused(response)
      expect(await liveUsersWith(INVITED)).toEqual([])
      expect((await stored()).invitations).toEqual(before.invitations)
    })

    it('waits for an invitation that is under way in the place of this one, then refuses the token of the one before', async () => {
      const first = await invite()
      const replacement: NewInvitation = {
        staffId,
        email: INVITED,
        role: 'manager',
        tokenHash: sha256('the token of the replacement'),
        expiresAt: minutesFromNow(60),
      }

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, staffId))
          .for('update')
        await tx
          .delete(staffInvitations)
          .where(eq(staffInvitations.staffId, staffId))
        await tx.insert(staffInvitations).values(replacement)
        const underWay = accept(first.token).then((response) => response)
        await new Promise((resolve) => setTimeout(resolve, 300))

        return { pending: underWay }
      })
      const response = await pending

      expectTokenRefused(response)
      expect(await liveUsersWith(INVITED)).toEqual([])
      expect((await storedInvitations()).map(({ role }) => role)).toEqual([
        'manager',
      ])
    })

    it('waits for an acceptance that is under way before it invites again, then answers that the staff member has an account', async () => {
      const { token } = await invite()
      await age(61)

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, staffId))
          .for('update')
        const [account] = await tx
          .insert(users)
          .values({
            email: INVITED,
            passwordHash: 'not a hash',
            role: 'staff',
            status: 'active',
            emailVerified: true,
            staffId,
          })
          .returning({ id: users.id })
        await tx
          .update(staff)
          .set({ userId: account?.id ?? null })
          .where(eq(staff.id, staffId))
        await tx
          .delete(staffInvitations)
          .where(eq(staffInvitations.staffId, staffId))
        const underWay = post({ role: 'manager' }).then((response) => response)
        await new Promise((resolve) => setTimeout(resolve, 300))

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        `Staff member ${staffId} already has an account`,
      )
      expect(await storedInvitations()).toEqual([])
      expect(invitationMailsTo(INVITED)).toHaveLength(1)
      expectTokenRefused(await verify(token))
    })

    it('lets an acceptance wait for a taking back that is under way, then refuses the token and creates no account', async () => {
      const { token } = await invite()

      const { revoking, accepting } = await db.transaction(async (tx) => {
        // The row of the invitation is held, so the taking back stops
        // where it removes the invitation, with the staff member locked,
        // and the acceptance waits for the staff member.
        await tx
          .select({ id: staffInvitations.id })
          .from(staffInvitations)
          .where(eq(staffInvitations.staffId, staffId))
          .for('update')
        const takingBack = remove().then((response) => response)
        await new Promise((resolve) => setTimeout(resolve, 300))
        const acceptance = accept(token).then((response) => response)
        await new Promise((resolve) => setTimeout(resolve, 700))

        return { revoking: takingBack, accepting: acceptance }
      })

      expectNoContent(await revoking)
      expectTokenRefused(await accepting)
      expect(await liveUsersWith(INVITED)).toEqual([])
      expect((await staffRow()).userId).toBeNull()
      expect(await storedInvitations()).toEqual([])
    })

    it('makes one account when an acceptance meets a registration with the same address, and it is the one of the invitation', async () => {
      for (let round = 0; round < 5; round += 1) {
        const email = `race-${round}@example.com`
        const invitee = await insertStaffRow(salonId, { email })
        const { token } = await invite('manager', invitee)

        const [accepted, registered] = await Promise.all([
          accept(token),
          request(app).post(REGISTER).send({ email, password: OTHER_PASSWORD }),
        ])

        expect(accepted.status).toBe(204)
        expect(registered.status).toBe(204)
        expect(await liveUser(email)).toMatchObject({
          role: 'manager',
          status: 'active',
          emailVerified: true,
          emailVerificationTokenHash: null,
          staffId: invitee,
        })
        expect((await login(email, NEW_PASSWORD)).status).toBe(200)
        expect((await login(email, OTHER_PASSWORD)).status).toBe(401)
      }
    })

    it('makes one account when the staff members of two salons with one address accept together, and tells the other one that the address has an account', async () => {
      for (let round = 0; round < 4; round += 1) {
        const email = `race-${round}@example.com`
        const otherSalon = await insertSalon(db)
        const here = await insertStaffRow(salonId, { email })
        const there = await insertStaffRow(otherSalon, { email })
        const first = await invite('manager', here)
        const second = await invite('staff', there, otherSalon)
        expect(second.token).not.toBe(first.token)

        const [accepted, acceptedThere] = await Promise.all([
          accept(first.token),
          accept(second.token),
        ])

        expect([accepted.status, acceptedThere.status].sort()).toEqual([
          204, 409,
        ])
        const account = await liveUser(email)
        const [winner, loser] =
          accepted.status === 204 ? [here, there] : [there, here]
        expect(account.staffId).toBe(winner)
        expect(account.role).toBe(accepted.status === 204 ? 'manager' : 'staff')
        expect((await staffRow(winner)).userId).toBe(account.id)
        expect((await staffRow(loser)).userId).toBeNull()
        // The invitation that was not accepted is still held.
        expect(
          (await storedInvitations()).filter(
            ({ email: address }) => address === email,
          ),
        ).toEqual([expect.objectContaining({ staffId: loser })])
      }
    })
  })

  describe('StaffInvitationRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new StaffInvitationRepository(db)
    const salon = (id: string) => salonIdSchema.parse(id)
    const member = (id: string) => staffIdSchema.parse(id)

    /** Stores an invitation of the staff member under test as a row. */
    const insertInvitation = async (
      overrides: Partial<NewInvitation> = {},
    ): Promise<{ token: string; tokenHash: string }> => {
      const token = `token-${randomUUID()}`
      await db.insert(staffInvitations).values({
        staffId,
        email: INVITED,
        role: 'staff',
        tokenHash: sha256(token),
        expiresAt: '2026-12-01T00:00:00.000Z',
        ...overrides,
      })
      return { token, tokenHash: sha256(token) }
    }

    describe('issue', () => {
      const issue = (
        tokenHash: string,
        mailedMomentsAgoIfEndingAfter: string,
        expiresAt = '2026-12-08T00:00:00.000Z',
      ) =>
        repository().issue(salon(salonId), member(staffId), {
          role: 'manager',
          token: { tokenHash, expiresAt },
          mailedMomentsAgoIfEndingAfter,
        })

      it('resolves to the stored invitation and the name of the salon', async () => {
        const issued = dataOf(
          await issue(sha256('new'), '2026-12-07T23:59:00.000Z'),
        )

        expect(issued).toEqual({
          type: 'issued',
          invitation: {
            id: expect.stringMatching(UUID),
            staffId,
            email: INVITED,
            role: 'manager',
            tokenHash: sha256('new'),
            expiresAt: expect.any(String),
            createdAt: expect.any(String),
          },
          salonName: SALON_NAME,
        })
        expect((await storedInvitations()).map(({ endsAt }) => endsAt)).toEqual(
          [Date.parse('2026-12-08T00:00:00.000Z')],
        )
      })

      it('counts an invitation as mailed moments ago when it ends after the given instant, and not when it ends at it', async () => {
        await insertInvitation({ expiresAt: '2026-12-01T00:00:00.000Z' })

        const sooner = dataOf(
          await issue(sha256('a'), '2026-11-30T23:59:59.999Z'),
        )
        const atTheInstant = dataOf(
          await issue(sha256('b'), '2026-12-01T00:00:00.000Z'),
        )

        expect(sooner).toEqual({ type: 'mailedMomentsAgo' })
        expect(atTheInstant.type).toBe('issued')
        expect(
          (await storedInvitations()).map(({ tokenHash }) => tokenHash),
        ).toEqual([sha256('b')])
      })

      it('resolves to what stands in the way, and stores nothing', async () => {
        const otherSalon = await insertSalon(db)
        const linked = (await insertMember(db, 'staff', salonId)).staffId
        const inactive = await insertStaffRow(salonId, { isActive: false })
        const issueFor = (salonOfPath: string, id: string) =>
          repository().issue(salon(salonOfPath), member(id), {
            role: 'staff',
            token: {
              tokenHash: sha256(`for ${id} of ${salonOfPath}`),
              expiresAt: '2026-12-08T00:00:00.000Z',
            },
            mailedMomentsAgoIfEndingAfter: '2026-12-07T23:59:00.000Z',
          })

        const outcomes = [
          dataOf(await issueFor(salonId, UNKNOWN_ID)),
          dataOf(await issueFor(otherSalon, staffId)),
          dataOf(await issueFor(salonId, linked)),
          dataOf(await issueFor(salonId, inactive)),
        ]

        expect(outcomes).toEqual([
          { type: 'staffNotFound' },
          { type: 'staffNotFound' },
          { type: 'linked' },
          { type: 'inactive' },
        ])
        expect(await storedInvitations()).toEqual([])
      })
    })

    describe('findUsable', () => {
      it('resolves to the invitation until the instant it ends, and to nothing from that instant on', async () => {
        const { tokenHash } = await insertInvitation({
          expiresAt: '2026-12-01T00:00:00.000Z',
        })

        const before = dataOf(
          await repository().findUsable(tokenHash, '2026-11-30T23:59:59.999Z'),
        )
        const atTheEnd = dataOf(
          await repository().findUsable(tokenHash, '2026-12-01T00:00:00.000Z'),
        )

        expect(before).toMatchObject({
          type: 'usable',
          invitation: { staffId, email: INVITED, role: 'staff', tokenHash },
        })
        expect(atTheEnd).toEqual({ type: 'unusable' })
      })

      it('resolves to the invitation with the account that keeps its address', async () => {
        const { tokenHash } = await insertInvitation()
        await insertUser(db, { email: INVITED })

        const found = dataOf(
          await repository().findUsable(tokenHash, '2026-11-20T00:00:00.000Z'),
        )

        expect(found).toMatchObject({
          type: 'accountExists',
          invitation: { staffId, email: INVITED },
        })
      })
    })

    describe('accept', () => {
      const acceptance = (at: string) => ({
        passwordHash: 'the hash of a password',
        at,
      })

      it('creates the account at the given instant and resolves to accepted', async () => {
        const { tokenHash } = await insertInvitation({ role: 'owner' })

        const accepted = dataOf(
          await repository().accept(
            tokenHash,
            acceptance('2026-11-20T03:04:05.678Z'),
          ),
        )

        expect(accepted).toEqual({ type: 'accepted' })
        const account = await liveUser(INVITED)
        expect(account).toMatchObject({
          passwordHash: 'the hash of a password',
          role: 'owner',
          status: 'active',
          emailVerified: true,
          staffId,
        })
        expect(Date.parse(account.lastPasswordChange ?? '')).toBe(
          Date.parse('2026-11-20T03:04:05.678Z'),
        )
        expect((await staffRow()).userId).toBe(account.id)
        expect(await storedInvitations()).toEqual([])
      })

      it('resolves to unusable from the instant the token ends on, and writes nothing', async () => {
        const { tokenHash } = await insertInvitation({
          expiresAt: '2026-12-01T00:00:00.000Z',
        })
        const before = await stored()

        const accepted = dataOf(
          await repository().accept(
            tokenHash,
            acceptance('2026-12-01T00:00:00.000Z'),
          ),
        )

        expect(accepted).toEqual({ type: 'unusable' })
        expect(await stored()).toEqual(before)
      })

      it('resolves to accountExists when the address got an account since it was looked at, and writes nothing', async () => {
        const { tokenHash } = await insertInvitation()
        const usable = dataOf(
          await repository().findUsable(tokenHash, '2026-11-20T00:00:00.000Z'),
        )
        await insertUser(db, { email: INVITED })
        const before = await stored()

        const accepted = dataOf(
          await repository().accept(
            tokenHash,
            acceptance('2026-11-20T00:00:01.000Z'),
          ),
        )

        expect(usable.type).toBe('usable')
        expect(accepted).toEqual({ type: 'accountExists' })
        expect(await stored()).toEqual(before)
      })

      it('resolves to unusable for a token nobody holds', async () => {
        await insertInvitation()

        const accepted = dataOf(
          await repository().accept(
            sha256('another token'),
            acceptance('2026-11-20T00:00:00.000Z'),
          ),
        )

        expect(accepted).toEqual({ type: 'unusable' })
        expect(await liveUsersWith(INVITED)).toEqual([])
      })
    })

    describe('findByStaff and revoke', () => {
      it('tell a staff member who is not there from one who holds no invitation', async () => {
        const otherSalon = await insertSalon(db)
        const cases: [string, string][] = [
          [salonId, UNKNOWN_ID],
          [otherSalon, staffId],
          [salonId, staffId],
        ]

        const found = []
        const revoked = []
        for (const [salonOfPath, id] of cases) {
          found.push(
            dataOf(
              await repository().findByStaff(salon(salonOfPath), member(id)),
            ),
          )
          revoked.push(
            dataOf(await repository().revoke(salon(salonOfPath), member(id))),
          )
        }

        expect(found).toEqual([
          { type: 'staffNotFound' },
          { type: 'staffNotFound' },
          { type: 'none' },
        ])
        expect(revoked).toEqual([
          { type: 'staffNotFound' },
          { type: 'staffNotFound' },
          { type: 'none' },
        ])
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })

    /** The values of an invitation of the staff member under test. */
    const newInvitation = (
      overrides: Partial<NewInvitation> = {},
    ): NewInvitation => ({
      staffId,
      email: INVITED,
      role: 'staff',
      tokenHash: sha256(randomUUID()),
      expiresAt: '2026-12-01T00:00:00.000Z',
      ...overrides,
    })

    it('refuses a second invitation of one staff member', async () => {
      await db.insert(staffInvitations).values(newInvitation())

      await expect(
        db.insert(staffInvitations).values(newInvitation()),
      ).rejects.toMatchObject(
        violationOf('23505', 'staff_invitations_staff_unique'),
      )
    })

    it('refuses the hash of one token for two invitations', async () => {
      const colleague = await insertStaffRow()
      await db
        .insert(staffInvitations)
        .values(newInvitation({ tokenHash: sha256('one token') }))

      await expect(
        db.insert(staffInvitations).values(
          newInvitation({
            staffId: colleague,
            tokenHash: sha256('one token'),
          }),
        ),
      ).rejects.toMatchObject(
        violationOf('23505', 'staff_invitations_token_hash_unique'),
      )
    })

    it('refuses an address that is not in lower case', async () => {
      await expect(
        db
          .insert(staffInvitations)
          .values(newInvitation({ email: 'Invited@example.com' })),
      ).rejects.toMatchObject(
        violationOf('23514', 'staff_invitations_email_lower_case'),
      )
    })

    it('refuses an invitation of a staff member who is not in the ledger', async () => {
      await expect(
        db
          .insert(staffInvitations)
          .values(newInvitation({ staffId: UNKNOWN_ID })),
      ).rejects.toMatchObject(
        violationOf('23503', 'staff_invitations_staff_id_fk'),
      )
    })

    it('has no invitation to the role of a customer or of an admin', async () => {
      for (const role of ['customer', 'admin']) {
        await expect(
          db.execute(
            sql`insert into staff_invitations ("staffId", email, role, "tokenHash", "expiresAt")
                values (${staffId}, ${INVITED}, ${role}, ${sha256(role)}, now())`,
          ),
        ).rejects.toMatchObject({
          cause: expect.objectContaining({ code: '22P02' }),
        })
      }
      expect(await storedInvitations()).toEqual([])
    })

    it('removes the invitation of a staff member whose row is removed from the table', async () => {
      const colleague = await insertStaffRow()
      await db.insert(staffInvitations).values(newInvitation())
      await db
        .insert(staffInvitations)
        .values(newInvitation({ staffId: colleague }))

      await db.delete(staff).where(eq(staff.id, staffId))

      expect(
        (await storedInvitations()).map(({ staffId: holder }) => holder),
      ).toEqual([colleague])
    })

    it('refuses a second account that names one staff member, unless the first one is deleted', async () => {
      await insertUser(db, {
        role: 'staff',
        staffId,
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await insertUser(db, { role: 'staff', staffId })

      await expect(
        insertUser(db, { role: 'manager', staffId }),
      ).rejects.toMatchObject(violationOf('23505', 'users_staff_unique'))
      expect(await db.$count(users, eq(users.staffId, staffId))).toBe(2)
    })

    it('refuses a second staff member whose row names one account, unless the first one is deleted', async () => {
      const { id: userId } = await insertUser(db, { role: 'staff' })
      await insertStaffRow(salonId, {
        userId,
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await insertStaffRow(salonId, { userId })

      await expect(insertStaffRow(salonId, { userId })).rejects.toMatchObject(
        violationOf('23505', 'staff_user_unique'),
      )
      expect(await db.$count(staff, eq(staff.userId, userId))).toBe(2)
    })

    it('lets any number of staff members be without an account, and of accounts without a staff member', async () => {
      await insertStaffRow()
      await insertStaffRow()
      await insertUser(db)
      await insertUser(db)

      expect(await db.$count(staff, isNull(staff.userId))).toBe(3)
      expect(
        await db.$count(users, isNull(users.staffId)),
      ).toBeGreaterThanOrEqual(3)
    })
  })
})
