import { randomUUID } from 'node:crypto'
import { attachments, shareLinks } from '@beauty-salon-backend/database'
import { ShareLinkRepository } from '@beauty-salon-backend/infrastructure'
import { asc, eq, sql } from 'drizzle-orm'
import type { PgInsertValue } from 'drizzle-orm/pg-core'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  epochMs,
  insertMember,
  insertSalon,
  insertSession,
  insertUser,
  minutesFromNow,
  sha256,
  signedInUser,
  signIn,
  weakHash,
} from '../../../__tests__/_shared/auth-helpers'
import {
  InMemoryFileStorage,
  STORAGE_URL,
} from '../../../__tests__/_shared/in-memory-file-storage'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const malformedBody = { status: 400, code: '2002', type: 'malformed-body' }
const unsupportedMediaType = {
  status: 415,
  code: '2002',
  type: 'unsupported-media-type',
}
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }
const passwordRequired = {
  status: 403,
  code: '1002',
  type: 'password-required',
}
const databaseFailed = { status: 500, code: '4003', type: 'database' }
const storageFailed = { status: 500, code: '4004', type: 'storage' }

const INVALID_LINK = 'Invalid share link'
const INVALID_LINK_ID = 'Invalid share link ID'
const INVALID_ATTACHMENT_ID = 'Invalid attachment ID'
const INVALID_SEARCH = 'Invalid share link search'
const INVALID_FILE_REQUEST = 'Invalid shared file request'
const INVALID_DOWNLOAD = 'Invalid shared file download'
const NOTHING_SHARED = 'Share link of the token was not found'

const MINUTE = 60_000
/** The longest a link works: 30 days, in minutes. */
const MOST_MINUTES = 30 * 24 * 60

/** A token as the server issues it: 256 bits in base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const ARGON2ID_HASH =
  /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/

/** The password of the protected links of the tests, and one that is not it. */
const LINK_PASSWORD = 'violet tram 42'
const WRONG_PASSWORD = 'violet tram 43'

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

/** What a problem says, without what differs from one request to the next. */
const said = (response: Response) => {
  const { instance, timestamp, correlationId, ...rest } = response.body
  return { status: response.status, ...rest }
}

/** Rows to insert, whose values are written as they are or as SQL. */
type NewAttachment = PgInsertValue<typeof attachments>
type NewShareLink = PgInsertValue<typeof shareLinks>

describe('Share links API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let storage: InMemoryFileStorage
  /** A signed-in administrator: the Authorization header and the user. */
  let asAdmin: string
  let adminId: string
  /** The salon of most tests. */
  let salonId: string

  const ATTACHMENTS = '/api/v1/attachments'
  const LINKS = `${ATTACHMENTS}/share-links`
  const SHARE = '/api/v1/share'

  /** Where the links of an attachment are created and listed. */
  const linksOf = (attachmentId: string): string =>
    `${ATTACHMENTS}/${attachmentId}/share-links`

  beforeEach(async () => {
    storage = new InMemoryFileStorage()
    app = createTestApp({ fileStorage: storage })
    db = getTestDb()
    const admin = await signedInUser(app, db, { role: 'admin' })
    asAdmin = admin.authorization
    adminId = admin.id
    salonId = await insertSalon(db)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const create = (
    attachmentId: string,
    body: unknown,
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).post(linksOf(attachmentId)), as).send(
      body ?? undefined,
    )

  const list = (
    attachmentId: string,
    query: string = '',
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).get(`${linksOf(attachmentId)}${query}`), as)

  const read = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).get(`${LINKS}/${id}`), as)

  const revoke = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).delete(`${LINKS}/${id}`), as)

  /** What a viewer does: nobody is signed in. */
  const open = (body: unknown, on: Express = app): Test =>
    request(on)
      .post(`${SHARE}/file`)
      .send(body ?? undefined)

  const download = (body: unknown, on: Express = app): Test =>
    request(on)
      .post(`${SHARE}/download-url`)
      .send(body ?? undefined)

  /** What a viewer presents to see the file, and to download it. */
  const presenting = (token: string, password: string | null = null) => ({
    token,
    password,
  })
  const downloading = (
    token: string,
    password: string | null = null,
    inline: boolean = false,
  ) => ({ token, password, inline })

  /** A link that satisfies every rule: for an hour, without a limit or a password. */
  const linkBody = (overrides: Record<string, unknown> = {}) => ({
    expiresAt: minutesFromNow(60),
    maxDownloads: null,
    password: null,
    ...overrides,
  })

  const keyOf = (id: string): string => `attachments/${id}`

  /**
   * The times of an attachment whose upload URL ran out the minutes given
   * ago. The URL worked for 15 minutes.
   */
  const ranOut = (minutesAgo: number): Partial<NewAttachment> => ({
    createdAt: sql`now() - make_interval(mins => ${minutesAgo + 15})`,
    updatedAt: sql`now() - make_interval(mins => ${minutesAgo + 15})`,
    uploadExpiresAt: sql`now() - make_interval(mins => ${minutesAgo})`,
  })

  /** An attachment written directly, pending unless overridden; returns its ID. */
  const insertAttachment = async (
    overrides: Partial<NewAttachment> = {},
  ): Promise<string> => {
    const [attachment] = await db
      .insert(attachments)
      .values({
        salonId,
        filename: 'before.png',
        contentType: 'image/png',
        size: 64,
        uploadedBy: adminId,
        uploadExpiresAt: sql`now() + interval '15 minutes'`,
        ...overrides,
      })
      .returning({ id: attachments.id })
    if (attachment === undefined) {
      throw new Error('No attachment was inserted')
    }
    return attachment.id
  }

  /** An attachment that was uploaded ten minutes ago; returns its ID. */
  const uploadedAttachment = (
    overrides: Partial<NewAttachment> = {},
  ): Promise<string> =>
    insertAttachment({
      ...ranOut(10),
      status: 'uploaded',
      uploadedAt: sql`now() - interval '10 minutes'`,
      ...overrides,
    })

  /** The times of a link that was created the minutes given ago. */
  const madeAgo = (minutes: number): Partial<NewShareLink> => ({
    createdAt: sql`now() - make_interval(mins => ${minutes})`,
    updatedAt: sql`now() - make_interval(mins => ${minutes})`,
  })

  /** The times of a link that ran out a minute ago. */
  const over: Partial<NewShareLink> = {
    ...madeAgo(120),
    expiresAt: sql`now() - interval '1 minute'`,
  }

  /** What makes a link ask for `LINK_PASSWORD`. */
  const withPassword = (): Partial<NewShareLink> => ({
    passwordHash: weakHash(LINK_PASSWORD),
  })

  /**
   * A link written directly, which works for an hour unless overridden;
   * returns its ID and the token that opens it.
   */
  const insertLink = async (
    attachmentId: string,
    overrides: Partial<NewShareLink> = {},
  ): Promise<{ id: string; token: string }> => {
    const token = `token-${randomUUID()}`
    const [link] = await db
      .insert(shareLinks)
      .values({
        attachmentId,
        tokenHash: sha256(token),
        expiresAt: sql`now() + interval '1 hour'`,
        createdBy: adminId,
        ...overrides,
      })
      .returning({ id: shareLinks.id })
    if (link === undefined) {
      throw new Error('No share link was inserted')
    }
    return { id: link.id, token }
  }

  /** A link created over the API; returns it, its ID and its token. */
  const created = async (
    attachmentId: string,
    overrides: Record<string, unknown> = {},
    as: string = asAdmin,
  ) => {
    const response = await create(attachmentId, linkBody(overrides), as)
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    const { shareLink, token }: { shareLink: { id: string }; token: string } =
      response.body.data
    return { id: shareLink.id, token, shareLink: response.body.data.shareLink }
  }

  const stored = async (id: string) => {
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.id, id))
    return link
  }

  /** The times of a stored link, in milliseconds since the epoch. */
  const timesOf = async (id: string) => {
    const [times] = await db
      .select({
        createdAt: epochMs(shareLinks.createdAt),
        updatedAt: epochMs(shareLinks.updatedAt),
        expiresAt: epochMs(shareLinks.expiresAt),
        lockedUntil: epochMs(shareLinks.lockedUntil),
      })
      .from(shareLinks)
      .where(eq(shareLinks.id, id))
    if (times === undefined) {
      throw new Error(`No share link ${id} is stored`)
    }
    return times
  }

  /** Every link as stored, to tell that nothing was written. */
  const everything = () =>
    db.select().from(shareLinks).orderBy(asc(shareLinks.id))

  const idsIn = (response: Response): string[] =>
    response.body.data.map(({ id }: { id: string }) => id)

  /** Someone who is signed in: the user and the Authorization header to send. */
  type Actor = { id: string; authorization: string }
  type SignInAs = () => Promise<Actor>

  const admin: SignInAs = async () => ({ id: adminId, authorization: asAdmin })

  /** A member of a salon; of the salon of the tests unless another is given. */
  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
      staffOverrides: Parameters<typeof insertMember>[3] = {},
    ): SignInAs =>
    async () => {
      const { id, email } = await insertMember(
        db,
        role,
        await salonOf(),
        staffOverrides,
      )
      return { id, authorization: (await signIn(app, email)).authorization }
    }

  const elsewhere = (): Promise<string> => insertSalon(db)

  /** Everyone who manages the share links of the salon of the tests. */
  const managers: [string, SignInAs][] = [
    ['an administrator', admin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
  ]

  /** Those who manage links, to whom the files of this salon are not there. */
  const strangers: [string, SignInAs][] = [
    ['the owner of another salon', member('owner', elsewhere)],
    ['a manager of another salon', member('manager', elsewhere)],
  ]

  /** Accounts that manage no share link at all. */
  const outsiders: [string, SignInAs][] = [
    ['a staff member of the salon', member('staff')],
    ['a staff member of another salon', member('staff', elsewhere)],
    [
      'a customer account',
      async () => {
        const { id, authorization } = await signedInUser(app, db)
        return { id, authorization }
      },
    ],
    [
      'an owner of the salon whose staff record is deleted',
      member('owner', async () => salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      }),
    ],
  ]

  /** Tokens that every operation of a manager refuses, before anything else is looked at. */
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
      'an access token that has run out',
      async () =>
        (
          await insertSession(db, (await insertUser(db)).id, {
            expiresAt: minutesFromNow(-1),
          })
        ).authorization,
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  describe('POST /api/v1/attachments/:attachmentId/share-links', () => {
    it.each(managers)(
      'creates a link for %s and answers its token, of which only the hash is stored',
      async (_who, signInAs) => {
        const { id: userId, authorization } = await signInAs()
        const attachmentId = await uploadedAttachment()
        const expiresAt = minutesFromNow(60)

        const response = await create(
          attachmentId,
          linkBody({ expiresAt }),
          authorization,
        )

        expect(response.status).toBe(201)
        const { shareLink, token } = response.body.data
        expect(shareLink).toEqual({
          id: expect.stringMatching(UUID),
          attachmentId,
          expiresAt,
          maxDownloads: null,
          downloadCount: 0,
          hasPassword: false,
          createdBy: userId,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: shareLink.createdAt,
        })
        expect(Object.keys(response.body.data)).toEqual(['shareLink', 'token'])
        expect(token).toMatch(TOKEN)

        const self = `${LINKS}/${shareLink.id}`
        expect(response.headers['location']).toBe(self)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.body.links).toEqual({
          self,
          list: linksOf(attachmentId),
          attachment: `${ATTACHMENTS}/${attachmentId}`,
        })
        expect(response.body.meta).toMatchObject({ version: 'v1' })

        const row = await stored(shareLink.id)
        expect(row).toMatchObject({
          id: shareLink.id,
          attachmentId,
          tokenHash: sha256(token),
          passwordHash: null,
          maxDownloads: null,
          downloadCount: 0,
          failedAttempts: 0,
          lockedUntil: null,
          createdBy: userId,
        })
        expect(JSON.stringify(row)).not.toContain(token)
        // The times are those of the moment the request was checked at.
        expect(await timesOf(shareLink.id)).toEqual({
          createdAt: Date.parse(shareLink.createdAt),
          updatedAt: Date.parse(shareLink.createdAt),
          expiresAt: Date.parse(expiresAt),
          lockedUntil: null,
        })
        expect(storage.calls).toEqual([])
      },
    )

    it('stores of a password its hash, as that of an account is hashed, and answers only that the link has one', async () => {
      const attachmentId = await uploadedAttachment()

      const response = await create(
        attachmentId,
        linkBody({ maxDownloads: 3, password: LINK_PASSWORD }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data.shareLink).toMatchObject({
        hasPassword: true,
        maxDownloads: 3,
        downloadCount: 0,
      })
      const row = await stored(response.body.data.shareLink.id)
      expect(row?.passwordHash).toMatch(ARGON2ID_HASH)
      expect(row).toMatchObject({ maxDownloads: 3 })
      const answered = JSON.stringify(response.body)
      expect(answered).not.toContain(LINK_PASSWORD)
      expect(answered).not.toContain('argon2id')
      expect(answered).not.toContain(row?.tokenHash)
    })

    it('gives every link of an attachment a token of its own', async () => {
      const attachmentId = await uploadedAttachment()

      const first = await created(attachmentId)
      const second = await created(attachmentId)

      expect(first.token).not.toBe(second.token)
      expect((await open(presenting(first.token))).status).toBe(200)
      expect((await open(presenting(second.token))).status).toBe(200)
    })

    it.each([
      ['an end 30 days less a minute from now', MOST_MINUTES - 1],
      ['an end a minute from now', 1],
    ])('takes %s', async (_case, minutes) => {
      const response = await create(
        await uploadedAttachment(),
        linkBody({ expiresAt: minutesFromNow(minutes) }),
      )

      expect(response.status).toBe(201)
    })

    it.each<[string, Record<string, unknown>]>([
      ['a limit of one download', { maxDownloads: 1 }],
      ['the most downloads a column holds', { maxDownloads: 2_147_483_647 }],
      ['a password of 8 characters', { password: 'tram-42x' }],
      [
        'a password of 128 characters',
        { password: `violet tram ${'x7 '.repeat(38)}42` },
      ],
    ])('takes %s', async (_case, overrides) => {
      const response = await create(
        await uploadedAttachment(),
        linkBody(overrides),
      )

      expect(response.status).toBe(201)
      expect(response.body.data.shareLink).toMatchObject({
        maxDownloads: overrides['maxDownloads'] ?? null,
        hasPassword: overrides['password'] !== undefined,
      })
    })

    it.each<[string, () => unknown, string[]]>([
      [
        'an end that has passed',
        () => linkBody({ expiresAt: minutesFromNow(-1) }),
        ['expiresAt:too_small'],
      ],
      [
        'an end more than 30 days from now',
        () => linkBody({ expiresAt: minutesFromNow(MOST_MINUTES + 1) }),
        ['expiresAt:too_big'],
      ],
      [
        'an end that is a date',
        () => linkBody({ expiresAt: '2026-12-01' }),
        ['expiresAt:invalid_format'],
      ],
      [
        'an end in another time zone',
        () => linkBody({ expiresAt: '2026-11-21T18:00:00+09:00' }),
        ['expiresAt:invalid_format'],
      ],
      [
        'no end',
        () => linkBody({ expiresAt: null }),
        ['expiresAt:invalid_type'],
      ],
      [
        'a limit of no download',
        () => linkBody({ maxDownloads: 0 }),
        ['maxDownloads:too_small'],
      ],
      [
        'a limit that is no whole number',
        () => linkBody({ maxDownloads: 1.5 }),
        ['maxDownloads:invalid_type'],
      ],
      [
        'a limit no column holds',
        () => linkBody({ maxDownloads: 2_147_483_648 }),
        ['maxDownloads:too_big'],
      ],
      [
        'a password of 7 characters',
        () => linkBody({ password: 'tram-42' }),
        ['password:too_small'],
      ],
      [
        'a password of 129 characters',
        () => linkBody({ password: `v${'x7 '.repeat(42)}42` }),
        ['password:too_big'],
      ],
      [
        'a password that is too easy to guess',
        () => linkBody({ password: 'Passw0rd!' }),
        ['password:blocklisted'],
      ],
      [
        'an end and a password that are both refused',
        () =>
          linkBody({
            expiresAt: minutesFromNow(MOST_MINUTES + 1),
            password: '12345678',
          }),
        ['expiresAt:too_big', 'password:blocklisted'],
      ],
      [
        'the addresses a link was once limited to',
        () => linkBody({ allowedEmails: ['viewer@example.com'] }),
        ['allowedEmails:unrecognized_keys'],
      ],
      [
        'a token of its own',
        () => linkBody({ token: 'a-token-of-my-choice' }),
        ['token:unrecognized_keys'],
      ],
      [
        'nothing of what a link has',
        () => ({}),
        [
          'expiresAt:invalid_type',
          'maxDownloads:invalid_type',
          'password:invalid_type',
        ],
      ],
      ['a list', () => [], [':invalid_type']],
    ])('answers 400 to %s, and writes nothing', async (_case, body, rules) => {
      const response = await create(await uploadedAttachment(), body())

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_LINK)
      expect(brokenRules(response)).toEqual(rules)
      expect(await everything()).toEqual([])
    })

    it('says which rule an end and a password break, without repeating the password', async () => {
      const response = await create(
        await uploadedAttachment(),
        linkBody({
          expiresAt: minutesFromNow(MOST_MINUTES + 1),
          password: 'Passw0rd!',
        }),
      )

      expect(response.body.errors).toEqual([
        issue('expiresAt', 'too_big', 'Must be within 30 days from now'),
        issue(
          'password',
          'blocklisted',
          'This password is too easy to guess: it is a simple pattern or a well-known password. Choose a different one',
        ),
      ])
      expect(JSON.stringify(response.body)).not.toContain('Passw0rd!')
    })

    it('says of an end that has passed that it must be later than now', async () => {
      const response = await create(
        await uploadedAttachment(),
        linkBody({ expiresAt: minutesFromNow(-1) }),
      )

      expect(response.body.errors).toEqual([
        issue('expiresAt', 'too_small', 'Must be later than now'),
      ])
    })

    it('looks at who asks, then at the ID, then at the body, then for the attachment, then at its state', async () => {
      const pending = await insertAttachment()
      const { authorization: asStaff } = await member('staff')()

      expectProblem(await create('no-id', {}, null), authenticationRequired)
      expectProblem(await create('no-id', {}, asStaff), forbidden)
      const id = await create('no-id', {})
      expectProblem(id, badRequest)
      expect(id.body.detail).toBe(INVALID_ATTACHMENT_ID)
      expect(brokenRules(id)).toEqual(['attachmentId:invalid_format'])
      const body = await create(UNKNOWN_ID, {})
      expectProblem(body, badRequest)
      expect(body.body.detail).toBe(INVALID_LINK)
      const missing = await create(UNKNOWN_ID, linkBody())
      expectProblem(missing, notFound)
      expect(missing.body.detail).toBe(`Attachment ${UNKNOWN_ID} was not found`)
      const state = await create(pending, linkBody())
      expectProblem(state, notAllowed)
      expect(state.body.detail).toBe('The attachment has not been uploaded')

      expect(await everything()).toEqual([])
    })

    it.each(outsiders)(
      'answers 403 to %s, whatever is asked for',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const attachmentId = await uploadedAttachment()

        expectProblem(
          await create(attachmentId, linkBody(), authorization),
          forbidden,
        )
        expectProblem(await create('no-id', {}, authorization), forbidden)
        expect(await everything()).toEqual([])
      },
    )

    it.each(strangers)(
      'answers 404 to %s, to whom the attachment is not there',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const attachmentId = await uploadedAttachment()

        const response = await create(attachmentId, linkBody(), authorization)

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Attachment ${attachmentId} was not found`,
        )
        expect(await everything()).toEqual([])
      },
    )

    it('answers 404 for an attachment that is deleted', async () => {
      const attachmentId = await uploadedAttachment({ deletedAt: sql`now()` })

      expectProblem(await create(attachmentId, linkBody()), notFound)
      expect(await everything()).toEqual([])
    })

    it('lets an administrator alone share an attachment of no salon', async () => {
      const attachmentId = await uploadedAttachment({ salonId: null })
      const { authorization } = await member('owner')()

      expectProblem(
        await create(attachmentId, linkBody(), authorization),
        notFound,
      )
      expect((await create(attachmentId, linkBody())).status).toBe(201)
    })

    it('takes an ID in upper case, and names the attachment in its links as it is stored', async () => {
      const attachmentId = await uploadedAttachment()

      const response = await create(attachmentId.toUpperCase(), linkBody())

      expect(response.status).toBe(201)
      expect(response.body.data.shareLink.attachmentId).toBe(attachmentId)
      expect(response.body.links).toMatchObject({
        list: linksOf(attachmentId),
        attachment: `${ATTACHMENTS}/${attachmentId}`,
      })
    })

    it('answers 400 to a body that is no JSON document, and 415 to one that is not JSON', async () => {
      const attachmentId = await uploadedAttachment()

      const broken = await request(app)
        .post(linksOf(attachmentId))
        .set('Authorization', asAdmin)
        .set('Content-Type', 'application/json')
        .send('{"expiresAt": ')
      const form = await request(app)
        .post(linksOf(attachmentId))
        .set('Authorization', asAdmin)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('maxDownloads=1')

      expectProblem(broken, malformedBody)
      expectProblem(form, unsupportedMediaType)
      expect(await everything()).toEqual([])
    })

    it.each(unauthenticated)(
      'answers 401 to %s, and writes nothing',
      async (_case, authorizationOf, problem, challenge) => {
        const attachmentId = await uploadedAttachment()

        const response = await create(
          attachmentId,
          linkBody(),
          await authorizationOf(),
        )

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await everything()).toEqual([])
      },
    )
  })

  describe('GET /api/v1/attachments/:attachmentId/share-links', () => {
    it.each(managers)(
      'lists the links of the attachment for %s, the one created last first',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const attachmentId = await uploadedAttachment()
        const oldest = await insertLink(attachmentId, madeAgo(30))
        const newest = await insertLink(attachmentId, madeAgo(10))
        const middle = await insertLink(attachmentId, madeAgo(20))
        await insertLink(await uploadedAttachment())

        const response = await list(attachmentId, '', authorization)

        expect(response.status).toBe(200)
        expect(idsIn(response)).toEqual([newest.id, middle.id, oldest.id])
        expect(response.body.meta).toEqual({
          total: 3,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        })
        expect(response.body.links).toEqual({
          self: linksOf(attachmentId),
          first: linksOf(attachmentId),
          last: null,
          next: null,
          prev: null,
        })
      },
    )

    it('lists a link that has run out and one that issued every download as they are, without the token, the hashes and the wrong passwords', async () => {
      const attachmentId = await uploadedAttachment()
      const exhausted = await insertLink(attachmentId, {
        ...madeAgo(5),
        ...withPassword(),
        maxDownloads: 2,
        downloadCount: 2,
        failedAttempts: 5,
        lockedUntil: sql`now() + interval '10 minutes'`,
      })
      const ended = await insertLink(attachmentId, over)
      const revoked = await insertLink(attachmentId)
      await revoke(revoked.id)

      const response = await list(attachmentId)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([
        {
          id: exhausted.id,
          attachmentId,
          expiresAt: expect.stringMatching(ISO_TIMESTAMP),
          maxDownloads: 2,
          downloadCount: 2,
          hasPassword: true,
          createdBy: adminId,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        {
          id: ended.id,
          attachmentId,
          expiresAt: expect.stringMatching(ISO_TIMESTAMP),
          maxDownloads: null,
          downloadCount: 0,
          hasPassword: false,
          createdBy: adminId,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
      ])
      expect(Date.parse(response.body.data[1].expiresAt)).toBeLessThan(
        Date.now(),
      )
      const answered = JSON.stringify(response.body)
      expect(answered).not.toContain(exhausted.token)
      expect(answered).not.toContain(sha256(exhausted.token))
      expect(answered).not.toContain('argon2id')
    })

    it('walks the links page by page, those created at the same moment by their ID downwards', async () => {
      const attachmentId = await uploadedAttachment()
      const first = await insertLink(attachmentId, madeAgo(10))
      const at = minutesFromNow(-20)
      const same = { createdAt: at, updatedAt: at }
      const twins = [
        (await insertLink(attachmentId, same)).id,
        (await insertLink(attachmentId, same)).id,
      ].sort()
      const [lower = '', upper = ''] = twins
      const last = await insertLink(attachmentId, madeAgo(30))
      const ids = [first.id, upper, lower, last.id]
      const path = linksOf(attachmentId)

      const one = await list(attachmentId, '?limit=2')
      const two = await list(attachmentId, `?limit=2&cursor=${ids[1]}`)
      const three = await list(attachmentId, `?limit=2&cursor=${ids[3]}`)

      expect(idsIn(one)).toEqual(ids.slice(0, 2))
      expect(one.body.meta).toEqual({
        total: 4,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: ids[1],
        prevCursor: null,
      })
      expect(one.body.links).toEqual({
        self: `${path}?limit=2`,
        first: `${path}?limit=2`,
        last: null,
        next: `${path}?limit=2&cursor=${ids[1]}`,
        prev: null,
      })
      expect(idsIn(two)).toEqual(ids.slice(2, 4))
      expect(two.body.meta).toEqual({
        total: 4,
        limit: 2,
        hasMore: false,
        cursor: ids[1],
        nextCursor: null,
        prevCursor: null,
      })
      expect(two.body.links).toMatchObject({
        self: `${path}?limit=2&cursor=${ids[1]}`,
        first: `${path}?limit=2`,
        next: null,
      })
      expect(idsIn(three)).toEqual([])
      expect(three.body.meta).toMatchObject({ total: 4, hasMore: false })
    })

    it('lists the links created at the same moment by their ID downwards, in whatever order they were written', async () => {
      const attachmentId = await uploadedAttachment()
      const at = minutesFromNow(-20)
      const [a = '', b = '', c = '', d = ''] = [
        randomUUID(),
        randomUUID(),
        randomUUID(),
        randomUUID(),
      ].sort()
      // Written neither upwards nor downwards.
      for (const id of [b, d, a, c]) {
        await insertLink(attachmentId, { id, createdAt: at, updatedAt: at })
      }

      const all = await list(attachmentId)
      const afterTwo = await list(attachmentId, `?cursor=${c}`)

      expect(idsIn(all)).toEqual([d, c, b, a])
      expect(idsIn(afterTwo)).toEqual([b, a])
    })

    it('lists one link when the limit is 1, and 100 when it is 100', async () => {
      const attachmentId = await uploadedAttachment()
      await insertLink(attachmentId, madeAgo(2))
      const newest = await insertLink(attachmentId, madeAgo(1))

      const one = await list(attachmentId, '?limit=1')
      const most = await list(attachmentId, '?limit=100')

      expect(idsIn(one)).toEqual([newest.id])
      expect(one.body.meta).toMatchObject({ limit: 1, hasMore: true })
      expect(idsIn(most)).toHaveLength(2)
      expect(most.body.meta).toMatchObject({ limit: 100, hasMore: false })
    })

    it('answers an empty list for an attachment without links, and for one that is not uploaded', async () => {
      const without = await list(await uploadedAttachment())
      const pending = await list(await insertAttachment())

      expect(without.status).toBe(200)
      expect(without.body.data).toEqual([])
      expect(without.body.meta).toMatchObject({ total: 0, nextCursor: null })
      expect(pending.status).toBe(200)
      expect(pending.body.data).toEqual([])
    })

    it('answers 400 to a cursor that names a link of another attachment', async () => {
      const attachmentId = await uploadedAttachment()
      await insertLink(attachmentId)
      const ofAnother = await insertLink(await uploadedAttachment())

      const response = await list(attachmentId, `?cursor=${ofAnother.id}`)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_SEARCH)
      expect(response.body.errors).toEqual([
        issue(
          'cursor',
          'not_found',
          'Must name a share link of the attachment',
        ),
      ])
    })

    it.each([
      ['a limit of zero', '?limit=0', ['limit:too_small']],
      ['a limit over 100', '?limit=101', ['limit:too_big']],
      ['a limit that is no number', '?limit=many', ['limit:invalid_format']],
      ['a cursor that is no ID', '?cursor=first', ['cursor:invalid_format']],
      [
        'a filter the list has not',
        `?salonId=${UNKNOWN_ID}`,
        ['salonId:unrecognized_keys'],
      ],
    ])('answers 400 to %s', async (_case, query, rules) => {
      const response = await list(await uploadedAttachment(), query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(rules)
    })

    it('looks at who asks, then at the ID, then at the query, then for the attachment', async () => {
      const { authorization: asStaff } = await member('staff')()

      expectProblem(
        await list('no-id', '?limit=0', null),
        authenticationRequired,
      )
      expectProblem(await list('no-id', '?limit=0', asStaff), forbidden)
      const id = await list('no-id', '?limit=0')
      expectProblem(id, badRequest)
      expect(id.body.detail).toBe(INVALID_ATTACHMENT_ID)
      const query = await list(UNKNOWN_ID, '?limit=0')
      expectProblem(query, badRequest)
      expect(query.body.detail).toBe(INVALID_SEARCH)
      expectProblem(await list(UNKNOWN_ID), notFound)
    })

    it.each(outsiders)('answers 403 to %s', async (_who, signInAs) => {
      const { authorization } = await signInAs()
      const attachmentId = await uploadedAttachment()
      await insertLink(attachmentId)

      expectProblem(await list(attachmentId, '', authorization), forbidden)
    })

    it.each(strangers)(
      'answers 404 to %s, to whom the attachment is not there',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const attachmentId = await uploadedAttachment()
        await insertLink(attachmentId)

        const response = await list(attachmentId, '', authorization)

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Attachment ${attachmentId} was not found`,
        )
      },
    )

    it('answers 404 for an attachment that is deleted, and lets an administrator alone list the links of one of no salon', async () => {
      const deleted = await uploadedAttachment({ deletedAt: sql`now()` })
      const ofNoSalon = await uploadedAttachment({ salonId: null })
      const link = await insertLink(ofNoSalon)
      const { authorization } = await member('owner')()

      expectProblem(await list(deleted), notFound)
      expectProblem(await list(ofNoSalon, '', authorization), notFound)
      expect(idsIn(await list(ofNoSalon))).toEqual([link.id])
    })

    it('names the attachment in the links of a page as it is stored', async () => {
      const attachmentId = await uploadedAttachment()
      await insertLink(attachmentId)

      const response = await list(attachmentId.toUpperCase(), '?limit=5')

      expect(response.status).toBe(200)
      expect(response.body.links).toMatchObject({
        self: `${linksOf(attachmentId)}?limit=5`,
      })
    })

    it.each(unauthenticated)(
      'answers 401 to %s',
      async (_case, authorizationOf, problem, challenge) => {
        const response = await list(
          await uploadedAttachment(),
          '',
          await authorizationOf(),
        )

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )
  })

  describe('GET /api/v1/attachments/share-links/:shareLinkId', () => {
    it.each(managers)('answers the link to %s', async (_who, signInAs) => {
      const { authorization } = await signInAs()
      const attachmentId = await uploadedAttachment()
      const { id, shareLink } = await created(attachmentId, {
        maxDownloads: 2,
      })

      const response = await read(id, authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(shareLink)
      expect(Object.keys(response.body.data)).toEqual([
        'id',
        'attachmentId',
        'expiresAt',
        'maxDownloads',
        'downloadCount',
        'hasPassword',
        'createdBy',
        'createdAt',
        'updatedAt',
      ])
      expect(response.body.links).toEqual({
        self: `${LINKS}/${id}`,
        list: linksOf(attachmentId),
        attachment: `${ATTACHMENTS}/${attachmentId}`,
      })
      expect(response.body.meta).toMatchObject({ version: 'v1' })
    })

    it('answers a link that has run out, and one that is locked without a word of the lock', async () => {
      const attachmentId = await uploadedAttachment()
      const ended = await insertLink(attachmentId, over)
      const locked = await insertLink(attachmentId, {
        ...withPassword(),
        failedAttempts: 5,
        lockedUntil: sql`now() + interval '10 minutes'`,
      })

      const first = await read(ended.id)
      const second = await read(locked.id)

      expect(first.status).toBe(200)
      expect(Date.parse(first.body.data.expiresAt)).toBeLessThan(Date.now())
      expect(second.status).toBe(200)
      expect(second.body.data).toMatchObject({ hasPassword: true })
      expect(JSON.stringify(second.body)).not.toMatch(/lock|failed|argon2id/i)
    })

    it('counts the downloads the link issued', async () => {
      const { id, token } = await created(await uploadedAttachment())
      await download(downloading(token))
      await download(downloading(token))

      const response = await read(id)

      expect(response.body.data).toMatchObject({ downloadCount: 2 })
    })

    it('takes an ID in upper case', async () => {
      const attachmentId = await uploadedAttachment()
      const { id } = await insertLink(attachmentId)

      const response = await read(id.toUpperCase())

      expect(response.status).toBe(200)
      expect(response.body.links.self).toBe(`${LINKS}/${id}`)
    })

    it.each(outsiders)(
      'answers 403 to %s, whatever the ID is',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const { id } = await insertLink(await uploadedAttachment())

        expectProblem(await read(id, authorization), forbidden)
        expectProblem(await read('no-id', authorization), forbidden)
      },
    )

    it.each(strangers)(
      'answers 404 to %s, to whom the link is not there',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const { id } = await insertLink(await uploadedAttachment())

        const response = await read(id, authorization)

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Share link ${id} was not found`)
      },
    )

    it('answers 400 to an ID that is none, and 404 to one that no link has', async () => {
      const invalid = await read('no-id')

      expectProblem(invalid, badRequest)
      expect(invalid.body.detail).toBe(INVALID_LINK_ID)
      expect(brokenRules(invalid)).toEqual(['shareLinkId:invalid_format'])
      expectProblem(await read(UNKNOWN_ID), notFound)
    })

    it('answers 404 for the link of an attachment that is deleted, and for one of no salon to all but an administrator', async () => {
      const ofDeleted = await insertLink(
        await uploadedAttachment({ deletedAt: sql`now()` }),
      )
      const ofNoSalon = await insertLink(
        await uploadedAttachment({ salonId: null }),
      )
      const { authorization } = await member('owner')()

      expectProblem(await read(ofDeleted.id), notFound)
      expectProblem(await read(ofNoSalon.id, authorization), notFound)
      expect((await read(ofNoSalon.id)).status).toBe(200)
    })

    it.each(unauthenticated)(
      'answers 401 to %s',
      async (_case, authorizationOf, problem, challenge) => {
        const { id } = await insertLink(await uploadedAttachment())

        const response = await read(id, await authorizationOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )
  })

  describe('DELETE /api/v1/attachments/share-links/:shareLinkId', () => {
    it.each(managers)(
      'revokes the link for %s: its token opens nothing from then on, and the other links stay',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const attachmentId = await uploadedAttachment()
        const link = await insertLink(attachmentId)
        const other = await insertLink(attachmentId)

        const response = await revoke(link.id, authorization)

        expect(response.status).toBe(204)
        expect(response.text).toBe('')
        expect(await stored(link.id)).toBeUndefined()
        const opened = await open(presenting(link.token))
        expectProblem(opened, notFound)
        expect(opened.body.detail).toBe(NOTHING_SHARED)
        expectProblem(await download(downloading(link.token)), notFound)
        expect((await open(presenting(other.token))).status).toBe(200)
        // The attachment is not touched.
        expect(storage.calls).toEqual([])
      },
    )

    it('answers 404 to revoking a link again, and to reading it', async () => {
      const { id } = await insertLink(await uploadedAttachment())
      await revoke(id)

      const again = await revoke(id)

      expectProblem(again, notFound)
      expect(again.body.detail).toBe(`Share link ${id} was not found`)
      expectProblem(await read(id), notFound)
    })

    it('revokes a link that has run out, and takes an ID in upper case', async () => {
      const { id } = await insertLink(await uploadedAttachment(), over)

      expect((await revoke(id.toUpperCase())).status).toBe(204)
      expect(await everything()).toEqual([])
    })

    it.each(outsiders)(
      'answers 403 to %s, and leaves the link',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const { id, token } = await insertLink(await uploadedAttachment())

        expectProblem(await revoke(id, authorization), forbidden)
        expectProblem(await revoke('no-id', authorization), forbidden)
        expect((await open(presenting(token))).status).toBe(200)
      },
    )

    it.each(strangers)(
      'answers 404 to %s, and leaves the link',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const { id, token } = await insertLink(await uploadedAttachment())

        expectProblem(await revoke(id, authorization), notFound)
        expect((await open(presenting(token))).status).toBe(200)
      },
    )

    it('answers 400 to an ID that is none, and 404 to one that no link has', async () => {
      const { id } = await insertLink(await uploadedAttachment())

      const invalid = await revoke('no-id')

      expectProblem(invalid, badRequest)
      expect(invalid.body.detail).toBe(INVALID_LINK_ID)
      expectProblem(await revoke(UNKNOWN_ID), notFound)
      expect(await stored(id)).toBeDefined()
    })

    it('answers 404 for the link of a deleted attachment and leaves its row, and lets an administrator alone revoke one of no salon', async () => {
      const ofDeleted = await insertLink(
        await uploadedAttachment({ deletedAt: sql`now()` }),
      )
      const ofNoSalon = await insertLink(
        await uploadedAttachment({ salonId: null }),
      )
      const { authorization } = await member('manager')()

      expectProblem(await revoke(ofDeleted.id), notFound)
      expectProblem(await revoke(ofNoSalon.id, authorization), notFound)
      expect(await stored(ofDeleted.id)).toBeDefined()
      expect(await stored(ofNoSalon.id)).toBeDefined()
      expect((await revoke(ofNoSalon.id)).status).toBe(204)
    })

    it.each(unauthenticated)(
      'answers 401 to %s, and leaves the link',
      async (_case, authorizationOf, problem, challenge) => {
        const { id } = await insertLink(await uploadedAttachment())

        const response = await revoke(id, await authorizationOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await stored(id)).toBeDefined()
      },
    )
  })

  describe('POST /api/v1/share/file', () => {
    it('tells whoever presents the token of a link what its file is, without an account, and counts no download', async () => {
      const attachmentId = await uploadedAttachment({
        filename: '施術前.png',
        size: 2048,
      })
      const { id, token } = await created(attachmentId)
      const before = await stored(id)

      const response = await open(presenting(token))

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        filename: '施術前.png',
        contentType: 'image/png',
        size: 2048,
      })
      expect(response.body.links).toBeNull()
      expect(response.body.meta).toMatchObject({ version: 'v1' })
      expect(response.headers['cache-control']).toBe('no-store')
      // Neither the attachment nor the salon is named.
      const answered = JSON.stringify(response.body)
      expect(answered).not.toContain(attachmentId)
      expect(answered).not.toContain(salonId)
      expect(await stored(id)).toEqual(before)
      expect(storage.calls).toEqual([])
    })

    it('takes no notice of who is signed in or of an access token that is none', async () => {
      const { token } = await insertLink(await uploadedAttachment())
      const { authorization: asCustomer } = await signedInUser(app, db)

      const signedIn = await open(presenting(token)).set(
        'Authorization',
        asCustomer,
      )
      const withNoSession = await open(presenting(token)).set(
        'Authorization',
        `Bearer ${'t'.repeat(43)}`,
      )

      expect(signedIn.status).toBe(200)
      expect(withNoSession.status).toBe(200)
    })

    it.each<[string, unknown, string[]]>([
      ['no token', { password: null }, ['token:invalid_type']],
      ['an empty token', { token: '', password: null }, ['token:too_small']],
      [
        'a token of 256 characters',
        { token: 't'.repeat(256), password: null },
        ['token:too_big'],
      ],
      [
        'a token that is no text',
        { token: 42, password: null },
        ['token:invalid_type'],
      ],
      [
        'no password, not even null',
        { token: 'some-token' },
        ['password:invalid_type'],
      ],
      [
        'an empty password',
        { token: 'some-token', password: '' },
        ['password:too_small'],
      ],
      [
        'a password of 129 characters',
        { token: 'some-token', password: 'p'.repeat(129) },
        ['password:too_big'],
      ],
      [
        'a word on how the file is shown',
        { token: 'some-token', password: null, inline: true },
        ['inline:unrecognized_keys'],
      ],
      ['a list', [], [':invalid_type']],
    ])('answers 400 to %s', async (_case, body, rules) => {
      const response = await open(body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_FILE_REQUEST)
      expect(brokenRules(response)).toEqual(rules)
      expect(response.headers['cache-control']).toBe('no-store')
    })

    it('answers 400 to a body that is no JSON document, and 415 to one that is not JSON', async () => {
      const broken = await request(app)
        .post(`${SHARE}/file`)
        .set('Content-Type', 'application/json')
        .send('{"token": ')
      const form = await request(app)
        .post(`${SHARE}/file`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('token=some-token')

      expectProblem(broken, malformedBody)
      expectProblem(form, unsupportedMediaType)
    })

    it('answers one and the same 404 for a token that opens nothing, whatever the reason, and never repeats the token', async () => {
      const attachmentId = await uploadedAttachment()
      const ended = await insertLink(attachmentId, over)
      const exhausted = await insertLink(attachmentId, {
        maxDownloads: 2,
        downloadCount: 2,
      })
      const revoked = await insertLink(attachmentId)
      await revoke(revoked.id)
      const ofDeleted = await insertLink(
        await uploadedAttachment({ deletedAt: sql`now()` }),
      )
      const ofPending = await insertLink(await insertAttachment())

      const unknown = await open(presenting('a-token-nobody-issued'))

      expectProblem(unknown, notFound)
      expect(unknown.body).toMatchObject({
        title: 'Resource not found',
        detail: NOTHING_SHARED,
        errors: null,
      })
      expect(unknown.headers['cache-control']).toBe('no-store')
      for (const { token } of [
        ended,
        exhausted,
        revoked,
        ofDeleted,
        ofPending,
      ]) {
        const response = await open(presenting(token))
        expect(said(response)).toEqual(said(unknown))
        expect(JSON.stringify(response.body)).not.toContain(token)
      }
    })

    it('opens a link until the moment it ends, and one that has a download left', async () => {
      const attachmentId = await uploadedAttachment()
      const endsSoon = await insertLink(attachmentId, {
        expiresAt: sql`now() + interval '1 minute'`,
      })
      const oneLeft = await insertLink(attachmentId, {
        maxDownloads: 2,
        downloadCount: 1,
      })

      expect((await open(presenting(endsSoon.token))).status).toBe(200)
      expect((await open(presenting(oneLeft.token))).status).toBe(200)
    })

    it('asks a link without a password for none, and does not look at one that is sent', async () => {
      const { id, token } = await insertLink(await uploadedAttachment())

      const response = await open(presenting(token, 'anything at all'))

      expect(response.status).toBe(200)
      expect(await stored(id)).toMatchObject({ failedAttempts: 0 })
    })

    it('opens a protected link for its password alone: none and a wrong one are answered 403, and only the wrong one is counted', async () => {
      const attachmentId = await uploadedAttachment()
      const { id, token } = await created(attachmentId, {
        password: LINK_PASSWORD,
      })

      const without = await open(presenting(token))
      const afterNone = await stored(id)
      const wrong = await open(presenting(token, WRONG_PASSWORD))
      const afterWrong = await stored(id)
      const right = await open(presenting(token, LINK_PASSWORD))

      expectProblem(without, passwordRequired)
      expect(without.body).toMatchObject({
        title: 'Password required',
        detail:
          'Send the password of the share link; one that was sent was not accepted',
        errors: null,
      })
      expect(without.headers['cache-control']).toBe('no-store')
      expect(without.headers['www-authenticate']).toBeUndefined()
      expect(afterNone).toMatchObject({ failedAttempts: 0, lockedUntil: null })
      expect(said(wrong)).toEqual(said(without))
      expect(afterWrong).toMatchObject({ failedAttempts: 1, lockedUntil: null })
      expect(right.status).toBe(200)
      expect(right.body.data).toMatchObject({ filename: 'before.png' })
      // The right password forgets the wrong one.
      expect(await stored(id)).toMatchObject({
        failedAttempts: 0,
        lockedUntil: null,
        downloadCount: 0,
      })
    })

    it('compares a password in the one form it was hashed in', async () => {
      const { token } = await created(await uploadedAttachment(), {
        // "é" as two code points.
        password: 'café au lait 42',
      })

      const composed = await open(presenting(token, 'café au lait 42'))
      const decomposed = await open(presenting(token, 'café au lait 42'))

      expect(composed.status).toBe(200)
      expect(decomposed.status).toBe(200)
    })

    it('locks a link for 15 minutes at the fifth wrong password in a row, and answers its password as a wrong one while it is locked', async () => {
      const { id, token } = await insertLink(
        await uploadedAttachment(),
        withPassword(),
      )

      for (const attempt of [1, 2, 3, 4]) {
        expectProblem(
          await open(presenting(token, WRONG_PASSWORD)),
          passwordRequired,
        )
        expect(await stored(id)).toMatchObject({
          failedAttempts: attempt,
          lockedUntil: null,
        })
      }
      const sentAt = Date.now()
      const fifth = await open(presenting(token, WRONG_PASSWORD))
      const answeredAt = Date.now()
      const locked = await stored(id)
      const right = await open(presenting(token, LINK_PASSWORD))
      const wrong = await open(presenting(token, WRONG_PASSWORD))
      const without = await open(presenting(token))

      expect(locked).toMatchObject({ failedAttempts: 5 })
      const { lockedUntil } = await timesOf(id)
      expect(lockedUntil).toBeGreaterThanOrEqual(sentAt + 15 * MINUTE)
      expect(lockedUntil).toBeLessThanOrEqual(answeredAt + 15 * MINUTE)
      // Nothing tells the lock from a wrong password, and nothing is
      // counted while it lasts.
      expect(said(right)).toEqual(said(fifth))
      expect(said(wrong)).toEqual(said(fifth))
      expect(said(without)).toEqual(said(fifth))
      expect(await stored(id)).toEqual(locked)
    })

    it('opens a link whose lock has run out for its password, and forgets the wrong ones', async () => {
      const { id, token } = await insertLink(await uploadedAttachment(), {
        ...withPassword(),
        failedAttempts: 5,
        lockedUntil: sql`now() - interval '1 minute'`,
      })

      const response = await open(presenting(token, LINK_PASSWORD))

      expect(response.status).toBe(200)
      expect(await stored(id)).toMatchObject({
        failedAttempts: 0,
        lockedUntil: null,
      })
    })

    it('locks a link whose lock has run out again at the next wrong password', async () => {
      const { id, token } = await insertLink(await uploadedAttachment(), {
        ...withPassword(),
        failedAttempts: 5,
        lockedUntil: sql`now() - interval '1 minute'`,
      })

      const sentAt = Date.now()
      expectProblem(
        await open(presenting(token, WRONG_PASSWORD)),
        passwordRequired,
      )

      expect(await stored(id)).toMatchObject({ failedAttempts: 6 })
      expect((await timesOf(id)).lockedUntil).toBeGreaterThanOrEqual(
        sentAt + 15 * MINUTE,
      )
      expectProblem(
        await open(presenting(token, LINK_PASSWORD)),
        passwordRequired,
      )
    })

    it('counts every one of the wrong passwords that arrive at the same moment', async () => {
      const { id, token } = await insertLink(
        await uploadedAttachment(),
        withPassword(),
      )

      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map(() => open(presenting(token, WRONG_PASSWORD))),
      )

      expect(responses.map(({ status }) => status)).toEqual([
        403, 403, 403, 403, 403,
      ])
      const row = await stored(id)
      expect(row).toMatchObject({ failedAttempts: 5 })
      expect(row?.lockedUntil).not.toBeNull()
    })

    it('answers 404 before it looks at a password: a link that opens nothing counts no guess', async () => {
      const attachmentId = await uploadedAttachment()
      const ended = await insertLink(attachmentId, {
        ...over,
        ...withPassword(),
      })

      const response = await open(presenting(ended.token, WRONG_PASSWORD))
      const unknown = await open(presenting('a-token-nobody-issued', 'x'))

      expectProblem(response, notFound)
      expectProblem(unknown, notFound)
      expect(await stored(ended.id)).toMatchObject({ failedAttempts: 0 })
    })

    it('stamps the link as changed when it counts a wrong password and when it forgets them', async () => {
      const { id, token } = await insertLink(await uploadedAttachment(), {
        ...madeAgo(30),
        ...withPassword(),
      })
      const before = await timesOf(id)

      await open(presenting(token, WRONG_PASSWORD))
      const counted = await timesOf(id)
      await open(presenting(token, LINK_PASSWORD))
      const forgotten = await timesOf(id)

      expect(counted.updatedAt).toBeGreaterThan(before.updatedAt + 29 * MINUTE)
      expect(forgotten.updatedAt).toBeGreaterThanOrEqual(counted.updatedAt)
      expect(forgotten.createdAt).toBe(before.createdAt)
    })
  })

  describe('POST /api/v1/share/download-url', () => {
    it('issues a URL that saves the file under its name for five minutes, and counts one download of the link', async () => {
      const attachmentId = await uploadedAttachment({ filename: '施術前.png' })
      const { id, token } = await created(attachmentId)

      const sentAt = Date.now()
      const response = await download(downloading(token))
      const answeredAt = Date.now()

      expect(response.status).toBe(200)
      const { downloadUrl, expiresAt } = response.body.data
      expect(Object.keys(response.body.data)).toEqual([
        'downloadUrl',
        'expiresAt',
      ])
      expect(expiresAt).toMatch(ISO_TIMESTAMP)
      expect(Date.parse(expiresAt)).toBeGreaterThanOrEqual(sentAt + 5 * MINUTE)
      expect(Date.parse(expiresAt)).toBeLessThanOrEqual(answeredAt + 5 * MINUTE)
      expect(downloadUrl).toBe(
        `${STORAGE_URL}/${keyOf(attachmentId)}?download-until=${expiresAt}`,
      )
      expect(storage.downloads).toEqual([
        {
          file: {
            key: keyOf(attachmentId),
            contentType: 'image/png',
            contentDisposition: `attachment; filename="___.png"; filename*=UTF-8''%E6%96%BD%E8%A1%93%E5%89%8D.png`,
          },
          expiresAt: new Date(expiresAt),
        },
      ])
      expect(response.body.links).toBeNull()
      expect(response.body.meta).toMatchObject({ version: 'v1' })
      expect(response.headers['cache-control']).toBe('no-store')
      expect(await stored(id)).toMatchObject({ downloadCount: 1 })
    })

    it('issues a URL that shows the file in the browser when the request says so', async () => {
      const { token } = await insertLink(await uploadedAttachment())

      const response = await download(downloading(token, null, true))

      expect(response.status).toBe(200)
      expect(storage.downloads[0]?.file.contentDisposition).toBe(
        `inline; filename="before.png"; filename*=UTF-8''before.png`,
      )
    })

    it('issues a URL that works no longer than the link does', async () => {
      const attachmentId = await uploadedAttachment()
      const linkEnds = minutesFromNow(2)
      const { token } = await created(attachmentId, { expiresAt: linkEnds })

      const response = await download(downloading(token))

      expect(response.status).toBe(200)
      expect(response.body.data.expiresAt).toBe(linkEnds)
      expect(storage.downloads[0]?.expiresAt).toEqual(new Date(linkEnds))
    })

    it('issues as many URLs as the link allows and answers 404 from then on, to seeing the file as well', async () => {
      const attachmentId = await uploadedAttachment()
      const { id, token } = await created(attachmentId, { maxDownloads: 2 })

      const first = await download(downloading(token))
      const second = await download(downloading(token))
      const third = await download(downloading(token))

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expectProblem(third, notFound)
      expect(third.body.detail).toBe(NOTHING_SHARED)
      expectProblem(await open(presenting(token)), notFound)
      expect(storage.downloads).toHaveLength(2)
      // The salon still sees the link, and what it issued.
      const seen = await read(id)
      expect(seen.body.data).toMatchObject({
        maxDownloads: 2,
        downloadCount: 2,
      })
    })

    it('issues no more URLs than the link allows to requests at the same moment', async () => {
      const { id, token } = await insertLink(await uploadedAttachment(), {
        maxDownloads: 3,
      })

      const responses = await Promise.all(
        [1, 2, 3, 4, 5, 6, 7, 8].map(() => download(downloading(token))),
      )

      const statuses = responses.map(({ status }) => status).sort()
      expect(statuses).toEqual([200, 200, 200, 404, 404, 404, 404, 404])
      expect(await stored(id)).toMatchObject({ downloadCount: 3 })
      for (const response of responses.filter(({ status }) => status === 404)) {
        expect(JSON.stringify(response.body)).not.toContain(STORAGE_URL)
      }
    })

    it('counts the downloads of a link without a limit', async () => {
      const { id, token } = await insertLink(await uploadedAttachment())

      await Promise.all([1, 2, 3].map(() => download(downloading(token))))

      expect(await stored(id)).toMatchObject({
        maxDownloads: null,
        downloadCount: 3,
      })
    })

    it('stamps the link as changed when it counts a download', async () => {
      const { id, token } = await insertLink(
        await uploadedAttachment(),
        madeAgo(30),
      )
      const before = await timesOf(id)

      await download(downloading(token))

      const after = await timesOf(id)
      expect(after.updatedAt).toBeGreaterThan(before.updatedAt + 29 * MINUTE)
      expect(after.createdAt).toBe(before.createdAt)
      expect(after.expiresAt).toBe(before.expiresAt)
    })

    it('issues a URL of a protected link for its password alone, and counts a wrong one as a guess and not as a download', async () => {
      const { id, token } = await insertLink(
        await uploadedAttachment(),
        withPassword(),
      )

      const without = await download(downloading(token))
      const wrong = await download(downloading(token, WRONG_PASSWORD))
      const afterWrong = await stored(id)
      const right = await download(downloading(token, LINK_PASSWORD))

      expectProblem(without, passwordRequired)
      expectProblem(wrong, passwordRequired)
      expect(afterWrong).toMatchObject({ failedAttempts: 1, downloadCount: 0 })
      expect(right.status).toBe(200)
      expect(storage.downloads).toHaveLength(1)
      expect(await stored(id)).toMatchObject({
        failedAttempts: 0,
        downloadCount: 1,
      })
    })

    it('writes what a viewer does to a link on that link, and on no other link of the file', async () => {
      const attachmentId = await uploadedAttachment()
      const { id, token } = await insertLink(attachmentId, withPassword())
      const other = await insertLink(attachmentId, {
        ...withPassword(),
        failedAttempts: 2,
      })
      const before = await stored(other.id)

      const wrong = await open(presenting(token, WRONG_PASSWORD))
      const afterWrong = await stored(other.id)
      const right = await open(presenting(token, LINK_PASSWORD))
      const afterRight = await stored(other.id)
      const issued = await download(downloading(token, LINK_PASSWORD))

      expectProblem(wrong, passwordRequired)
      expect(afterWrong).toEqual(before)
      expect(right.status).toBe(200)
      expect(afterRight).toEqual(before)
      expect(issued.status).toBe(200)
      expect(await stored(other.id)).toEqual(before)
      expect(await stored(id)).toMatchObject({
        failedAttempts: 0,
        downloadCount: 1,
      })
    })

    it('issues no URL of a locked link, not even for its password', async () => {
      const { id, token } = await insertLink(await uploadedAttachment(), {
        ...withPassword(),
        failedAttempts: 5,
        lockedUntil: sql`now() + interval '10 minutes'`,
      })

      const response = await download(downloading(token, LINK_PASSWORD))

      expectProblem(response, passwordRequired)
      expect(storage.calls).toEqual([])
      expect(await stored(id)).toMatchObject({
        failedAttempts: 5,
        downloadCount: 0,
      })
    })

    it('answers the 404 of a token that opens nothing, and signs nothing', async () => {
      const attachmentId = await uploadedAttachment()
      const ended = await insertLink(attachmentId, over)
      const exhausted = await insertLink(attachmentId, {
        maxDownloads: 1,
        downloadCount: 1,
      })
      const ofDeleted = await insertLink(
        await uploadedAttachment({ deletedAt: sql`now()` }),
      )

      const unknown = await download(downloading('a-token-nobody-issued'))

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(NOTHING_SHARED)
      expect(unknown.headers['cache-control']).toBe('no-store')
      for (const { token } of [ended, exhausted, ofDeleted]) {
        expect(said(await download(downloading(token)))).toEqual(said(unknown))
      }
      expect(storage.calls).toEqual([])
      expect(await stored(exhausted.id)).toMatchObject({ downloadCount: 1 })
    })

    it.each<[string, unknown, string[]]>([
      [
        'no word on how the file is shown',
        { token: 'some-token', password: null },
        ['inline:invalid_type'],
      ],
      [
        'a word on it that is a text',
        { token: 'some-token', password: null, inline: 'true' },
        ['inline:invalid_type'],
      ],
      ['no token', { password: null, inline: false }, ['token:invalid_type']],
      [
        'no password, not even null',
        { token: 'some-token', inline: false },
        ['password:invalid_type'],
      ],
      [
        'a name for the download',
        {
          token: 'some-token',
          password: null,
          inline: false,
          filename: 'a.html',
        },
        ['filename:unrecognized_keys'],
      ],
      ['a list', [], [':invalid_type']],
    ])('answers 400 to %s', async (_case, body, rules) => {
      const response = await download(body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_DOWNLOAD)
      expect(brokenRules(response)).toEqual(rules)
      expect(storage.calls).toEqual([])
    })

    it('looks at the body, then for the link, then at the password', async () => {
      const { token } = await insertLink(
        await uploadedAttachment(),
        withPassword(),
      )

      expectProblem(
        await download({ token: 'a-token-nobody-issued', password: '' }),
        badRequest,
      )
      expectProblem(
        await download(downloading('a-token-nobody-issued', WRONG_PASSWORD)),
        notFound,
      )
      expectProblem(
        await download(downloading(token, WRONG_PASSWORD)),
        passwordRequired,
      )
    })

    it('counts no download when the URL could not be signed', async () => {
      const { id, token } = await insertLink(await uploadedAttachment(), {
        maxDownloads: 1,
      })
      storage.failing.add('issueDownload')

      const failed = await download(downloading(token))
      storage.failing.clear()
      const next = await download(downloading(token))

      expectProblem(failed, storageFailed)
      expect(failed.body).toMatchObject({ detail: null, errors: null })
      expect(next.status).toBe(200)
      expect(await stored(id)).toMatchObject({ downloadCount: 1 })
    })
  })

  describe('what becomes of the links of an attachment', () => {
    it('opens nothing once the attachment is deleted, and removes the links when the purge removes the attachment', async () => {
      const attachmentId = await uploadedAttachment()
      storage.files.set(keyOf(attachmentId), new Uint8Array(64))
      const kept = await insertLink(await uploadedAttachment())
      const { id, token } = await created(attachmentId)

      const deleted = await request(app)
        .delete(`${ATTACHMENTS}/${attachmentId}`)
        .set('Authorization', asAdmin)
      const opened = await open(presenting(token))
      const downloaded = await download(downloading(token))
      const afterDelete = await stored(id)
      const purged = await request(app)
        .post(`${ATTACHMENTS}/purge`)
        .set('Authorization', asAdmin)

      expect(deleted.status).toBe(204)
      expectProblem(opened, notFound)
      expect(opened.body.detail).toBe(NOTHING_SHARED)
      expectProblem(downloaded, notFound)
      expectProblem(await read(id), notFound)
      // The row goes with that of the attachment.
      expect(afterDelete).toBeDefined()
      expect(purged.status).toBe(200)
      expect(purged.body.data).toEqual({ purgedCount: 1 })
      expect((await everything()).map((link) => link.id)).toEqual([kept.id])
    })
  })

  describe('ShareLinkRepository', () => {
    const repository = () => new ShareLinkRepository(db)

    it('finds a link and counts a download of it until the moment it ends, and not at that moment', async () => {
      const { id, token } = await insertLink(await uploadedAttachment(), {
        createdAt: '2026-11-30T00:00:00.000Z',
        updatedAt: '2026-11-30T00:00:00.000Z',
        expiresAt: '2026-12-01T00:00:00.000Z',
      })
      const justBefore = new Date('2026-11-30T23:59:59.999Z')
      const atTheEnd = new Date('2026-12-01T00:00:00.000Z')

      const found = await repository().findWorking(sha256(token), justBefore)
      const counted = await repository().countDownload(id, justBefore)
      const foundAtTheEnd = await repository().findWorking(
        sha256(token),
        atTheEnd,
      )
      const countedAtTheEnd = await repository().countDownload(id, atTheEnd)

      expect(found).toMatchObject({
        type: 'success',
        data: { shareLink: { id } },
      })
      expect(counted).toEqual({ type: 'success', data: true })
      expect(foundAtTheEnd).toEqual({ type: 'success', data: null })
      expect(countedAtTheEnd).toEqual({ type: 'success', data: false })
      expect(await stored(id)).toMatchObject({ downloadCount: 1 })
    })

    it('finds no link of an attachment that is not uploaded, and counts no download of it', async () => {
      const { id, token } = await insertLink(await insertAttachment())
      const now = new Date()

      const found = await repository().findWorking(sha256(token), now)
      const counted = await repository().countDownload(id, now)

      expect(found).toEqual({ type: 'success', data: null })
      expect(counted).toEqual({ type: 'success', data: false })
      expect(await stored(id)).toMatchObject({ downloadCount: 0 })
    })
  })

  describe('what is logged and what fails', () => {
    it('logs neither a token nor a password', async () => {
      const logs: unknown[] = []
      const logged = createTestApp({ logs, fileStorage: storage })
      const attachmentId = await uploadedAttachment()

      const response = await request(logged)
        .post(linksOf(attachmentId))
        .set('Authorization', asAdmin)
        .send(linkBody({ password: LINK_PASSWORD }))
      const { token }: { token: string } = response.body.data
      await open(presenting(token, LINK_PASSWORD), logged)
      await open(presenting(token, WRONG_PASSWORD), logged)
      await open(presenting('a-token-nobody-issued'), logged)
      await download(downloading(token, LINK_PASSWORD), logged)
      await download({ token, password: null }, logged)

      expect(response.status).toBe(201)
      expect(logs.length).toBeGreaterThanOrEqual(6)
      const written = JSON.stringify(logs)
      expect(written).toContain(`${SHARE}/file`)
      expect(written).not.toContain(token)
      expect(written).not.toContain(sha256(token))
      expect(written).not.toContain('a-token-nobody-issued')
      expect(written).not.toContain(LINK_PASSWORD)
      expect(written).not.toContain(WRONG_PASSWORD)
      expect(written).not.toContain('argon2id')
      expect(written).not.toContain(STORAGE_URL)
    })

    it('answers 500 for every operation when the database cannot be reached, and signs nothing', async () => {
      const attachmentId = await uploadedAttachment()
      const { id, token } = await insertLink(attachmentId)
      const before = await everything()
      const connection = connectUnreachableDatabase()
      // Signs in while the database is there, and asks once it is not.
      const session = await signedInUser(app, db, { role: 'admin' })
      const broken = createTestApp({
        database: connection.database,
        fileStorage: storage,
      })

      const opened = await open(presenting(token), broken)
      const downloaded = await download(downloading(token), broken)
      const readByManager = await request(broken)
        .get(`${LINKS}/${id}`)
        .set('Authorization', session.authorization)
      await connection.close()

      for (const response of [opened, downloaded]) {
        expectProblem(response, databaseFailed)
        expect(response.body).toMatchObject({ detail: null, errors: null })
        expect(response.headers['cache-control']).toBe('no-store')
      }
      // Who asks cannot be told without the database either.
      expectProblem(readByManager, databaseFailed)
      expect(await everything()).toEqual(before)
      expect(storage.calls).toEqual([])
    })
  })

  describe('what the routes do not serve', () => {
    it.each<['get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['get', `${SHARE}/file`],
      ['put', `${SHARE}/file`],
      ['delete', `${SHARE}/file`],
      ['get', `${SHARE}/download-url`],
      ['get', SHARE],
      ['post', SHARE],
      ['get', `${SHARE}/some-token`],
      ['post', `${SHARE}/some-token`],
      ['get', `${SHARE}/some-token/download-url`],
      ['post', LINKS],
      ['post', `${LINKS}/${UNKNOWN_ID}`],
      ['put', `${LINKS}/${UNKNOWN_ID}`],
      ['patch', `${LINKS}/${UNKNOWN_ID}`],
      ['put', `${ATTACHMENTS}/${UNKNOWN_ID}/share-links`],
      ['patch', `${ATTACHMENTS}/${UNKNOWN_ID}/share-links`],
      ['delete', `${ATTACHMENTS}/${UNKNOWN_ID}/share-links`],
      ['get', `${ATTACHMENTS}/${UNKNOWN_ID}/share-links/${UNKNOWN_ID}`],
      ['post', `${ATTACHMENTS}/${UNKNOWN_ID}/share`],
    ])('answers 404 to %s %s, and changes nothing', async (method, path) => {
      const attachmentId = await uploadedAttachment()
      const { id } = await insertLink(attachmentId)
      const before = await everything()

      const response = await authorized(
        request(app)[method](
          path
            .replace(`${LINKS}/${UNKNOWN_ID}`, `${LINKS}/${id}`)
            .replace(UNKNOWN_ID, attachmentId),
        ),
        asAdmin,
      )

      expectProblem(response, routeNotFound)
      expect(await everything()).toEqual(before)
      expect(storage.calls).toEqual([])
    })

    it('reads the fixed part of the path as an ID where an attachment is asked for by its ID', async () => {
      const response = await authorized(request(app).get(LINKS), asAdmin)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_ATTACHMENT_ID)
    })

    it('reads what follows the fixed part as the ID of a share link, also where a route of the attachments has that shape', async () => {
      const response = await authorized(
        request(app).get(`${LINKS}/download-url`),
        asAdmin,
      )

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_LINK_ID)
      expect(storage.calls).toEqual([])
    })
  })
})
