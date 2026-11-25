import { attachments, salons } from '@beauty-salon-backend/database'
import { asc, eq, sql } from 'drizzle-orm'
import type { PgInsertValue } from 'drizzle-orm/pg-core'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertMember,
  insertSalon,
  insertSession,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
} from '../../../__tests__/_shared/auth-helpers'
import {
  InMemoryFileStorage,
  STORAGE_URL,
} from '../../../__tests__/_shared/in-memory-file-storage'
import {
  authenticationRequired,
  badRequest,
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  databaseProblem,
  type ExpectedProblem,
  expectProblem,
  forbidden,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  invalidToken,
  notAllowed,
  notFound,
  request,
  routeNotFound,
  storageProblem,
  tokenExpired,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const INVALID_ATTACHMENT = 'Invalid attachment'
const INVALID_ID = 'Invalid attachment ID'
const INVALID_SEARCH = 'Invalid attachment search'
const INVALID_DOWNLOAD = 'Invalid attachment download'

const MOST_SIZE = 10 * 1024 * 1024
const MINUTE = 60_000

/** How the files of the four kinds begin, and two that are of none. */
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff, 0xe0]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]
/** A sound file: a RIFF container as a WebP image is, of another form. */
const WAVE = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]
const HTML = [...Buffer.from('<!doctype html><script>alert(1)</script>')]

/** A file of the size given that begins with the bytes given. */
const fileOf = (begin: number[], size: number): Uint8Array => {
  const bytes = new Uint8Array(size).fill(7)
  bytes.set(begin.slice(0, size))
  return bytes
}

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** Whether a request is answered while what it may wait for is held. */
const answersWithin = (
  call: Promise<unknown>,
  milliseconds: number,
): Promise<boolean> =>
  Promise.race([call.then(() => true), pause(milliseconds).then(() => false)])

/** Something a test opens when it lets what waits for it go on. */
const gate = () => {
  let open: () => void = () => {}
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  return { open, opened }
}

/** A row to insert, whose values are written as they are or as SQL. */
type NewAttachment = PgInsertValue<typeof attachments>

describe('Attachments API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let storage: InMemoryFileStorage
  /** A signed-in administrator: the Authorization header and the user. */
  let asAdmin: string
  let adminId: string
  /** The salon of most tests. */
  let salonId: string

  const PATH = '/api/v1/attachments'

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

  const announce = (body: unknown, as: string | null = asAdmin): Test =>
    authorized(request(app).post(`${PATH}/upload-url`), as).send(
      body ?? undefined,
    )

  const complete = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).post(`${PATH}/${id}/complete`), as)

  const read = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).get(`${PATH}/${id}`), as)

  const list = (query: string = '', as: string | null = asAdmin): Test =>
    authorized(request(app).get(`${PATH}${query}`), as)

  const download = (
    id: string,
    query: string = '',
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).get(`${PATH}/${id}/download-url${query}`), as)

  const remove = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).delete(`${PATH}/${id}`), as)

  const purge = (as: string | null = asAdmin): Test =>
    authorized(request(app).post(`${PATH}/purge`), as)

  /** What a client states of a PNG image of 64 bytes of the salon. */
  const announcement = (overrides: Record<string, unknown> = {}) => ({
    filename: 'before.png',
    contentType: 'image/png',
    size: 64,
    salonId,
    ...overrides,
  })

  const keyOf = (id: string): string => `attachments/${id}`

  /** What a client does with the upload URL: the file is stored. */
  const upload = (id: string, bytes: Uint8Array = fileOf(PNG, 64)): void => {
    storage.files.set(keyOf(id), bytes)
  }

  /** An attachment announced over the API; returns it as it was answered. */
  const announced = async (
    overrides: Record<string, unknown> = {},
    as: string = asAdmin,
  ) => {
    const response = await announce(announcement(overrides), as)
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    const { id }: { id: string } = response.body.data.attachment
    return { id, attachment: response.body.data.attachment }
  }

  /** An attachment whose upload is completed over the API; returns its ID. */
  const uploaded = async (
    overrides: Record<string, unknown> = {},
    as: string = asAdmin,
  ): Promise<string> => {
    const { id } = await announced(overrides, as)
    upload(id)
    const response = await complete(id, as)
    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return id
  }

  /**
   * The times of a row whose upload URL ran out the minutes given ago, or
   * runs out in as many when they are negative. The URL worked for 15
   * minutes.
   */
  const ranOut = (minutesAgo: number): Partial<NewAttachment> => ({
    createdAt: sql`now() - make_interval(mins => ${minutesAgo + 15})`,
    updatedAt: sql`now() - make_interval(mins => ${minutesAgo + 15})`,
    uploadExpiresAt: sql`now() - make_interval(mins => ${minutesAgo})`,
  })

  /** What makes a row an uploaded one, uploaded the minutes given ago. */
  const uploadedAgo = (minutes: number): Partial<NewAttachment> => ({
    ...ranOut(minutes),
    status: 'uploaded',
    uploadedAt: sql`now() - make_interval(mins => ${minutes})`,
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

  const stored = async (id: string) => {
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
    return attachment
  }

  /** Every attachment as stored, to tell that nothing was written. */
  const everything = () =>
    db.select().from(attachments).orderBy(asc(attachments.id))

  const storedIds = async (): Promise<string[]> =>
    (await everything()).map(({ id }) => id)

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

  /** Everyone who reaches the attachments of the salon of the tests. */
  const members: [string, SignInAs][] = [
    ['an administrator', admin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** The members of another salon, to whom those of this one are not there. */
  const strangers: [string, SignInAs][] = [
    ['the owner of another salon', member('owner', elsewhere)],
    ['a manager of another salon', member('manager', elsewhere)],
    ['a staff member of another salon', member('staff', elsewhere)],
  ]

  /** Accounts that reach no attachment at all. */
  const outsiders: [string, SignInAs][] = [
    [
      'a customer account',
      async () => {
        const { id, authorization } = await signedInUser(app, db)
        return { id, authorization }
      },
    ],
    [
      'an account of the salon whose staff record is deleted',
      member('owner', async () => salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      }),
    ],
  ]

  /** Tokens that every operation refuses, before anything else is looked at. */
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

  /** Every operation on an attachment that is there, by the ID it is asked with. */
  const operations: [string, (id: string, as: string | null) => Test][] = [
    ['POST /:attachmentId/complete', (id, as) => complete(id, as)],
    ['GET /:attachmentId', (id, as) => read(id, as)],
    ['GET /:attachmentId/download-url', (id, as) => download(id, '', as)],
    ['DELETE /:attachmentId', (id, as) => remove(id, as)],
  ]

  describe('POST /api/v1/attachments/upload-url', () => {
    it.each(members)(
      'writes a pending attachment for %s and answers the URL that takes the file, for 15 minutes',
      async (_who, signInAs) => {
        const { id: userId, authorization } = await signInAs()

        const response = await announce(announcement(), authorization)

        expect(response.status).toBe(201)
        const { attachment, uploadUrl, uploadHeaders } = response.body.data
        expect(attachment).toEqual({
          id: expect.stringMatching(UUID),
          salonId,
          filename: 'before.png',
          contentType: 'image/png',
          size: 64,
          status: 'pending',
          uploadedBy: userId,
          uploadExpiresAt: expect.stringMatching(ISO_TIMESTAMP),
          uploadedAt: null,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: attachment.createdAt,
        })
        expect(
          Date.parse(attachment.uploadExpiresAt) -
            Date.parse(attachment.createdAt),
        ).toBe(15 * MINUTE)
        expect(Object.keys(response.body.data)).toEqual([
          'attachment',
          'uploadUrl',
          'uploadHeaders',
        ])

        // The URL is for the key of the server's, the type and the size
        // that were stated, and until the attachment says it works.
        expect(storage.uploads).toEqual([
          {
            file: {
              key: keyOf(attachment.id),
              contentType: 'image/png',
              size: 64,
            },
            expiresAt: new Date(attachment.uploadExpiresAt),
          },
        ])
        expect(uploadUrl).toBe(
          `${STORAGE_URL}/${keyOf(attachment.id)}?upload-until=${attachment.uploadExpiresAt}`,
        )
        expect(uploadHeaders).toEqual({
          'Content-Type': 'image/png',
          'If-None-Match': '*',
        })

        const self = `${PATH}/${attachment.id}`
        expect(response.headers['location']).toBe(self)
        expect(response.body.links).toEqual({
          self,
          list: PATH,
          complete: `${self}/complete`,
        })
        expect(response.body.meta).toMatchObject({ version: 'v1' })

        expect(await stored(attachment.id)).toMatchObject({
          id: attachment.id,
          salonId,
          filename: 'before.png',
          contentType: 'image/png',
          size: 64,
          status: 'pending',
          uploadedBy: userId,
          uploadedAt: null,
          deletedAt: null,
        })
        expect(storage.files.size).toBe(0)
      },
    )

    it('writes an attachment of no salon for an administrator', async () => {
      const response = await announce(announcement({ salonId: null }))

      expect(response.status).toBe(201)
      expect(response.body.data.attachment.salonId).toBeNull()
      expect(await stored(response.body.data.attachment.id)).toMatchObject({
        salonId: null,
      })
    })

    it.each([
      ['a JPEG image named .jpg', 'image/jpeg', 'after.jpg'],
      ['a JPEG image named .jpeg', 'image/jpeg', 'after.jpeg'],
      ['a PNG image', 'image/png', 'after.png'],
      ['a WebP image', 'image/webp', 'after.webp'],
      ['a PDF document', 'application/pdf', '同意書.pdf'],
      ['a name whose ending is in upper case', 'image/jpeg', 'IMG_0001.JPG'],
      ['a name with spaces and dots', 'image/png', 'カラー 前.v2.final.png'],
      ['a name of one character before its ending', 'application/pdf', 'a.pdf'],
      ['a name of 255 characters', 'image/png', `${'あ'.repeat(251)}.png`],
    ])('takes %s', async (_case, contentType, filename) => {
      const response = await announce(announcement({ contentType, filename }))

      expect(response.status).toBe(201)
      expect(response.body.data.attachment).toMatchObject({
        contentType,
        filename,
      })
      expect(response.body.data.uploadHeaders['Content-Type']).toBe(contentType)
    })

    it.each([
      ['one byte', 1],
      ['10 MiB', MOST_SIZE],
    ])('takes a file of %s', async (_case, size) => {
      const response = await announce(announcement({ size }))

      expect(response.status).toBe(201)
      expect(response.body.data.attachment.size).toBe(size)
      expect(storage.uploads[0]?.file.size).toBe(size)
    })

    it('gives every attachment a key of its own, whatever the files are named', async () => {
      const first = await announced({ filename: 'same.png' })
      const second = await announced({ filename: 'same.png' })

      expect(first.id).not.toBe(second.id)
      expect(storage.uploads.map(({ file }) => file.key)).toEqual([
        keyOf(first.id),
        keyOf(second.id),
      ])
      // Nothing of the name is part of where the file is stored.
      expect(JSON.stringify(storage.uploads)).not.toContain('same')
    })

    describe('what a request must be', () => {
      it.each([
        ['an empty name', { filename: '' }, ['filename:too_small']],
        [
          'a name of 256 characters',
          { filename: `${'a'.repeat(252)}.png` },
          ['filename:too_big'],
        ],
        ['a name that is a number', { filename: 1 }, ['filename:invalid_type']],
        ['a name with a slash', { filename: 'a/b.png' }, ['filename:custom']],
        [
          'a name that walks up a path',
          { filename: '../../etc/passwd.png' },
          ['filename:custom'],
        ],
        [
          'a name with a backslash',
          { filename: 'a\\b.png' },
          ['filename:custom'],
        ],
        [
          'a name with a line break',
          { filename: 'a\r\nb.png' },
          ['filename:custom'],
        ],
        ['a name with a NUL', { filename: 'a\u0000.png' }, ['filename:custom']],
        ['a name with a DEL', { filename: 'a\u007f.png' }, ['filename:custom']],
        [
          'a name with a C1 control character',
          { filename: 'a\u0085.png' },
          ['filename:custom'],
        ],
        [
          'a name that ends as another type does',
          { filename: 'before.jpg' },
          ['filename:custom'],
        ],
        [
          'a name whose real ending comes first',
          { filename: 'before.png.html' },
          ['filename:custom'],
        ],
        [
          'a name without an ending',
          { filename: 'before' },
          ['filename:custom'],
        ],
        [
          'a name that is an ending only',
          { filename: '.png' },
          ['filename:custom'],
        ],
        [
          'a GIF image',
          { contentType: 'image/gif', filename: 'a.gif' },
          ['contentType:invalid_value'],
        ],
        [
          'an SVG image',
          { contentType: 'image/svg+xml', filename: 'a.svg' },
          ['contentType:invalid_value'],
        ],
        [
          'an HTML document',
          { contentType: 'text/html', filename: 'a.html' },
          ['contentType:invalid_value'],
        ],
        [
          'a type in upper case',
          { contentType: 'IMAGE/PNG' },
          ['contentType:invalid_value'],
        ],
        [
          'a type with a parameter',
          { contentType: 'image/png; charset=utf-8' },
          ['contentType:invalid_value'],
        ],
        ['no type', { contentType: null }, ['contentType:invalid_value']],
        ['an empty file', { size: 0 }, ['size:too_small']],
        ['a negative size', { size: -1 }, ['size:too_small']],
        [
          'a file of 10 MiB and a byte',
          { size: MOST_SIZE + 1 },
          ['size:too_big'],
        ],
        ['a size with a fraction', { size: 64.5 }, ['size:invalid_type']],
        ['a size that is text', { size: '64' }, ['size:invalid_type']],
        [
          'a salon that is no ID',
          { salonId: 'aoyama' },
          ['salonId:invalid_format'],
        ],
        ['a salon that is empty', { salonId: '' }, ['salonId:invalid_format']],
        [
          'a salon that does not exist',
          { salonId: UNKNOWN_ID },
          ['salonId:not_found'],
        ],
        [
          'a key that the request does not have',
          { key: 'attachments/mine' },
          ['key:unrecognized_keys'],
        ],
        [
          'the state of the upload',
          { status: 'uploaded' },
          ['status:unrecognized_keys'],
        ],
        [
          'several things at once',
          { filename: '', contentType: 'image/gif', size: 0 },
          ['filename:too_small', 'contentType:invalid_value', 'size:too_small'],
        ],
      ])('refuses %s and writes nothing', async (_case, overrides, rules) => {
        const response = await announce(announcement(overrides))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_ATTACHMENT)
        expect(brokenRules(response)).toEqual(rules)
        expect(await everything()).toEqual([])
        expect(storage.calls).toEqual([])
      })

      it.each(['filename', 'contentType', 'size', 'salonId'])(
        'refuses a request without %s',
        async (property) => {
          const rest = Object.fromEntries(
            Object.entries(announcement()).filter(([key]) => key !== property),
          )

          const response = await announce(rest)

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toContain(
            `${property}:${property === 'contentType' ? 'invalid_value' : 'invalid_type'}`,
          )
          expect(await everything()).toEqual([])
        },
      )

      it.each([
        ['no body', undefined],
        ['a list', [announcement()]],
      ])('refuses %s', async (_case, body) => {
        const response = await announce(body)

        expect(response.status).toBe(400)
        expect(await everything()).toEqual([])
      })

      it('says what a name must end as, and that a salon must be one', async () => {
        const named = await announce(announcement({ filename: 'before.gif' }))
        const ofNoSalon = await announce(announcement({ salonId: UNKNOWN_ID }))
        const withPath = await announce(announcement({ filename: 'a/b.png' }))

        expect(named.body.errors).toEqual([
          issue(
            'filename',
            'custom',
            'Must end as a file of the type image/png does',
          ),
        ])
        expect(ofNoSalon.body.errors).toEqual([
          issue('salonId', 'not_found', 'Must name a salon'),
        ])
        expect(withPath.body.errors).toEqual([
          issue(
            'filename',
            'custom',
            'Must not contain a control character, / or \\',
          ),
        ])
      })

      it('refuses a salon that is deleted as one that does not exist', async () => {
        const gone = await insertSalon(db, {
          deletedAt: '2026-11-01T00:00:00.000Z',
        })

        const response = await announce(announcement({ salonId: gone }))

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:not_found'])
      })
    })

    describe('who announces a file', () => {
      it.each(strangers)(
        'refuses %s for the salon of the tests, and takes their own',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()

          const response = await announce(announcement(), authorization)

          expectProblem(response, forbidden)
          expect(await everything()).toEqual([])
          expect(storage.calls).toEqual([])
        },
      )

      it.each(members.slice(1))(
        'refuses a file of no salon for %s',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()

          const response = await announce(
            announcement({ salonId: null }),
            authorization,
          )

          expectProblem(response, forbidden)
          expect(await everything()).toEqual([])
        },
      )

      it('refuses a member of a salon who names a salon that does not exist as it refuses another salon', async () => {
        const { authorization } = await member('owner')()

        const response = await announce(
          announcement({ salonId: UNKNOWN_ID }),
          authorization,
        )

        expectProblem(response, forbidden)
      })

      it.each(outsiders)(
        'refuses %s, before the request is looked at',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()

          const valid = await announce(announcement(), authorization)
          const invalid = await announce({ filename: '' }, authorization)

          expectProblem(valid, forbidden)
          expectProblem(invalid, forbidden)
          expect(await everything()).toEqual([])
        },
      )

      it.each(unauthenticated)(
        'answers 401 for %s',
        async (_case, tokenOf, problem, challenge) => {
          const response = await announce({ filename: '' }, await tokenOf())

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
          expect(await everything()).toEqual([])
        },
      )
    })

    it('answers 500 when the URL cannot be signed, and leaves the attachment pending for the purge', async () => {
      storage.failing.add('issueUpload')

      const response = await announce(announcement())

      expectProblem(response, storageProblem)
      expect(response.body.detail).toBeNull()
      const [left] = await everything()
      expect(left).toMatchObject({ status: 'pending', deletedAt: null })
      expect(response.body).not.toHaveProperty('data')
    })
  })

  describe('POST /api/v1/attachments/:attachmentId/complete', () => {
    it.each(members)(
      'marks the attachment uploaded for %s once its file is stored, and answers it',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        // Announced by someone else of the salon.
        const { id, attachment } = await announced()
        upload(id)
        storage.calls.length = 0

        const response = await complete(id, authorization)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...attachment,
          status: 'uploaded',
          uploadedAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
        expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThanOrEqual(
          Date.parse(response.body.data.uploadedAt),
        )
        expect(
          Date.parse(response.body.data.uploadedAt),
        ).toBeGreaterThanOrEqual(Date.parse(attachment.createdAt))
        expect(response.body.links).toEqual({
          self: `${PATH}/${id}`,
          list: PATH,
        })
        expect(response.body.meta).toMatchObject({ version: 'v1' })
        // The file is looked at and stays where it is.
        expect(storage.calls).toEqual([`inspect ${keyOf(id)}`])
        expect(storage.files.has(keyOf(id))).toBe(true)
        expect(await stored(id)).toMatchObject({
          status: 'uploaded',
          deletedAt: null,
        })
      },
    )

    it.each([
      ['a JPEG image', 'image/jpeg', 'a.jpg', JPEG],
      ['a PNG image', 'image/png', 'a.png', PNG],
      ['a WebP image', 'image/webp', 'a.webp', WEBP],
      ['a PDF document', 'application/pdf', 'a.pdf', PDF],
    ])(
      'takes a file that begins as %s does',
      async (_case, contentType, filename, begin) => {
        const { id } = await announced({ contentType, filename })
        upload(id, fileOf(begin, 64))

        const response = await complete(id)

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          status: 'uploaded',
          contentType,
        })
      },
    )

    it.each([
      ['a JPEG image of 3 bytes', 'image/jpeg', 'a.jpg', JPEG, 3],
      ['a PDF document of 5 bytes', 'application/pdf', 'a.pdf', PDF, 5],
      ['a PNG image of 8 bytes', 'image/png', 'a.png', PNG, 8],
      ['a WebP image of 12 bytes', 'image/webp', 'a.webp', WEBP, 12],
    ])(
      'takes %s: nothing but how it begins',
      async (_case, contentType, filename, begin, size) => {
        const { id } = await announced({ contentType, filename, size })
        upload(id, fileOf(begin, size))

        const response = await complete(id)

        expect(response.status).toBe(200)
      },
    )

    it('answers 409 as long as nothing is stored, and completes once the file is', async () => {
      const { id } = await announced()

      const early = await complete(id)

      expectProblem(early, notAllowed)
      expect(early.body.detail).toBe(
        'No file has been uploaded for the attachment',
      )
      expect(await stored(id)).toMatchObject({
        status: 'pending',
        uploadedAt: null,
        deletedAt: null,
      })

      upload(id)
      const late = await complete(id)

      expect(late.status).toBe(200)
      expect(late.body.data.status).toBe('uploaded')
    })

    it.each([
      ['an HTML document', 'image/png', 'a.png', HTML],
      ['a JPEG image', 'image/png', 'a.png', JPEG],
      ['a PNG image', 'image/jpeg', 'a.jpg', PNG],
      ['a PNG image', 'application/pdf', 'a.pdf', PNG],
      ['a sound file in a RIFF container', 'image/webp', 'a.webp', WAVE],
      ['a file that begins with nothing known', 'application/pdf', 'a.pdf', []],
    ])(
      'refuses %s stored as %s, ends the attachment and removes the file',
      async (_case, contentType, filename, begin) => {
        const { id } = await announced({ contentType, filename })
        upload(id, fileOf(begin, 64))
        storage.calls.length = 0

        const response = await complete(id)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          `The uploaded file is not a file of the type ${contentType}`,
        )
        expect(storage.calls).toEqual([
          `inspect ${keyOf(id)}`,
          `remove ${keyOf(id)}`,
        ])
        expect(storage.files.size).toBe(0)
        expect(await stored(id)).toMatchObject({
          status: 'pending',
          uploadedAt: null,
          deletedAt: expect.any(String),
        })
        // It is over: the file is announced anew.
        expectProblem(await read(id), notFound)
        upload(id)
        expectProblem(await complete(id), notFound)
      },
    )

    it.each([
      ['a JPEG image cut off after 2 bytes', 'image/jpeg', 'a.jpg', JPEG, 2],
      ['a PNG image cut off after 7 bytes', 'image/png', 'a.png', PNG, 7],
      ['a WebP image cut off after 11 bytes', 'image/webp', 'a.webp', WEBP, 11],
      [
        'a PDF document cut off after 4 bytes',
        'application/pdf',
        'a.pdf',
        PDF,
        4,
      ],
    ])('refuses %s', async (_case, contentType, filename, begin, size) => {
      const { id } = await announced({ contentType, filename, size })
      upload(id, fileOf(begin, size))

      const response = await complete(id)

      expectProblem(response, notAllowed)
      expect(storage.files.size).toBe(0)
    })

    it.each([
      ['a byte longer', 65],
      ['a byte shorter', 63],
      ['empty', 0],
    ])(
      'refuses a stored file that is %s than announced, ends the attachment and removes the file',
      async (_case, size) => {
        const { id } = await announced()
        upload(id, fileOf(PNG, size))

        const response = await complete(id)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          'The uploaded file is not of 64 bytes',
        )
        expect(storage.files.size).toBe(0)
        expect(await stored(id)).toMatchObject({
          status: 'pending',
          deletedAt: expect.any(String),
        })
      },
    )

    it('ends a refused attachment before it removes the file, so that no request marks it uploaded in between', async () => {
      const { id } = await announced()
      upload(id, fileOf(HTML, 64))
      const whenRemoved: unknown[] = []
      storage.beforeRemove = async () => {
        whenRemoved.push((await stored(id))?.deletedAt)
      }

      await complete(id)

      expect(whenRemoved).toEqual([expect.any(String)])
    })

    it('answers an attachment that is uploaded already as it is, without looking at the file again', async () => {
      const id = await uploaded()
      const first = await read(id)
      storage.calls.length = 0
      // Whatever is stored by now.
      upload(id, fileOf(HTML, 3))

      const again = await complete(id)

      expect(again.status).toBe(200)
      expect(again.body.data).toEqual(first.body.data)
      expect(storage.calls).toEqual([])
      expect(storage.files.has(keyOf(id))).toBe(true)
    })

    it('completes an upload whose URL has run out, until the purge takes it', async () => {
      const id = await insertAttachment(ranOut(23 * 60))
      upload(id)

      const response = await complete(id)

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('uploaded')
    })

    it('answers 500 when the file cannot be looked at, and leaves the attachment pending', async () => {
      const { id } = await announced()
      upload(id)
      storage.failing.add('inspect')

      const response = await complete(id)

      expectProblem(response, storageProblem)
      expect(await stored(id)).toMatchObject({
        status: 'pending',
        deletedAt: null,
      })

      storage.failing.clear()
      expect((await complete(id)).status).toBe(200)
    })

    it('answers 500 when a refused file cannot be removed: the attachment is over, and the purge removes the file', async () => {
      const { id } = await announced()
      upload(id, fileOf(HTML, 64))
      storage.failing.add('remove')

      const response = await complete(id)

      expectProblem(response, storageProblem)
      expect(storage.files.has(keyOf(id))).toBe(true)
      expect(await stored(id)).toMatchObject({ deletedAt: expect.any(String) })
      expectProblem(await complete(id), notFound)

      // Once the URL has run out, the purge takes the row and the file.
      storage.failing.clear()
      await db
        .update(attachments)
        .set({
          createdAt: sql`now() - interval '16 minutes'`,
          uploadExpiresAt: sql`now() - interval '1 minute'`,
        })
        .where(eq(attachments.id, id))
      const purged = await purge()

      expect(purged.body.data).toEqual({ purgedCount: 1 })
      expect(storage.files.size).toBe(0)
      expect(await everything()).toEqual([])
    })
  })

  describe('GET /api/v1/attachments/:attachmentId', () => {
    it.each(members)(
      'answers an uploaded attachment of the salon for %s',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const id = await uploaded({ filename: '施術前.png' })

        const response = await read(id, authorization)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          id,
          salonId,
          filename: '施術前.png',
          contentType: 'image/png',
          size: 64,
          status: 'uploaded',
          uploadedBy: adminId,
          uploadExpiresAt: expect.stringMatching(ISO_TIMESTAMP),
          uploadedAt: expect.stringMatching(ISO_TIMESTAMP),
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
        expect(response.body.links).toEqual({
          self: `${PATH}/${id}`,
          list: PATH,
        })
        expect(response.body.meta).toMatchObject({ version: 'v1' })
      },
    )

    it('answers a pending attachment too, without the time of an upload', async () => {
      const { id, attachment } = await announced()

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(attachment)
      expect(response.body.data).toMatchObject({
        status: 'pending',
        uploadedAt: null,
      })
    })

    it('shows neither where the file is stored nor when the attachment was deleted', async () => {
      const id = await uploaded()

      const response = await read(id)

      expect(Object.keys(response.body.data).sort()).toEqual([
        'contentType',
        'createdAt',
        'filename',
        'id',
        'salonId',
        'size',
        'status',
        'updatedAt',
        'uploadExpiresAt',
        'uploadedAt',
        'uploadedBy',
      ])
      expect(JSON.stringify(response.body.data)).not.toContain('attachments/')
      expect(
        storage.calls.filter((call) => call.startsWith('issueDownload')),
      ).toEqual([])
    })

    it('takes an ID in upper case, and says where the attachment is by the path the request came on', async () => {
      const id = await uploaded()
      const path = PATH.replace('attachments', 'Attachments')

      const response = await request(app)
        .get(`${path}/${id.toUpperCase()}`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
      expect(response.body.links).toEqual({ self: `${path}/${id}`, list: path })
    })
  })

  describe('GET /api/v1/attachments', () => {
    it('lists the uploaded attachments, the one uploaded last first, without the pending and the deleted ones', async () => {
      const oldest = await insertAttachment(uploadedAgo(30))
      const newest = await insertAttachment(uploadedAgo(10))
      const middle = await insertAttachment(uploadedAgo(20))
      await insertAttachment()
      await insertAttachment({ ...uploadedAgo(5), deletedAt: sql`now()` })

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        newest,
        middle,
        oldest,
      ])
      expect(response.body.data[0]).toEqual({
        id: newest,
        salonId,
        filename: 'before.png',
        contentType: 'image/png',
        size: 64,
        status: 'uploaded',
        uploadedBy: adminId,
        uploadExpiresAt: expect.stringMatching(ISO_TIMESTAMP),
        uploadedAt: expect.stringMatching(ISO_TIMESTAMP),
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
      expect(response.body.links).toEqual({
        self: PATH,
        first: PATH,
        last: null,
        next: null,
        prev: null,
      })
    })

    it('answers an empty list when nothing is uploaded', async () => {
      await insertAttachment()

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([])
      expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
    })

    it('orders attachments uploaded at the same moment by their IDs, the greatest first', async () => {
      const moment = { ...uploadedAgo(10), uploadedAt: '2026-11-18T03:00:00Z' }
      const ids = [
        await insertAttachment(moment),
        await insertAttachment(moment),
        await insertAttachment(moment),
      ]

      const response = await list()

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual(
        [...ids].sort().reverse(),
      )
    })

    describe('whose attachments', () => {
      let other: string
      let ours: string
      let theirs: string
      let ofNoSalon: string

      beforeEach(async () => {
        other = await insertSalon(db)
        ours = await insertAttachment(uploadedAgo(30))
        theirs = await insertAttachment({ ...uploadedAgo(20), salonId: other })
        ofNoSalon = await insertAttachment({
          ...uploadedAgo(10),
          salonId: null,
        })
      })

      const idsOf = (response: Response): string[] =>
        response.body.data.map(({ id }: { id: string }) => id)

      it('lists those of every salon and of none for an administrator', async () => {
        const response = await list()

        expect(idsOf(response)).toEqual([ofNoSalon, theirs, ours])
        expect(response.body.meta.total).toBe(3)
      })

      it('lists those of the salon an administrator names', async () => {
        const response = await list(`?salonId=${other}`)

        expect(idsOf(response)).toEqual([theirs])
        expect(response.body.meta.total).toBe(1)
        expect(response.body.links.self).toBe(`${PATH}?salonId=${other}`)
      })

      it('lists nothing for a salon that has none, or that does not exist', async () => {
        const empty = await list(`?salonId=${await insertSalon(db)}`)
        const unknown = await list(`?salonId=${UNKNOWN_ID}`)

        expect(idsOf(empty)).toEqual([])
        expect(idsOf(unknown)).toEqual([])
      })

      it.each(members.slice(1))(
        'lists those of their salon alone for %s, with or without its name',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()

          const unnamed = await list('', authorization)
          const named = await list(`?salonId=${salonId}`, authorization)

          expect(idsOf(unnamed)).toEqual([ours])
          expect(unnamed.body.meta.total).toBe(1)
          expect(idsOf(named)).toEqual([ours])
        },
      )

      it.each(members.slice(1))(
        'refuses %s who names another salon',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()

          expectProblem(
            await list(`?salonId=${other}`, authorization),
            forbidden,
          )
          expectProblem(
            await list(`?salonId=${UNKNOWN_ID}`, authorization),
            forbidden,
          )
        },
      )

      it.each(outsiders)(
        'refuses %s, before the query is looked at',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()

          expectProblem(await list('', authorization), forbidden)
          expectProblem(await list('?limit=0', authorization), forbidden)
          expectProblem(await list('?limit=many', authorization), forbidden)
        },
      )

      it.each(unauthenticated)(
        'answers 401 for %s',
        async (_case, tokenOf, problem, challenge) => {
          const response = await list('?limit=0', await tokenOf())

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        },
      )
    })

    describe('pages', () => {
      let ids: string[]

      beforeEach(async () => {
        // The first is the one uploaded last.
        ids = []
        for (const minutes of [10, 20, 30, 40, 50]) {
          ids.push(await insertAttachment(uploadedAgo(minutes)))
        }
      })

      it('walks the list page by page, each page after the last attachment of the one before', async () => {
        const first = await list('?limit=2')
        const second = await list(`?limit=2&cursor=${ids[1]}`)
        const third = await list(`?limit=2&cursor=${ids[3]}`)

        expect(first.body.data.map(({ id }: { id: string }) => id)).toEqual(
          ids.slice(0, 2),
        )
        expect(first.body.meta).toEqual({
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: ids[1],
          prevCursor: null,
        })
        expect(first.body.links).toEqual({
          self: `${PATH}?limit=2`,
          first: `${PATH}?limit=2`,
          last: null,
          next: `${PATH}?limit=2&cursor=${ids[1]}`,
          prev: null,
        })
        expect(second.body.data.map(({ id }: { id: string }) => id)).toEqual(
          ids.slice(2, 4),
        )
        expect(second.body.meta).toMatchObject({
          total: 5,
          hasMore: true,
          cursor: ids[1],
          nextCursor: ids[3],
        })
        expect(third.body.data.map(({ id }: { id: string }) => id)).toEqual(
          ids.slice(4),
        )
        expect(third.body.meta).toMatchObject({
          total: 5,
          hasMore: false,
          cursor: ids[3],
          nextCursor: null,
        })
        expect(third.body.links.next).toBeNull()
      })

      it('ends a page that holds the last attachment without a next one', async () => {
        const response = await list('?limit=5')

        expect(response.body.data).toHaveLength(5)
        expect(response.body.meta).toMatchObject({
          hasMore: false,
          nextCursor: null,
        })
      })

      it('keeps the pages of a salon to that salon', async () => {
        const other = await insertSalon(db)
        const theirs = await insertAttachment({
          ...uploadedAgo(25),
          salonId: other,
        })

        const response = await list(
          `?salonId=${salonId}&limit=2&cursor=${ids[1]}`,
        )

        expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual(
          ids.slice(2, 4),
        )
        expect(response.body.meta.total).toBe(5)
        expect(response.body.links.next).toBe(
          `${PATH}?salonId=${salonId}&limit=2&cursor=${ids[3]}`,
        )
        expectProblem(
          await list(`?salonId=${salonId}&cursor=${theirs}`),
          badRequest,
        )
      })

      it.each([
        ['one', 1],
        ['a hundred', 100],
      ])('takes a limit of %s', async (_case, limit) => {
        const response = await list(`?limit=${limit}`)

        expect(response.status).toBe(200)
        expect(response.body.meta.limit).toBe(limit)
        expect(response.body.data).toHaveLength(Math.min(limit, 5))
      })

      it.each([
        ['an attachment that is pending', () => insertAttachment()],
        [
          'an attachment that is deleted',
          () => insertAttachment({ ...uploadedAgo(5), deletedAt: sql`now()` }),
        ],
        ['an attachment that does not exist', async () => UNKNOWN_ID],
      ])('refuses a cursor that names %s', async (_case, cursorOf) => {
        const response = await list(`?cursor=${await cursorOf()}`)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(response.body.errors).toEqual([
          issue('cursor', 'not_found', 'Must name an attachment of the list'),
        ])
      })

      it('refuses a member of a salon a cursor that names an attachment of another salon', async () => {
        const { authorization } = await member('staff', elsewhere)()

        const response = await list(`?cursor=${ids[0]}`, authorization)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['cursor:not_found'])
      })
    })

    describe('what a query must be', () => {
      it.each([
        ['a limit of zero', '?limit=0', ['limit:too_small']],
        ['a limit of 101', '?limit=101', ['limit:too_big']],
        ['a limit with a fraction', '?limit=1.5', ['limit:invalid_type']],
        ['a limit that is no number', '?limit=many', ['limit:invalid_format']],
        ['an empty limit', '?limit=', ['limit:invalid_format']],
        ['a cursor that is no ID', '?cursor=last', ['cursor:invalid_format']],
        [
          'a salon that is no ID',
          '?salonId=aoyama',
          ['salonId:invalid_format'],
        ],
        [
          'a parameter the list does not have',
          '?status=pending',
          ['status:unrecognized_keys'],
        ],
        ['a limit given twice', '?limit=1&limit=2', ['limit:invalid_type']],
      ])('refuses %s', async (_case, query, rules) => {
        const response = await list(query)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(brokenRules(response)).toEqual(rules)
      })
    })
  })

  describe('GET /api/v1/attachments/:attachmentId/download-url', () => {
    it.each(members)(
      'answers a URL that downloads the file for five minutes for %s',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const id = await uploaded()
        const before = Date.now()

        const response = await download(id, '', authorization)

        const after = Date.now()
        expect(response.status).toBe(200)
        const { downloadUrl, expiresAt } = response.body.data
        expect(Object.keys(response.body.data)).toEqual([
          'downloadUrl',
          'expiresAt',
        ])
        expect(expiresAt).toMatch(ISO_TIMESTAMP)
        expect(Date.parse(expiresAt)).toBeGreaterThanOrEqual(
          before + 5 * MINUTE,
        )
        expect(Date.parse(expiresAt)).toBeLessThanOrEqual(after + 5 * MINUTE)
        // The URL is signed until the moment the answer names.
        expect(storage.downloads).toEqual([
          {
            file: {
              key: keyOf(id),
              contentType: 'image/png',
              contentDisposition: `attachment; filename="before.png"; filename*=UTF-8''before.png`,
            },
            expiresAt: new Date(expiresAt),
          },
        ])
        expect(downloadUrl).toBe(
          `${STORAGE_URL}/${keyOf(id)}?download-until=${expiresAt}`,
        )
        expect(response.body.links).toEqual({
          self: `${PATH}/${id}/download-url`,
          attachment: `${PATH}/${id}`,
        })
        expect(response.body.meta).toMatchObject({ version: 'v1' })
      },
    )

    it.each([
      ['saved, when nothing is said', '', 'attachment'],
      ['saved, when it is not to be shown', '?inline=false', 'attachment'],
      ['shown in the browser, when it is to be', '?inline=true', 'inline'],
    ])('answers a URL by which the file is %s', async (_case, query, kind) => {
      const id = await uploaded()

      const response = await download(id, query)

      expect(response.status).toBe(200)
      expect(storage.downloads[0]?.file.contentDisposition).toBe(
        `${kind}; filename="before.png"; filename*=UTF-8''before.png`,
      )
    })

    it.each([
      [
        '施術前 (1).png',
        `attachment; filename="___ (1).png"; filename*=UTF-8''%E6%96%BD%E8%A1%93%E5%89%8D%20%281%29.png`,
      ],
      [
        `it's "100%".png`,
        `attachment; filename="it's _100__.png"; filename*=UTF-8''it%27s%20%22100%25%22.png`,
      ],
      [
        'a;b,c*d.png',
        `attachment; filename="a;b,c*d.png"; filename*=UTF-8''a%3Bb%2Cc%2Ad.png`,
      ],
      [
        '😀.png',
        `attachment; filename="_.png"; filename*=UTF-8''%F0%9F%98%80.png`,
      ],
    ])('names the file %s as a header can', async (filename, disposition) => {
      const id = await uploaded({ filename })

      const response = await download(id)

      expect(response.status).toBe(200)
      expect(storage.downloads[0]?.file.contentDisposition).toBe(disposition)
    })

    it('answers the file as the kind the attachment is of', async () => {
      const id = await insertAttachment({
        ...uploadedAgo(10),
        contentType: 'application/pdf',
        filename: '同意書.pdf',
      })

      await download(id, '?inline=true')

      expect(storage.downloads[0]?.file).toMatchObject({
        key: keyOf(id),
        contentType: 'application/pdf',
      })
    })

    it('answers a URL of its own to every request', async () => {
      const id = await uploaded()

      const first = await download(id)
      const second = await download(id)

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(storage.downloads).toHaveLength(2)
    })

    it('takes an ID in upper case, and names the attachment in its links as it is stored', async () => {
      const id = await uploaded()

      const response = await download(id.toUpperCase())

      expect(response.status).toBe(200)
      expect(storage.downloads.map(({ file }) => file.key)).toEqual([keyOf(id)])
      expect(response.body.links).toEqual({
        self: `${PATH}/${id}/download-url`,
        attachment: `${PATH}/${id}`,
      })
    })

    it('answers 409 for an attachment that is not uploaded', async () => {
      const { id } = await announced()
      upload(id)

      const response = await download(id)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe('The attachment has not been uploaded')
      expect(storage.downloads).toEqual([])
    })

    it.each([
      ['a flag that is no boolean', '?inline=yes', ['inline:invalid_value']],
      ['an empty flag', '?inline=', ['inline:invalid_value']],
      ['a flag in upper case', '?inline=TRUE', ['inline:invalid_value']],
      [
        'a flag given twice',
        '?inline=true&inline=true',
        ['inline:invalid_value'],
      ],
      [
        'a parameter a download does not have',
        '?filename=a.html',
        ['filename:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, query, rules) => {
      const id = await uploaded()

      const response = await download(id, query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_DOWNLOAD)
      expect(brokenRules(response)).toEqual(rules)
      expect(storage.downloads).toEqual([])
    })

    it('answers 500 when the URL cannot be signed', async () => {
      const id = await uploaded()
      storage.failing.add('issueDownload')

      const response = await download(id)

      expectProblem(response, storageProblem)
      expect(response.body).not.toHaveProperty('data')
    })
  })

  describe('DELETE /api/v1/attachments/:attachmentId', () => {
    it.each(members.slice(0, 3))(
      'removes the file and deletes the attachment for %s',
      async (_who, signInAs) => {
        const { authorization } = await signInAs()
        const id = await uploaded()
        const kept = await uploaded()
        storage.calls.length = 0

        const response = await remove(id, authorization)

        expect(response.status).toBe(204)
        expect(response.text).toBe('')
        expect(storage.calls).toEqual([`remove ${keyOf(id)}`])
        expect([...storage.files.keys()]).toEqual([keyOf(kept)])
        // The row stays until the purge: the upload URL may still work.
        expect(await stored(id)).toMatchObject({
          status: 'uploaded',
          deletedAt: expect.any(String),
        })
        expect(await stored(kept)).toMatchObject({ deletedAt: null })

        // Nothing answers it any more.
        for (const [, operation] of operations) {
          expectProblem(await operation(id, asAdmin), notFound)
        }
        const listed = await list()
        expect(listed.body.data.map(({ id }: { id: string }) => id)).toEqual([
          kept,
        ])
      },
    )

    it('deletes a pending attachment, whose file may not be there', async () => {
      const { id } = await announced()

      const response = await remove(id)

      expect(response.status).toBe(204)
      expect(storage.calls.at(-1)).toBe(`remove ${keyOf(id)}`)
      expect(await stored(id)).toMatchObject({
        status: 'pending',
        deletedAt: expect.any(String),
      })
      // What the URL would still take is of no attachment.
      upload(id)
      expectProblem(await complete(id), notFound)
    })

    it('removes the file before it deletes the attachment', async () => {
      const id = await uploaded()
      const whenRemoved: unknown[] = []
      storage.beforeRemove = async () => {
        whenRemoved.push((await stored(id))?.deletedAt)
      }

      await remove(id)

      expect(whenRemoved).toEqual([null])
    })

    it('stamps the attachment as changed when it is deleted', async () => {
      const id = await insertAttachment(uploadedAgo(60))
      upload(id)

      await remove(id)

      const [row] = await db
        .select({
          deleted: sql<boolean>`${attachments.deletedAt} is not null`,
          changedThen: sql<boolean>`${attachments.updatedAt} >= ${attachments.deletedAt} - interval '1 second'`,
        })
        .from(attachments)
        .where(eq(attachments.id, id))
      expect(row).toEqual({ deleted: true, changedThen: true })
    })

    it('answers 500 and changes nothing when the file cannot be removed, and deletes when asked again', async () => {
      const id = await uploaded()
      const before = await everything()
      storage.failing.add('remove')

      const failed = await remove(id)

      expectProblem(failed, storageProblem)
      expect(await everything()).toEqual(before)
      expect(storage.files.has(keyOf(id))).toBe(true)
      expect((await read(id)).status).toBe(200)

      storage.failing.clear()
      const again = await remove(id)

      expect(again.status).toBe(204)
      expect(storage.files.size).toBe(0)
    })

    describe('who deletes', () => {
      it('lets a staff member delete what they uploaded themselves', async () => {
        const { authorization } = await member('staff')()
        const id = await uploaded({}, authorization)

        const response = await remove(id, authorization)

        expect(response.status).toBe(204)
        expect(storage.files.size).toBe(0)
      })

      it('refuses a staff member what someone else uploaded, and changes nothing', async () => {
        const { authorization } = await member('staff')()
        const ofAnother = await uploaded(
          {},
          (await member('staff')()).authorization,
        )
        const ofTheOwner = await uploaded(
          {},
          (await member('owner')()).authorization,
        )
        const before = await everything()

        expectProblem(await remove(ofAnother, authorization), forbidden)
        expectProblem(await remove(ofTheOwner, authorization), forbidden)

        expect(await everything()).toEqual(before)
        expect(storage.files.size).toBe(2)
      })

      it('lets the owner and a manager delete what a staff member uploaded', async () => {
        const staff = await member('staff')()
        const first = await uploaded({}, staff.authorization)
        const second = await uploaded({}, staff.authorization)

        const byOwner = await remove(
          first,
          (await member('owner')()).authorization,
        )
        const byManager = await remove(
          second,
          (await member('manager')()).authorization,
        )

        expect(byOwner.status).toBe(204)
        expect(byManager.status).toBe(204)
      })

      it('answers 404 to who uploaded an attachment and is of another salon by now', async () => {
        const other = await insertSalon(db)
        const { id: userId, authorization } = await member(
          'manager',
          async () => other,
        )()
        const id = await insertAttachment({
          ...uploadedAgo(10),
          uploadedBy: userId,
        })

        const response = await remove(id, authorization)

        expectProblem(response, notFound)
        expect(await stored(id)).toMatchObject({ deletedAt: null })
      })

      it('lets an administrator alone delete an attachment of no salon', async () => {
        const id = await uploaded({ salonId: null })
        const { authorization } = await member('owner')()

        expectProblem(await remove(id, authorization), notFound)
        expect((await remove(id)).status).toBe(204)
      })
    })
  })

  describe('an attachment that is not there, or not theirs', () => {
    describe.each(operations)('%s', (_operation, operation) => {
      it.each([
        ['does not exist', async () => UNKNOWN_ID],
        [
          'is deleted',
          () => insertAttachment({ ...uploadedAgo(10), deletedAt: sql`now()` }),
        ],
      ])('answers 404 for an attachment that %s', async (_case, idOf) => {
        const id = await idOf()

        const response = await operation(id, asAdmin)

        expectProblem(response, notFound)
        expect(response.body.detail).toContain('Attachment')
        expect(response.body.detail).toContain(id)
        expect(storage.calls).toEqual([])
      })

      it.each(strangers)(
        'answers 404 to %s for an attachment of the salon of the tests, as for one that does not exist',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()
          const id = await insertAttachment(uploadedAgo(10))
          upload(id)
          const before = await everything()

          const response = await operation(id, authorization)
          const unknown = await operation(UNKNOWN_ID, authorization)

          expectProblem(response, notFound)
          expect({
            ...response.body,
            detail: '',
            instance: '',
            correlationId: '',
            timestamp: '',
          }).toEqual({
            ...unknown.body,
            detail: '',
            instance: '',
            correlationId: '',
            timestamp: '',
          })
          expect(await everything()).toEqual(before)
          expect(storage.calls).toEqual([])
          expect(storage.files.size).toBe(1)
        },
      )

      it.each(members.slice(1))(
        'answers 404 to %s for an attachment of no salon',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()
          const id = await insertAttachment({
            ...uploadedAgo(10),
            salonId: null,
          })

          expectProblem(await operation(id, authorization), notFound)
          expect((await operation(id, asAdmin)).status).toBeLessThan(300)
        },
      )

      it.each(outsiders)(
        'refuses %s, whatever the ID is',
        async (_who, signInAs) => {
          const { authorization } = await signInAs()
          const id = await insertAttachment(uploadedAgo(10))
          const before = await everything()

          expectProblem(await operation(id, authorization), forbidden)
          expectProblem(await operation(UNKNOWN_ID, authorization), forbidden)
          expectProblem(await operation('no-id', authorization), forbidden)
          expect(await everything()).toEqual(before)
          expect(storage.calls).toEqual([])
        },
      )

      it.each(unauthenticated)(
        'answers 401 for %s',
        async (_case, tokenOf, problem, challenge) => {
          const response = await operation('no-id', await tokenOf())

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        },
      )

      it.each([
        ['text', 'latest'],
        ['a UUID with a character too few', UNKNOWN_ID.slice(1)],
        ['a UUID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
      ])('refuses an ID that is %s', async (_case, id) => {
        const response = await operation(id, asAdmin)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_ID)
        expect(brokenRules(response)).toEqual(['attachmentId:invalid_format'])
        expect(storage.calls).toEqual([])
      })
    })

    it('looks at the ID of a download before its query, and at the query before the attachment', async () => {
      const bothWrong = await download('no-id', '?inline=yes')
      const unknownAndWrong = await download(UNKNOWN_ID, '?inline=yes')

      expect(bothWrong.body.detail).toBe(INVALID_ID)
      expect(unknownAndWrong.body.detail).toBe(INVALID_DOWNLOAD)
    })
  })

  describe('POST /api/v1/attachments/purge', () => {
    const DAY = 24 * 60

    it('removes the pending attachments a day after their URL ran out and the deleted ones once theirs has, with their files', async () => {
      const abandoned = await insertAttachment(ranOut(DAY + 1))
      const abandonedWithFile = await insertAttachment(ranOut(3 * DAY))
      const deleted = await insertAttachment({
        ...uploadedAgo(60),
        deletedAt: sql`now()`,
      })
      const deletedWhilePending = await insertAttachment({
        ...ranOut(1),
        deletedAt: sql`now()`,
      })
      // What a URL that still worked took after the attachment was deleted.
      upload(deletedWhilePending)
      upload(abandonedWithFile)

      const waiting = await insertAttachment(ranOut(DAY - 1))
      const fresh = await insertAttachment()
      const deletedWithUrl = await insertAttachment({
        ...ranOut(-1),
        deletedAt: sql`now()`,
      })
      const kept = await insertAttachment(uploadedAgo(400 * DAY))
      for (const id of [waiting, fresh, deletedWithUrl, kept]) {
        upload(id)
      }

      const response = await purge()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ purgedCount: 4 })
      expect(response.body.links).toBeNull()
      expect(response.body.meta).toMatchObject({ version: 'v1' })
      expect(await storedIds()).toEqual(
        [waiting, fresh, deletedWithUrl, kept].sort(),
      )
      expect([...storage.files.keys()].sort()).toEqual(
        [waiting, fresh, deletedWithUrl, kept].map(keyOf).sort(),
      )
      // Every row that went had its file removed, stored or not.
      expect(
        storage.calls.filter((call) => call.startsWith('remove')).sort(),
      ).toEqual(
        [abandoned, abandonedWithFile, deleted, deletedWhilePending]
          .map((id) => `remove ${keyOf(id)}`)
          .sort(),
      )
    })

    it('purges nothing twice: a second run finds nothing', async () => {
      await insertAttachment(ranOut(DAY + 1))

      const first = await purge()
      const second = await purge()

      expect(first.body.data).toEqual({ purgedCount: 1 })
      expect(second.status).toBe(200)
      expect(second.body.data).toEqual({ purgedCount: 0 })
    })

    it('answers a count of zero when there is nothing to purge', async () => {
      const id = await uploaded()

      const response = await purge()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ purgedCount: 0 })
      expect(await storedIds()).toEqual([id])
      expect(storage.files.size).toBe(1)
    })

    it('takes no body, and ignores one', async () => {
      await insertAttachment(ranOut(DAY + 1))

      const response = await purge().send({ pendingKeptHours: 0, all: true })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ purgedCount: 1 })
    })

    it('stops at the first file that cannot be removed: what came before is purged, the rest at the next run', async () => {
      const ids = [
        await insertAttachment(ranOut(DAY + 1)),
        await insertAttachment(ranOut(DAY + 1)),
        await insertAttachment(ranOut(DAY + 1)),
      ].sort()
      for (const id of ids) {
        upload(id)
      }
      // The storage goes down once the first file is removed.
      storage.beforeRemove = async () => {
        storage.failing.add('remove')
      }

      const failed = await purge()

      expectProblem(failed, storageProblem)
      expect(await storedIds()).toEqual(ids.slice(1))
      expect([...storage.files.keys()].sort()).toEqual(ids.slice(1).map(keyOf))

      storage.failing.clear()
      storage.beforeRemove = async () => {}
      const again = await purge()

      expect(again.body.data).toEqual({ purgedCount: 2 })
      expect(await everything()).toEqual([])
      expect(storage.files.size).toBe(0)
    })

    it.each([
      ['the owner of a salon', member('owner')],
      ['a manager of a salon', member('manager')],
      ['a staff member of a salon', member('staff')],
      ...outsiders,
    ])('refuses %s and purges nothing', async (_who, signInAs) => {
      const { authorization } = await signInAs()
      const id = await insertAttachment(ranOut(DAY + 1))

      const response = await purge(authorization)

      expectProblem(response, forbidden)
      expect(await storedIds()).toEqual([id])
      expect(storage.calls).toEqual([])
    })

    it.each(unauthenticated)(
      'answers 401 for %s',
      async (_case, tokenOf, problem, challenge) => {
        const id = await insertAttachment(ranOut(DAY + 1))

        const response = await purge(await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await storedIds()).toEqual([id])
      },
    )
  })

  describe('what the storage and the database fail at', () => {
    it('logs why the storage failed and answers nothing of it', async () => {
      const logs: unknown[] = []
      const logged = createTestApp({ logs, fileStorage: storage })
      const id = await uploaded()
      storage.failing.add('issueDownload')

      const response = await request(logged)
        .get(`${PATH}/${id}/download-url`)
        .set('Authorization', asAdmin)

      expectProblem(response, storageProblem)
      expect(response.body).toMatchObject({
        title: 'Internal server error',
        detail: null,
        errors: null,
      })
      expect(JSON.stringify(response.body)).not.toContain('Down')
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'error',
          msg: 'The storage of the tests fails to issueDownload',
          cause: { name: 'Down' },
        }),
      )
    })

    it('answers 500 for every operation when the database cannot be reached, and asks nothing of the storage', async () => {
      const id = await uploaded()
      storage.calls.length = 0
      const connection = connectUnreachableDatabase()
      // Signs in while the database is there, and asks once it is not.
      const sessions = createTestApp({ fileStorage: storage })
      const session = await signedInUser(sessions, db, { role: 'admin' })
      const before = await everything()
      const broken = createTestApp({
        database: connection.database,
        fileStorage: storage,
      })

      const response = await request(broken)
        .get(`${PATH}/${id}`)
        .set('Authorization', session.authorization)
      await connection.close()

      expectProblem(response, databaseProblem)
      expect(await everything()).toEqual(before)
      expect(storage.calls).toEqual([])
    })
  })

  describe('what the routes do not serve', () => {
    it.each<['get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['post', PATH],
      ['put', PATH],
      ['delete', PATH],
      ['post', `${PATH}/${UNKNOWN_ID}`],
      ['put', `${PATH}/${UNKNOWN_ID}`],
      ['patch', `${PATH}/${UNKNOWN_ID}`],
      ['get', `${PATH}/${UNKNOWN_ID}/complete`],
      ['put', `${PATH}/${UNKNOWN_ID}/complete`],
      ['post', `${PATH}/${UNKNOWN_ID}/download-url`],
      ['get', `${PATH}/${UNKNOWN_ID}/content`],
      ['post', `${PATH}/upload`],
      ['put', `${PATH}/upload-url`],
      ['put', `${PATH}/purge`],
      ['post', `${PATH}/${UNKNOWN_ID}/share`],
    ])('answers 404 to %s %s, and changes nothing', async (method, path) => {
      const id = await uploaded()
      const before = await everything()
      storage.calls.length = 0

      const response = await authorized(
        request(app)[method](path.replace(UNKNOWN_ID, id)),
        asAdmin,
      )

      expectProblem(response, routeNotFound)
      expect(await everything()).toEqual(before)
      expect(storage.calls).toEqual([])
    })

    it('reads the fixed paths as IDs under the methods they are not served by', async () => {
      const read = await authorized(request(app).get(`${PATH}/purge`), asAdmin)
      const removed = await authorized(
        request(app).delete(`${PATH}/upload-url`),
        asAdmin,
      )

      expectProblem(read, badRequest)
      expect(read.body.detail).toBe(INVALID_ID)
      expectProblem(removed, badRequest)
      expect(await everything()).toEqual([])
    })

    it('takes no file itself: a multipart upload is not a request it reads', async () => {
      const response = await authorized(
        request(app).post(`${PATH}/upload-url`),
        asAdmin,
      ).attach('file', Buffer.from(fileOf(PNG, 64)), 'before.png')

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
      expect(await everything()).toEqual([])
    })
  })

  describe('requests at the same moment', () => {
    it('completes an upload once when two requests complete it at once', async () => {
      const { id } = await announced()
      upload(id)

      const [first, second] = await Promise.all([complete(id), complete(id)])

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(first.body.data).toEqual(second.body.data)
      expect(first.body.data.status).toBe('uploaded')
    })

    it('holds an attachment while the purge removes its file: a request that completes it waits and finds it gone', async () => {
      const id = await insertAttachment(ranOut(24 * 60 + 1))
      upload(id)
      const removal = gate()
      const reached = gate()
      storage.beforeRemove = async () => {
        reached.open()
        await removal.opened
      }

      const purging = purge().then((response) => response)
      await reached.opened
      // The file is still there, and so is the row: the completion looks
      // at the file and then waits for the row.
      const completing = complete(id).then((response) => response)
      const answeredEarly = await answersWithin(completing, 300)
      removal.open()
      const [purged, completed] = await Promise.all([purging, completing])

      expect(answeredEarly).toBe(false)
      expect(purged.body.data).toEqual({ purgedCount: 1 })
      expectProblem(completed, notFound)
      expect(await everything()).toEqual([])
      expect(storage.files.size).toBe(0)
    })

    it('keeps an attachment that was completed before the purge got to it', async () => {
      const id = await insertAttachment(ranOut(24 * 60 + 1))
      upload(id)

      const completed = await complete(id)
      const purged = await purge()

      expect(completed.status).toBe(200)
      expect(purged.body.data).toEqual({ purgedCount: 0 })
      expect(await storedIds()).toEqual([id])
      expect(storage.files.has(keyOf(id))).toBe(true)
    })

    it('looks at an attachment again once it holds it: one that is completed while the purge removes the file of another stays', async () => {
      // The purge takes them in the order of their IDs.
      const [first = '', second = ''] = [
        await insertAttachment(ranOut(24 * 60 + 1)),
        await insertAttachment(ranOut(24 * 60 + 1)),
      ].sort()
      upload(first)
      upload(second)
      const removal = gate()
      const reached = gate()
      storage.beforeRemove = async () => {
        reached.open()
        await removal.opened
      }

      const purging = purge().then((response) => response)
      await reached.opened
      const completed = await complete(second)
      removal.open()
      const purged = await purging

      expect(completed.status).toBe(200)
      expect(purged.body.data).toEqual({ purgedCount: 1 })
      expect(await storedIds()).toEqual([second])
      expect(storage.files.has(keyOf(second))).toBe(true)
      expect(storage.calls.filter((call) => call.startsWith('remove'))).toEqual(
        [`remove ${keyOf(first)}`],
      )
    })

    it('purges every attachment once when two purges run at once', async () => {
      for (let count = 0; count < 6; count += 1) {
        upload(await insertAttachment(ranOut(24 * 60 + 1)))
      }

      const [first, second] = await Promise.all([purge(), purge()])

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(first.body.data.purgedCount + second.body.data.purgedCount).toBe(6)
      expect(await everything()).toEqual([])
      expect(storage.files.size).toBe(0)
    })

    it('deletes an attachment once when two requests delete it at once', async () => {
      const id = await uploaded()

      const responses = await Promise.all([remove(id), remove(id)])

      expect(responses.map(({ status }) => status).sort()).toEqual([204, 404])
      expect(storage.files.size).toBe(0)
    })

    it('does not complete an attachment that is deleted while its file is looked at', async () => {
      const { id } = await announced()
      upload(id)

      const [completed, removed] = await Promise.all([complete(id), remove(id)])

      expect(removed.status).toBe(204)
      expect([200, 404, 409]).toContain(completed.status)
      expect(await stored(id)).toMatchObject({ deletedAt: expect.any(String) })
      expectProblem(await read(id), notFound)
    })
  })

  describe('what the database holds an attachment to', () => {
    /** What a write that the database refuses failed of. */
    const failureOf = (write: Promise<unknown>): Promise<unknown> =>
      write.then(
        () => null,
        (error: unknown) => error,
      )

    it.each<[string, Partial<NewAttachment>, string, string]>([
      [
        'an empty name',
        { filename: '' },
        '23514',
        'attachments_filename_not_empty',
      ],
      ['an empty file', { size: 0 }, '23514', 'attachments_size_within_limit'],
      [
        'a file of 10 MiB and a byte',
        { size: MOST_SIZE + 1 },
        '23514',
        'attachments_size_within_limit',
      ],
      [
        'an uploaded attachment without the time of its upload',
        { status: 'uploaded' },
        '23514',
        'attachments_uploaded_when_uploaded',
      ],
      [
        'a pending attachment with the time of an upload',
        { uploadedAt: '2026-11-18T00:00:00Z' },
        '23514',
        'attachments_uploaded_when_uploaded',
      ],
      [
        'an upload URL that runs out when the attachment is made',
        { uploadExpiresAt: sql`now()` },
        '23514',
        'attachments_upload_expires_after_created',
      ],
      [
        'a salon that does not exist',
        { salonId: UNKNOWN_ID },
        '23503',
        'attachments_salon_id_fk',
      ],
      [
        'an uploader that does not exist',
        { uploadedBy: UNKNOWN_ID },
        '23503',
        'attachments_uploaded_by_fk',
      ],
    ])('refuses %s', async (_case, overrides, code, constraint) => {
      const failure = await failureOf(insertAttachment(overrides))

      expect(failure).toMatchObject({
        cause: { code, constraint_name: constraint },
      })
      expect(await everything()).toEqual([])
    })

    it.each(['a GIF image', 'IMAGE/PNG'])(
      'refuses a type that is not one of the four: %s',
      async (contentType) => {
        const failure = await failureOf(
          getTestDbClient()`
          INSERT INTO attachments (filename, "contentType", size, "uploadedBy", "uploadExpiresAt")
          VALUES ('a.gif', ${contentType}, 64, ${adminId}, now() + interval '15 minutes')
        `,
        )

        expect(failure).toMatchObject({ code: '22P02' })
      },
    )

    it('takes a file of 10 MiB and a name of 255 characters', async () => {
      const id = await insertAttachment({
        size: MOST_SIZE,
        filename: 'あ'.repeat(255),
      })

      expect(await stored(id)).toMatchObject({ size: MOST_SIZE })
    })

    it('keeps a salon that has attachments from being removed for good', async () => {
      await insertAttachment(uploadedAgo(10))

      const failure = await failureOf(
        db.delete(salons).where(eq(salons.id, salonId)),
      )

      expect(failure).toMatchObject({
        cause: { code: '23503', constraint_name: 'attachments_salon_id_fk' },
      })
    })
  })
})
