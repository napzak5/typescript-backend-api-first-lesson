import {
  bookings,
  salons,
  services,
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import { asc, eq, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertCustomer,
  insertMember,
  insertSalon,
  insertSession,
  insertStaff,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
} from '../../../__tests__/_shared/auth-helpers'
import {
  authenticationRequired,
  badRequest,
  createTestApp,
  databaseMoment,
  type ExpectedProblem,
  expectProblem,
  forbidden,
  getTestDb,
  invalidToken,
  notAllowed,
  notFound,
  request,
  routeNotFound,
  tokenExpired,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const INVALID_PHOTOS = 'Invalid treatment photos'
const INVALID_RECORD_ID = 'Invalid treatment record ID'
const INVALID_PHOTO_ID = 'Invalid treatment photo ID'

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

/** Checks a refusal of the request: its message and, when given, what it broke. */
const expectRefused = (
  response: Response,
  detail: string,
  errors?: unknown[],
): void => {
  expectProblem(response, badRequest)
  expect(response.body.detail).toBe(detail)
  if (errors !== undefined) {
    expect(response.body.errors).toEqual(errors)
  }
}

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** Whether a request is answered while what it may wait for is held. */
const answersWithin = (
  call: Promise<unknown>,
  milliseconds: number,
): Promise<boolean> =>
  Promise.race([call.then(() => true), pause(milliseconds).then(() => false)])

/** A time of 20 November 2026 in UTC, `HH:MM`. */
const at = (time: string): string => `2026-11-20T${time}:00Z`

/** A photo of an addition at an address of its own: public, with consent. */
const photoOf = (name: string, overrides: Record<string, unknown> = {}) => ({
  photoType: 'after',
  photoUrl: `https://images.example.com/${name}.jpg`,
  thumbnailUrl: null,
  angle: null,
  description: null,
  isPublic: true,
  customerConsent: true,
  sortOrder: 0,
  ...overrides,
})

/** The photos of an addition at the places of their position. */
const photosNamed = (...names: string[]) => ({
  photos: names.map((name, sortOrder) => photoOf(name, { sortOrder })),
})

describe('Treatment photo API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests, its customer, a staff member and a service. */
  let salonId: string
  let customerId: string
  let staffId: string
  let cutId: string

  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A booking of the salon in progress, of the customer and staff member given; returns its ID. */
  const insertBooking = async (
    ofSalon: string = salonId,
    ofCustomer: string = customerId,
    ofStaff: string = staffId,
  ): Promise<string> => {
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-PHOTO-${nextRow()}`,
        salonId: ofSalon,
        customerId: ofCustomer,
        staffId: ofStaff,
        bookingDate: '2026-11-20',
        startTime: at('01:00'),
        endTime: at('02:00'),
        duration: 60,
        subtotal: 6600,
        totalAmount: 6600,
        status: 'in_progress',
        actualStartTime: at('01:00'),
      })
      .returning({ id: bookings.id })
    if (booking === undefined) {
      throw new Error('No booking was inserted')
    }
    return booking.id
  }

  /** A record of a booking of the salon, written an hour ago; returns its ID. */
  const insertRecord = async (): Promise<string> => {
    const [record] = await db
      .insert(treatmentRecords)
      .values({
        bookingId: await insertBooking(),
        customerId,
        staffId,
        services: [cutId],
        createdAt: sql`now() - interval '1 hour'`,
        updatedAt: sql`now() - interval '1 hour'`,
      })
      .returning({ id: treatmentRecords.id })
    if (record === undefined) {
      throw new Error('No treatment record was inserted')
    }
    return record.id
  }

  /** A record of a booking of another salon; returns the record and its salon. */
  const insertRecordElsewhere = async (): Promise<{
    id: string
    salonId: string
  }> => {
    const otherSalon = await insertSalon(db)
    const theirStaff = await insertStaff(db, otherSalon)
    const theirCustomer = await insertCustomer(db)
    const [record] = await db
      .insert(treatmentRecords)
      .values({
        bookingId: await insertBooking(otherSalon, theirCustomer, theirStaff),
        customerId: theirCustomer,
        staffId: theirStaff,
        services: [cutId],
      })
      .returning({ id: treatmentRecords.id })
    if (record === undefined) {
      throw new Error('No treatment record was inserted')
    }
    return { id: record.id, salonId: otherSalon }
  }

  /** Photos of a record written directly, at the places of their position; returns their IDs. */
  const insertPhotos = async (
    recordId: string,
    names: string[],
  ): Promise<string[]> => {
    const inserted = await db
      .insert(treatmentPhotos)
      .values(
        names.map((name, sortOrder): typeof treatmentPhotos.$inferInsert => ({
          treatmentRecordId: recordId,
          photoType: 'before',
          photoUrl: `https://images.example.com/${name}.jpg`,
          sortOrder,
        })),
      )
      .returning({ id: treatmentPhotos.id })
    return inserted.map(({ id }) => id)
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db)
    customerId = await insertCustomer(db)
    staffId = await insertStaff(db, salonId)
    const [cut] = await db
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
    cutId = cut?.id ?? ''
  })

  const PATH = '/api/v1/treatments'

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const add = (id: string, body: unknown, as: string | null = asAdmin): Test =>
    authorized(request(app).post(`${PATH}/${id}/photos`), as).send(
      body ?? undefined,
    )

  const remove = (
    id: string,
    photoId: string,
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).delete(`${PATH}/${id}/photos/${photoId}`), as)

  const get = (id: string): Test =>
    authorized(request(app).get(`${PATH}/${id}`), asAdmin)

  /** The photos of a record as stored, in the order the record shows them. */
  const storedPhotos = (id: string) =>
    db
      .select()
      .from(treatmentPhotos)
      .where(eq(treatmentPhotos.treatmentRecordId, id))
      .orderBy(
        asc(treatmentPhotos.sortOrder),
        asc(treatmentPhotos.createdAt),
        asc(treatmentPhotos.id),
      )

  /** When the record was last changed, as a time. */
  const updatedAtOf = async (id: string): Promise<number> => {
    const [record] = await db
      .select({ updatedAt: treatmentRecords.updatedAt })
      .from(treatmentRecords)
      .where(eq(treatmentRecords.id, id))
    return new Date(record?.updatedAt ?? '').getTime()
  }

  /** Every record and photo, to tell that nothing was written. */
  const everything = async () => ({
    records: await db
      .select()
      .from(treatmentRecords)
      .orderBy(asc(treatmentRecords.id)),
    materials: await db
      .select()
      .from(treatmentMaterials)
      .orderBy(asc(treatmentMaterials.id)),
    photos: await db
      .select()
      .from(treatmentPhotos)
      .orderBy(asc(treatmentPhotos.id)),
  })

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  /** A member of a salon; of the salon of the tests unless another is given. */
  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
      staffOverrides: Parameters<typeof insertMember>[3] = {},
    ): SignInAs =>
    async () => {
      const { email } = await insertMember(
        db,
        role,
        await salonOf(),
        staffOverrides,
      )
      return (await signIn(app, email)).authorization
    }

  /** Everyone who writes the records of the salon of the tests. */
  const writers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Accounts that reach no records at all. */
  const outsiders: [string, SignInAs][] = [
    [
      'a customer with a profile',
      async () => (await signedInUser(app, db, { customerId })).authorization,
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
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

  describe('POST /api/v1/treatments/:id/photos', () => {
    it.each(writers)(
      'adds the photos for %s, answers them in the order given with their IDs, and links to the record',
      async (_who, signInAs) => {
        const authorization = await signInAs()
        const id = await insertRecord()
        const before = await updatedAtOf(id)
        const addition = {
          photos: [
            photoOf('after', { sortOrder: 2, angle: '正面' }),
            photoOf('before', {
              photoType: 'before',
              sortOrder: 0,
              thumbnailUrl: 'https://images.example.com/before-s.jpg',
              description: '施術前',
              isPublic: false,
              customerConsent: false,
            }),
            photoOf('during', { photoType: 'during', sortOrder: 1 }),
          ],
        }

        const response = await add(id, addition, authorization)

        expect(response.status).toBe(201)
        expect(response.headers['location']).toBeUndefined()
        const stored = await storedPhotos(id)
        const idOf = (name: string): string | undefined =>
          stored.find(
            ({ photoUrl }) =>
              photoUrl === `https://images.example.com/${name}.jpg`,
          )?.id
        expect(response.body.data).toEqual({
          created: addition.photos.map((photo, index) => ({
            id: idOf(['after', 'before', 'during'][index] ?? ''),
            ...photo,
          })),
        })
        expect(response.body.data.created[0].id).toMatch(UUID)
        expect(response.body.links).toEqual({ record: `${PATH}/${id}` })
        expect(response.body.meta).toMatchObject({ version: 'v1' })

        // The record shows them by their places, and changed when they came.
        expect(stored.map(({ photoType }) => photoType)).toEqual([
          'before',
          'during',
          'after',
        ])
        const changed = await updatedAtOf(id)
        expect(changed).toBeGreaterThan(before)
        expect(
          stored.map(({ createdAt }) => new Date(createdAt).getTime()),
        ).toEqual([changed, changed, changed])
        expect((await get(id)).body.data.photos).toEqual([
          response.body.data.created[1],
          response.body.data.created[2],
          response.body.data.created[0],
        ])
      },
    )

    it('puts a later photo after an earlier one of the same place', async () => {
      const id = await insertRecord()
      const first = await add(id, {
        photos: [photoOf('first', { sortOrder: 5 })],
      })
      const second = await add(id, {
        photos: [
          photoOf('second', { sortOrder: 5 }),
          photoOf('third', { sortOrder: 4 }),
        ],
      })

      expect([first.status, second.status]).toEqual([201, 201])
      expect(
        (await get(id)).body.data.photos.map(
          ({ photoUrl }: { photoUrl: string }) => photoUrl,
        ),
      ).toEqual([
        'https://images.example.com/third.jpg',
        'https://images.example.com/first.jpg',
        'https://images.example.com/second.jpg',
      ])
    })

    it('adds photos up to twenty a record, and refuses one more with a conflict that changes nothing', async () => {
      const id = await insertRecord()
      await insertPhotos(
        id,
        Array.from({ length: 18 }, (_, index) => `held-${index}`),
      )

      expect((await add(id, photosNamed('19th', '20th'))).status).toBe(201)
      const before = await everything()
      const refused = await add(id, photosNamed('21st'))

      expectProblem(refused, notAllowed)
      expect(refused.body.detail).toBe(
        'The record holds 20 photos; a record holds at most 20',
      )
      expect(await everything()).toEqual(before)
    })

    it('refuses an addition beyond twenty as a whole', async () => {
      const id = await insertRecord()
      await insertPhotos(
        id,
        Array.from({ length: 15 }, (_, index) => `held-${index}`),
      )
      const before = await everything()

      const refused = await add(id, photosNamed('a', 'b', 'c', 'd', 'e', 'f'))

      expectProblem(refused, notAllowed)
      expect(refused.body.detail).toBe(
        'The record holds 15 photos; a record holds at most 20',
      )
      expect(await everything()).toEqual(before)
    })

    it('refuses an addition with a photo at an address the record holds, as a whole, and takes that address for another record', async () => {
      const id = await insertRecord()
      const other = await insertRecord()
      await insertPhotos(id, ['held'])
      const before = await everything()

      const refused = await add(id, photosNamed('new', 'held'))

      expectProblem(refused, notAllowed)
      expect(refused.body.detail).toBe(
        'The record holds a photo at https://images.example.com/held.jpg already; a record holds one photo of an address',
      )
      expect(await everything()).toEqual(before)
      expect((await add(other, photosNamed('held'))).status).toBe(201)
    })

    it('refuses the same request sent twice, and keeps the photos of the first', async () => {
      const id = await insertRecord()
      const addition = photosNamed('a', 'b')

      expect((await add(id, addition)).status).toBe(201)
      expectProblem(await add(id, addition), notAllowed)
      expect(await storedPhotos(id)).toHaveLength(2)
    })

    it('refuses a photo that breaks a rule of its own, and an addition that repeats an address or a place, telling each', async () => {
      const id = await insertRecord()
      const before = await everything()

      expectRefused(
        await add(id, {
          photos: [
            photoOf('a', { isPublic: true, customerConsent: false }),
            photoOf('a', { sortOrder: 1 }),
            photoOf('c', { sortOrder: 1 }),
          ],
        }),
        INVALID_PHOTOS,
        [
          issue(
            'photos.0.isPublic',
            'custom',
            'Must have the consent of the customer',
          ),
          issue(
            'photos.1.photoUrl',
            'custom',
            'Must not repeat the address of an earlier photo',
          ),
          issue(
            'photos.2.sortOrder',
            'custom',
            'Must not repeat the sortOrder of an earlier photo',
          ),
        ],
      )
      expect(await everything()).toEqual(before)
    })

    it.each<[string, unknown, string]>([
      ['no photos', { photos: [] }, 'photos'],
      [
        'more than twenty photos',
        photosNamed(...Array.from({ length: 21 }, (_, index) => `p${index}`)),
        'photos',
      ],
      [
        'a kind that is not one',
        { photos: [photoOf('a', { photoType: 'BEFORE' })] },
        'photos.0.photoType',
      ],
      [
        'an address that is no URL',
        { photos: [photoOf('a', { photoUrl: 'after.jpg' })] },
        'photos.0.photoUrl',
      ],
      [
        'an address beyond 500 characters',
        { photos: [photoOf('a'.repeat(470))] },
        'photos.0.photoUrl',
      ],
      [
        'a blank description',
        { photos: [photoOf('a', { description: ' ' })] },
        'photos.0.description',
      ],
      [
        'a place below zero',
        { photos: [photoOf('a', { sortOrder: -1 })] },
        'photos.0.sortOrder',
      ],
      [
        'a key a photo does not have',
        { photos: [photoOf('a', { takenAt: at('01:00') })] },
        'photos.0.takenAt',
      ],
      [
        'a key of its own',
        { ...photosNamed('a'), recordId: UNKNOWN_ID },
        'recordId',
      ],
    ])('refuses %s, and changes nothing', async (_case, body, field) => {
      const id = await insertRecord()
      const before = await everything()

      const response = await add(id, body)

      expectRefused(response, INVALID_PHOTOS)
      expect(
        response.body.errors.map((error: { field: string }) => error.field),
      ).toEqual([field])
      expect(await everything()).toEqual(before)
    })

    it('refuses an ID that is no UUID before the body, and a body that is no JSON object', async () => {
      const id = await insertRecord()

      expectRefused(await add('record-1', null), INVALID_RECORD_ID)
      const malformed = await request(app)
        .post(`${PATH}/${id}/photos`)
        .set('Authorization', asAdmin)
        .set('Content-Type', 'application/json')
        .send('{"photos": [')
      expect(malformed.status).toBe(400)
      expect(malformed.body.type).toContain('malformed-body')
      expect(await storedPhotos(id)).toEqual([])
    })

    it('answers 404 to a member of another salon, for a record that is not there, and for one whose salon was deleted, and changes nothing', async () => {
      const elsewhere = await insertRecordElsewhere()
      const gone = await insertRecordElsewhere()
      await db
        .update(salons)
        .set({ deletedAt: at('00:00') })
        .where(eq(salons.id, gone.salonId))
      const manager = await member('manager')()
      const before = await everything()

      expectProblem(
        await add(elsewhere.id, photosNamed('a'), manager),
        notFound,
      )
      expectProblem(await add(UNKNOWN_ID, photosNamed('a')), notFound)
      expectProblem(await add(gone.id, photosNamed('a')), notFound)
      expect(await everything()).toEqual(before)
      expect((await add(elsewhere.id, photosNamed('a'))).status).toBe(201)
    })

    it('takes an ID in upper case, and links under the path as it was written', async () => {
      const id = await insertRecord()

      const response = await request(app)
        .post(`/API/V1/TREATMENTS/${id.toUpperCase()}/photos`)
        .set('Authorization', asAdmin)
        .send(photosNamed('a'))

      expect(response.status).toBe(201)
      expect(response.body.links).toEqual({
        record: `/API/V1/TREATMENTS/${id}`,
      })
      expect(await storedPhotos(id)).toHaveLength(1)
    })
  })

  describe('DELETE /api/v1/treatments/:id/photos/:photoId', () => {
    it.each(writers)(
      'removes a photo for %s, keeps the others, and changes the record',
      async (_who, signInAs) => {
        const authorization = await signInAs()
        const id = await insertRecord()
        const other = await insertRecord()
        const [first, second] = await insertPhotos(id, ['first', 'second'])
        const [ofOther] = await insertPhotos(other, ['first'])
        const before = await updatedAtOf(id)
        const otherBefore = await everything()

        const response = await remove(
          id.toUpperCase(),
          (first ?? '').toUpperCase(),
          authorization,
        )

        expect(response.status).toBe(204)
        expect(response.body).toEqual({})
        expect((await storedPhotos(id)).map(({ id }) => id)).toEqual([second])
        expect((await storedPhotos(other)).map(({ id }) => id)).toEqual([
          ofOther,
        ])
        expect(await updatedAtOf(id)).toBeGreaterThan(before)
        expect(
          (await everything()).records.find((record) => record.id === other),
        ).toEqual(otherBefore.records.find((record) => record.id === other))
      },
    )

    it('answers 404 for a photo of another record, and one that is not there, and changes nothing', async () => {
      const id = await insertRecord()
      const other = await insertRecord()
      await insertPhotos(id, ['mine'])
      const [ofOther] = await insertPhotos(other, ['theirs'])
      const before = await everything()

      const response = await remove(id, ofOther ?? '')

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('TreatmentPhoto')
      expectProblem(await remove(id, UNKNOWN_ID), notFound)
      expect(await everything()).toEqual(before)
    })

    it('answers 404 for a photo of a record of another salon to its members, of a record that is not there, and of a salon that was deleted', async () => {
      const elsewhere = await insertRecordElsewhere()
      const gone = await insertRecordElsewhere()
      const [photo] = await insertPhotos(elsewhere.id, ['theirs'])
      const [gonePhoto] = await insertPhotos(gone.id, ['gone'])
      await db
        .update(salons)
        .set({ deletedAt: at('00:00') })
        .where(eq(salons.id, gone.salonId))
      const owner = await member('owner')()
      const before = await everything()

      const response = await remove(elsewhere.id, photo ?? '', owner)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('TreatmentRecord')
      expectProblem(await remove(UNKNOWN_ID, photo ?? ''), notFound)
      expectProblem(await remove(gone.id, gonePhoto ?? ''), notFound)
      expect(await everything()).toEqual(before)
      expect((await remove(elsewhere.id, photo ?? '')).status).toBe(204)
    })

    it('refuses IDs that are no UUIDs, each by its name', async () => {
      const id = await insertRecord()
      const [photo] = await insertPhotos(id, ['kept'])

      expectRefused(await remove('record-1', 'photo-1'), INVALID_PHOTO_ID, [
        issue('id', 'invalid_format', 'Invalid UUID'),
        issue('photoId', 'invalid_format', 'Invalid UUID'),
      ])
      expectRefused(await remove(id, 'photo-1'), INVALID_PHOTO_ID)
      expectRefused(await remove('record-1', photo ?? ''), INVALID_PHOTO_ID)
      expect(await storedPhotos(id)).toHaveLength(1)
    })
  })

  describe('who may', () => {
    /** Each operation, as a request that would succeed for an administrator. */
    const operations: ((
      as: string | null,
      id: string,
      photoId: string,
    ) => Promise<Response>)[] = [
      async (as, id) => add(id, photosNamed('new'), as),
      async (as, id, photoId) => remove(id, photoId, as),
    ]

    it.each(outsiders)(
      'refuses %s both operations, even with IDs that are no UUIDs, and changes nothing',
      async (_who, signInAs) => {
        const id = await insertRecord()
        const [photo] = await insertPhotos(id, ['held'])
        const authorization = await signInAs()
        const before = await everything()

        const responses: Response[] = []
        for (const call of operations) {
          responses.push(await call(authorization, id, photo ?? ''))
          responses.push(await call(authorization, 'record-1', 'photo-1'))
        }

        expect(responses).toHaveLength(4)
        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await everything()).toEqual(before)
      },
    )

    it.each(unauthenticated)(
      'refuses %s both operations with 401, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const id = await insertRecord()
        const [photo] = await insertPhotos(id, ['held'])
        const token = await tokenOf()
        const before = await everything()

        for (const call of operations) {
          const response = await call(token, id, photo ?? '')
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['GET on the photos', 'get', '/ID/photos'],
      ['PUT on the photos', 'put', '/ID/photos'],
      ['DELETE on the photos', 'delete', '/ID/photos'],
      ['GET of a photo', 'get', '/ID/photos/PHOTO'],
      ['PATCH of a photo', 'patch', '/ID/photos/PHOTO'],
      ['POST on a photo', 'post', '/ID/photos/PHOTO'],
      ['POST of one photo by another name', 'post', '/ID/photo'],
      ['POST on the statistics', 'post', '/statistics'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await insertRecord()
        const [photo] = await insertPhotos(id, ['held'])
        const before = await everything()

        const response = await request(app)
          [method](
            `${PATH}${suffix.replace('ID', id).replace('PHOTO', photo ?? '')}`,
          )
          .set('Authorization', asAdmin)
          .send(photosNamed('new'))

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('requests at the same moment', () => {
    /** Holds the record as a write of a photo does, while the calls run; returns their answers. */
    const whileRecordHeld = async (
      id: string,
      calls: (() => Promise<Response>)[],
      holdFor = 300,
    ): Promise<{ answers: Response[]; answeredWhileHeld: boolean }> => {
      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .select({ id: treatmentRecords.id })
            .from(treatmentRecords)
            .where(eq(treatmentRecords.id, id))
            .for('no key update')
          const underWay = Promise.all(calls.map((call) => call()))
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, holdFor),
          }
        },
      )
      return { answers: await pending, answeredWhileHeld }
    }

    it('makes two additions wait for each other, so that the second counts the photos of the first', async () => {
      const id = await insertRecord()
      const tens = (prefix: string) =>
        photosNamed(
          ...Array.from({ length: 10 }, (_, index) => `${prefix}${index}`),
        )
      const eleven = photosNamed(
        ...Array.from({ length: 11 }, (_, index) => `b${index}`),
      )

      const { answers, answeredWhileHeld } = await whileRecordHeld(id, [
        () => add(id, tens('a')),
        () => add(id, eleven),
      ])

      expect(answeredWhileHeld).toBe(false)
      expect(answers.map(statusAndCode).sort()).toEqual(['201', '409 3003'])
      expect((await storedPhotos(id)).length).toBeLessThanOrEqual(20)
    })

    it('makes two removals of photos of one record wait for each other, and does both', async () => {
      const id = await insertRecord()
      const [first, second, third] = await insertPhotos(id, ['a', 'b', 'c'])

      const { answers, answeredWhileHeld } = await whileRecordHeld(id, [
        () => remove(id, first ?? ''),
        () => remove(id, second ?? ''),
      ])

      expect(answeredWhileHeld).toBe(false)
      expect(answers.map(statusAndCode)).toEqual(['204', '204'])
      expect((await storedPhotos(id)).map(({ id }) => id)).toEqual([third])
    })

    it('makes an addition wait for a change of the record, and writes the photos at the moment the wait is over', async () => {
      const id = await insertRecord()

      const { pending, answeredWhileHeld, releasedAt } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .update(treatmentRecords)
            .set({ resultNotes: '仕上がり良好' })
            .where(eq(treatmentRecords.id, id))
          const underWay = add(id, photosNamed('a', 'b')).then(
            (response) => response,
          )
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
            releasedAt: await databaseMoment(tx),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(201)
      const [photo] = await storedPhotos(id)
      expect(new Date(photo?.createdAt ?? '').getTime()).toBeGreaterThanOrEqual(
        releasedAt,
      )
      expect(await updatedAtOf(id)).toBeGreaterThanOrEqual(releasedAt)
    })

    it('makes a removal of a photo wait for a change of the record before it removes anything', async () => {
      const id = await insertRecord()
      const [photo] = await insertPhotos(id, ['held'])

      const { pending, photoFree } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .update(treatmentRecords)
            .set({ resultNotes: '仕上がり良好' })
            .where(eq(treatmentRecords.id, id))
          const underWay = remove(id, photo ?? '').then((response) => response)
          await answersWithin(underWay, 300)
          // The removal waits at the record, before it reaches the photo.
          const free = await tx
            .transaction(async (savepoint) => {
              await savepoint.execute(
                sql`SELECT id FROM treatment_photos WHERE id = ${photo} FOR UPDATE NOWAIT`,
              )
              return true
            })
            .catch(() => false)
          return { pending: underWay, photoFree: free }
        },
      )

      expect(photoFree).toBe(true)
      expect((await pending).status).toBe(204)
      expect(await storedPhotos(id)).toEqual([])
    })

    it.each<[string, (id: string, photoId: string) => Test]>([
      ['an addition', (id) => add(id, photosNamed('a'))],
      ['a removal of a photo', (id, photoId) => remove(id, photoId)],
    ])(
      'makes %s wait for a removal of the record, and answers 404 once it is removed',
      async (_case, call) => {
        const id = await insertRecord()
        const [photo] = await insertPhotos(id, ['held'])

        const { pending, answeredWhileHeld } = await db.transaction(
          async (tx: Transaction) => {
            await tx.delete(treatmentRecords).where(eq(treatmentRecords.id, id))
            const underWay = call(id, photo ?? '').then((response) => response)
            return {
              pending: underWay,
              answeredWhileHeld: await answersWithin(underWay, 300),
            }
          },
        )
        const response = await pending

        expect(answeredWhileHeld).toBe(false)
        expectProblem(response, notFound)
        expect(response.body.detail).toContain('TreatmentRecord')
        expect(await storedPhotos(id)).toEqual([])
      },
    )

    it.each<[string, (id: string, photoId: string) => Test, number]>([
      ['an addition', (id) => add(id, photosNamed('a')), 201],
      ['a removal', (id, photoId) => remove(id, photoId), 204],
    ])(
      'lets %s past a write of another child row of the record',
      async (_case, call, status) => {
        const id = await insertRecord()
        const [photo] = await insertPhotos(id, ['held'])

        const answered = await db.transaction(async (tx: Transaction) => {
          // A child row written directly takes the lock of its foreign key
          // on the record, as every child row does.
          await tx.insert(treatmentPhotos).values({
            treatmentRecordId: id,
            photoType: 'other',
            photoUrl: 'https://images.example.com/uncommitted.jpg',
          })
          const underWay = call(id, photo ?? '').then((response) => response)
          const within = await answersWithin(underWay, 2000)
          return { within, underWay }
        })

        expect(answered.within).toBe(true)
        expect((await answered.underWay).status).toBe(status)
      },
    )
  })
})
