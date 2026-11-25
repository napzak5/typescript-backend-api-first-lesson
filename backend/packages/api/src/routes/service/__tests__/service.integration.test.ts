import { randomUUID } from 'node:crypto'
import {
  salons,
  serviceOptions,
  services,
} from '@beauty-salon-backend/database'
import {
  categoryIdSchema,
  type DbNewService,
  type DbNewServiceOption,
  type DomainError,
  type ServiceWithOptions,
  salonIdSchema,
  serviceIdSchema,
} from '@beauty-salon-backend/domain'
import { ServiceRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { asc, eq, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertCustomer,
  insertMember,
  insertSalon,
  insertSession,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
  signInAsAdmin,
} from '../../../__tests__/_shared/auth-helpers'
import {
  authenticationRequired,
  badRequest,
  brokenRules,
  createTestApp,
  databaseProblem,
  type ExpectedProblem,
  expectProblem,
  forbidden,
  getTestDb,
  ISO_TIMESTAMP,
  invalidToken,
  notAllowed,
  notFound,
  request,
  tokenExpired,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

const SALONS = '/api/v1/salons'

/** Where the services of a salon are. */
const servicesOf = (salonId: string): string => `${SALONS}/${salonId}/services`

/** Where the categories of a salon are. */
const categoriesOf = (salonId: string): string =>
  `${SALONS}/${salonId}/service-categories`

/** A UUID that neither a salon, a service nor a category has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** Another UUID that nothing has. */
const ANOTHER_UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c'

/** The largest value of an `integer` column. */
const MAX_INTEGER = 2_147_483_647

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

/** An option of a service as the API returns it and takes it. */
type ServiceOption = {
  name: string
  description: string | null
  optionType: string
  additionalTime: number
  additionalPrice: number
  maxQuantity: number
  isRequired: boolean
  sortOrder: number
  isActive: boolean
}

/** A service as the API returns it. */
type Service = {
  id: string
  salonId: string
  categoryId: string | null
  name: string
  description: string | null
  shortDescription: string | null
  duration: number
  price: number
  discountPrice: number | null
  taxIncluded: boolean
  pricingStrategy: string
  imageUrl: string | null
  imageUrls: string[]
  requiredStaffLevel: string | null
  maxBookingsPerDay: number | null
  requiresConsultation: boolean
  allowOnlineBooking: boolean
  bookingRequirements: string[]
  isPackage: boolean
  packageServiceIds: string[]
  tags: string[]
  sortOrder: number
  serviceStatus: string
  availability: string
  isActive: boolean
  options: ServiceOption[]
  createdAt: string
  updatedAt: string
}

/** Exactly the properties of ServiceResponse. */
const RESPONSE_PROPERTIES = [
  'id',
  'salonId',
  'categoryId',
  'name',
  'description',
  'shortDescription',
  'duration',
  'price',
  'discountPrice',
  'taxIncluded',
  'pricingStrategy',
  'imageUrl',
  'imageUrls',
  'requiredStaffLevel',
  'maxBookingsPerDay',
  'requiresConsultation',
  'allowOnlineBooking',
  'bookingRequirements',
  'isPackage',
  'packageServiceIds',
  'tags',
  'sortOrder',
  'serviceStatus',
  'availability',
  'isActive',
  'options',
  'createdAt',
  'updatedAt',
]

/** Exactly the properties of ServiceOption. */
const OPTION_PROPERTIES = [
  'name',
  'description',
  'optionType',
  'additionalTime',
  'additionalPrice',
  'maxQuantity',
  'isRequired',
  'sortOrder',
  'isActive',
]

/** An option that satisfies every rule. */
const optionRequest = (overrides: Record<string, unknown> = {}) => ({
  name: 'Head spa',
  description: 'Ten more minutes of massage',
  optionType: 'addon',
  additionalTime: 10,
  additionalPrice: 1100,
  maxQuantity: 1,
  isRequired: false,
  sortOrder: 0,
  isActive: true,
  ...overrides,
})

/** A request that satisfies every rule: a plain service with one option. */
const serviceRequest = (overrides: Record<string, unknown> = {}) => ({
  categoryId: null,
  name: 'Cut and blow-dry',
  description: 'A cut with a shampoo and a blow-dry',
  shortDescription: 'Cut & blow',
  duration: 60,
  price: 6600,
  discountPrice: 5500,
  taxIncluded: true,
  pricingStrategy: 'fixed',
  imageUrl: 'https://aoyama.example.com/services/cut.jpg',
  imageUrls: ['https://aoyama.example.com/services/cut-1.jpg'],
  requiredStaffLevel: 'stylist',
  maxBookingsPerDay: 8,
  requiresConsultation: false,
  allowOnlineBooking: true,
  bookingRequirements: ['advance_booking_required'],
  isPackage: false,
  packageServiceIds: [],
  tags: ['cut', 'popular'],
  sortOrder: 10,
  serviceStatus: 'active',
  availability: 'always',
  isActive: true,
  options: [optionRequest()],
  ...overrides,
})

/** An http URL of exactly `length` characters. */
const urlOfLength = (length: number): string => {
  const start = 'https://aoyama.example.com/services/'
  return `${start}${'a'.repeat(length - start.length)}`
}

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
  ['a UUID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
]

/** The order in which a menu shows services: by sort order, then by ID. */
const inMenuOrder = (list: Service[]): Service[] =>
  list.toSorted(
    (left, right) =>
      left.sortOrder - right.sortOrder || (left.id < right.id ? -1 : 1),
  )

/** A response in a word: its status and, for a validation problem, the broken rules. */
const outcomeOf = (response: Response): string =>
  response.status === 400
    ? `400 ${brokenRules(response).join(',')}`
    : String(response.status)

const idsOf = (response: Response): string[] =>
  response.body.data.map(({ id }: Service) => id)

describe('Service API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon whose services the tests are about. */
  let salonId: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const post = (
    authorization: string | null,
    body: object,
    salon: string = salonId,
  ) =>
    authorized(request(app).post(servicesOf(salon)), authorization).send(body)

  const patch = (
    authorization: string | null,
    id: string,
    body: object,
    salon: string = salonId,
  ) =>
    authorized(
      request(app).patch(`${servicesOf(salon)}/${id}`),
      authorization,
    ).send(body)

  const bulk = (
    authorization: string | null,
    body: object,
    salon: string = salonId,
  ) =>
    authorized(
      request(app).patch(`${servicesOf(salon)}/bulk`),
      authorization,
    ).send(body)

  const remove = (
    authorization: string | null,
    id: string,
    salon: string = salonId,
  ) =>
    authorized(request(app).delete(`${servicesOf(salon)}/${id}`), authorization)

  const get = (id: string, salon: string = salonId) =>
    request(app).get(`${servicesOf(salon)}/${id}`)

  const list = (query = '', salon: string = salonId) =>
    request(app).get(
      query === '' ? servicesOf(salon) : `${servicesOf(salon)}?${query}`,
    )

  const createService = async (
    overrides: Record<string, unknown> = {},
    salon: string = salonId,
  ): Promise<Service> => {
    const response = await post(asAdmin, serviceRequest(overrides), salon)
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** A package of the given services, without options. */
  const createPackage = (
    memberIds: (string | undefined)[],
    overrides: Record<string, unknown> = {},
    salon: string = salonId,
  ): Promise<Service> =>
    createService(
      {
        name: 'Cut and colour',
        isPackage: true,
        packageServiceIds: memberIds,
        options: [],
        ...overrides,
      },
      salon,
    )

  /** Several plain services of a salon, by name. */
  const createServices = async (
    count: number,
    salon: string = salonId,
  ): Promise<Service[]> => {
    const created: Service[] = []
    for (let index = 0; index < count; index += 1) {
      created.push(await createService({ name: `Service ${index}` }, salon))
    }
    return created
  }

  /** A category of a salon, created through the API; returns its ID. */
  const createCategory = async (salon: string = salonId): Promise<string> => {
    const response = await request(app)
      .post(categoriesOf(salon))
      .set('Authorization', asAdmin)
      .send({
        name: 'カット',
        description: null,
        parentId: null,
        category: 'cut',
        displayOrder: 1,
        iconUrl: null,
        color: null,
        isActive: true,
      })
    expect(response.status).toBe(201)
    return response.body.data.id
  }

  const deleteCategory = (id: string, salon: string = salonId) =>
    request(app)
      .delete(`${categoriesOf(salon)}/${id}`)
      .set('Authorization', asAdmin)

  /** Hides a salon as `DELETE /api/v1/salons/:id` does; its rows stay. */
  const deleteSalon = async (id: string): Promise<void> => {
    const response = await request(app)
      .delete(`${SALONS}/${id}`)
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

  /** Every stored service of every salon, as its row. */
  const storedServices = () =>
    db.select().from(services).orderBy(asc(services.id))

  /** Every stored option of every service, as its row. */
  const storedOptions = () =>
    db
      .select()
      .from(serviceOptions)
      .orderBy(
        asc(serviceOptions.serviceId),
        asc(serviceOptions.sortOrder),
        asc(serviceOptions.id),
      )

  /** The stored row of one service. */
  const storedService = async (id: string) => {
    const [row] = await db.select().from(services).where(eq(services.id, id))
    if (row === undefined) {
      throw new Error(`No service ${id} is stored`)
    }
    return row
  }

  /** The stored options of one service, in the order of the menu. */
  const storedOptionsOf = (serviceId: string) =>
    db
      .select()
      .from(serviceOptions)
      .where(eq(serviceOptions.serviceId, serviceId))
      .orderBy(asc(serviceOptions.sortOrder), asc(serviceOptions.id))

  /** Every stored row of services and of their options. */
  const storedRows = async () => ({
    services: await storedServices(),
    options: await storedOptions(),
  })

  /** Whether the stored `updatedAt` of the service lies after its `createdAt`. */
  const hasMoved = async (id: string): Promise<boolean | undefined> => {
    const [row] = await db
      .select({
        moved: sql<boolean>`${services.updatedAt} > ${services.createdAt}`,
      })
      .from(services)
      .where(eq(services.id, id))
    return row?.moved
  }

  /** The packages that are not deleted and contain a package. */
  const packagesContainingPackages = async (): Promise<string[]> => {
    const rows = await storedServices()
    const packages = new Set(
      rows.filter((row) => row.isPackage).map((row) => row.id),
    )
    return rows
      .filter(
        (row) =>
          row.isPackage &&
          row.deletedAt === null &&
          row.packageServiceIds.some((member) => packages.has(member)),
      )
      .map((row) => row.id)
  }

  /** The packages that are not deleted and name a deleted service. */
  const packagesNamingDeletedServices = async (): Promise<string[]> => {
    const rows = await storedServices()
    const deleted = new Set(
      rows.filter((row) => row.deletedAt !== null).map((row) => row.id),
    )
    return rows
      .filter(
        (row) =>
          row.deletedAt === null &&
          row.packageServiceIds.some((member) => deleted.has(member)),
      )
      .map((row) => row.id)
  }

  type NewServiceRow = typeof services.$inferInsert
  type NewOptionRow = typeof serviceOptions.$inferInsert

  /** A service of a salon as a row, inserted directly; returns its ID. */
  const insertServiceRow = async (
    salon: string,
    overrides: Partial<NewServiceRow> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(services)
      .values({
        salonId: salon,
        name: 'Cut and blow-dry',
        duration: 60,
        price: 6600,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
        ...overrides,
      })
      .returning({ id: services.id })
    if (row === undefined) {
      throw new Error('No service was inserted')
    }
    return row.id
  }

  /** An option of a service as a row, inserted directly. */
  const insertOptionRow = async (
    serviceId: string,
    overrides: Partial<NewOptionRow> = {},
  ): Promise<void> => {
    await db.insert(serviceOptions).values({
      serviceId,
      name: 'Head spa',
      ...overrides,
    })
  }

  /**
   * Tokens that an operation which needs one refuses, before anything else
   * is looked at: none, one that names no session, one that has run out.
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

  describe('POST /api/v1/salons/:salonId/services', () => {
    it('creates the service with its options in the salon of the path and returns it with what the server assigned', async () => {
      const response = await post(asAdmin, serviceRequest())

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      const { data, meta, links } = response.body
      expect(data).toEqual({
        ...serviceRequest(),
        id: expect.stringMatching(UUID),
        salonId,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(links).toEqual({
        self: `${servicesOf(salonId)}/${data.id}`,
        list: servicesOf(salonId),
      })
      expect(response.headers['location']).toBe(links.self)
      expect(meta).toEqual({
        correlationId: expect.stringMatching(UUID),
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
        version: 'v1',
      })
      expect((await get(data.id)).body.data).toEqual(data)
    })

    it('returns exactly the properties of ServiceResponse, and of ServiceOption for an option', async () => {
      const response = await post(asAdmin, serviceRequest())

      expect(Object.keys(response.body.data).toSorted()).toEqual(
        RESPONSE_PROPERTIES.toSorted(),
      )
      expect(Object.keys(response.body.data.options[0]).toSorted()).toEqual(
        OPTION_PROPERTIES.toSorted(),
      )
    })

    it('stores one row for the service, not deleted, and one row for each option, tied to the service', async () => {
      const response = await post(
        asAdmin,
        serviceRequest({
          options: [
            optionRequest({ name: 'Head spa', sortOrder: 0 }),
            optionRequest({ name: 'Treatment', sortOrder: 1 }),
          ],
        }),
      )

      const { id } = response.body.data
      const { options: _options, ...columns } = serviceRequest()
      expect(await storedServices()).toEqual([
        {
          ...columns,
          id,
          salonId,
          deletedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ])
      expect(await storedOptions()).toEqual([
        {
          ...optionRequest({ name: 'Head spa', sortOrder: 0 }),
          id: expect.stringMatching(UUID),
          serviceId: id,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        {
          ...optionRequest({ name: 'Treatment', sortOrder: 1 }),
          id: expect.stringMatching(UUID),
          serviceId: id,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ])
    })

    it('stores null as it is given for the properties that may be unset', async () => {
      const unset = {
        categoryId: null,
        description: null,
        shortDescription: null,
        discountPrice: null,
        imageUrl: null,
        requiredStaffLevel: null,
        maxBookingsPerDay: null,
      }

      const response = await post(
        asAdmin,
        serviceRequest({
          ...unset,
          options: [optionRequest({ description: null })],
        }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        ...unset,
        options: [{ description: null }],
      })
      expect((await get(response.body.data.id)).body.data).toEqual(
        response.body.data,
      )
    })

    it.each([
      ['a name of 255 characters', { name: 'a'.repeat(255) }],
      [
        'a name of 255 characters outside the Basic Multilingual Plane',
        { name: '𠮷'.repeat(255) },
      ],
      ['a name with spaces around it, untrimmed', { name: '  カット  ' }],
      ['a description of any length', { description: 'a'.repeat(5000) }],
      [
        'a short description of 500 characters',
        { shortDescription: 'a'.repeat(500) },
      ],
      ['a duration of one minute', { duration: 1 }],
      ['a duration of a day', { duration: 1440 }],
      ['a price of 0', { price: 0, discountPrice: 0 }],
      [
        'the largest price the column holds',
        { price: MAX_INTEGER, discountPrice: MAX_INTEGER },
      ],
      ['a discount equal to the price', { price: 6600, discountPrice: 6600 }],
      ['a discount of 0', { discountPrice: 0 }],
      ['the smallest limit of bookings a day', { maxBookingsPerDay: 1 }],
      [
        'the largest limit of bookings a day the column holds',
        { maxBookingsPerDay: MAX_INTEGER },
      ],
      ['a sort order of 0', { sortOrder: 0 }],
      ['the largest sort order the column holds', { sortOrder: MAX_INTEGER }],
      ['an http image URL', { imageUrl: 'http://aoyama.example.com/cut.jpg' }],
      ['an image URL of 500 characters', { imageUrl: urlOfLength(500) }],
      ['no images', { imageUrls: [] }],
      [
        'several images, http and https',
        {
          imageUrls: [
            'http://aoyama.example.com/1.jpg',
            'https://aoyama.example.com/2.jpg',
          ],
        },
      ],
      ['no booking requirements', { bookingRequirements: [] }],
      [
        'every booking requirement once',
        {
          bookingRequirements: [
            'consultation_required',
            'patch_test_required',
            'advance_booking_required',
            'deposit_required',
          ],
        },
      ],
      ['no tags', { tags: [] }],
      ['tags with spaces around them', { tags: [' cut ', 'カラー'] }],
      ['no options', { options: [] }],
      [
        'options at the edges of their rules',
        {
          options: [
            optionRequest({
              additionalPrice: 0,
              maxQuantity: 1,
              sortOrder: 0,
              isRequired: true,
              isActive: false,
            }),
            optionRequest({
              name: 'a'.repeat(255),
              description: null,
              additionalTime: 0,
              additionalPrice: MAX_INTEGER,
              maxQuantity: MAX_INTEGER,
              sortOrder: MAX_INTEGER,
            }),
          ],
        },
      ],
      [
        'everything a service does not have to have',
        {
          taxIncluded: false,
          requiresConsultation: true,
          allowOnlineBooking: false,
          isActive: false,
        },
      ],
    ])('accepts %s and stores it as it is given', async (_case, change) => {
      const response = await post(asAdmin, serviceRequest(change))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(change)
      expect((await get(response.body.data.id)).body.data).toEqual(
        response.body.data,
      )
    })

    it.each([
      ...['fixed', 'variable', 'tiered', 'dynamic', 'consultation_based'].map(
        (value) => ['pricingStrategy', value],
      ),
      ...['active', 'inactive', 'coming_soon', 'discontinued'].map((value) => [
        'serviceStatus',
        value,
      ]),
      ...[
        'always',
        'weekdays_only',
        'weekends_only',
        'by_appointment_only',
        'seasonal',
      ].map((value) => ['availability', value]),
      ...['junior', 'stylist', 'senior', 'expert', 'director'].map((value) => [
        'requiredStaffLevel',
        value,
      ]),
    ])('accepts %s %s', async (property = '', value) => {
      const response = await post(
        asAdmin,
        serviceRequest({ [property]: value }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data[property]).toBe(value)
    })

    it.each(['addon', 'upgrade', 'duration_extension', 'product_choice'])(
      'accepts an option of the type %s',
      async (optionType) => {
        const response = await post(
          asAdmin,
          serviceRequest({ options: [optionRequest({ optionType })] }),
        )

        expect(response.status).toBe(201)
        expect(response.body.data.options).toEqual([
          optionRequest({ optionType }),
        ])
      },
    )

    it('stores every combination of isActive and serviceStatus as it is sent', async () => {
      const combinations = [true, false].flatMap((isActive) =>
        ['active', 'inactive', 'coming_soon', 'discontinued'].map(
          (serviceStatus) => ({ isActive, serviceStatus }),
        ),
      )

      const responses = []
      for (const combination of combinations) {
        responses.push(await post(asAdmin, serviceRequest(combination)))
      }

      expect(responses.map(({ status }) => status)).toEqual(
        combinations.map(() => 201),
      )
      expect(
        responses.map(({ body }) => ({
          isActive: body.data.isActive,
          serviceStatus: body.data.serviceStatus,
        })),
      ).toEqual(combinations)
      const stored = await storedServices()
      expect(
        responses.map(({ body }) => {
          const row = stored.find(({ id }) => id === body.data.id)
          return { isActive: row?.isActive, serviceStatus: row?.serviceStatus }
        }),
      ).toEqual(combinations)
    })

    it('lets several services have the same name', async () => {
      const responses = [
        await post(asAdmin, serviceRequest({ name: 'Cut' })),
        await post(asAdmin, serviceRequest({ name: 'Cut' })),
      ]

      expect(responses.map(({ status }) => status)).toEqual([201, 201])
      expect((await storedServices()).map(({ name }) => name)).toEqual([
        'Cut',
        'Cut',
      ])
    })

    it('returns the options in the order of their sort order, and options with the same sort order in the order of their rows', async () => {
      const options = [
        optionRequest({ name: 'Third', sortOrder: 2 }),
        optionRequest({ name: 'First A', sortOrder: 0 }),
        optionRequest({ name: 'Second', sortOrder: 1 }),
        optionRequest({ name: 'First B', sortOrder: 0 }),
      ]

      const response = await post(asAdmin, serviceRequest({ options }))

      const firstByRow = (await storedOptions())
        .filter(({ sortOrder }) => sortOrder === 0)
        .map(({ name }) => name)
      expect(firstByRow.toSorted()).toEqual(['First A', 'First B'])
      const expectedNames = [...firstByRow, 'Second', 'Third']
      expect(
        response.body.data.options.map(({ name }: ServiceOption) => name),
      ).toEqual(expectedNames)
      expect(
        (await get(response.body.data.id)).body.data.options.map(
          ({ name }: ServiceOption) => name,
        ),
      ).toEqual(expectedNames)
      expect(
        (await list()).body.data[0].options.map(
          ({ name }: ServiceOption) => name,
        ),
      ).toEqual(expectedNames)
    })

    it('stores the service in a category of the same salon', async () => {
      const categoryId = await createCategory()

      const response = await post(asAdmin, serviceRequest({ categoryId }))

      expect(response.status).toBe(201)
      expect(response.body.data.categoryId).toBe(categoryId)
      expect((await storedService(response.body.data.id)).categoryId).toBe(
        categoryId,
      )
    })

    it.each<[string, () => Promise<string>]>([
      ['a category that never existed', async () => UNKNOWN_ID],
      [
        'a category of another salon',
        async () => createCategory(await insertSalon(db)),
      ],
      [
        'a category of the salon that was deleted',
        async () => {
          const categoryId = await createCategory()
          expect((await deleteCategory(categoryId)).status).toBe(204)
          return categoryId
        },
      ],
    ])(
      'refuses %s and stores neither the service nor its options',
      async (_case, categoryIdOf) => {
        const categoryId = await categoryIdOf()

        const response = await post(asAdmin, serviceRequest({ categoryId }))

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['categoryId:not_found'])
        expect(await db.$count(services)).toBe(0)
        expect(await db.$count(serviceOptions)).toBe(0)
      },
    )

    it.each([
      [
        'a category that is not a UUID',
        { categoryId: 'cut' },
        ['categoryId:invalid_format'],
      ],
      ['a blank name', { name: '   ' }, ['name:invalid_format']],
      ['an empty name', { name: '' }, ['name:invalid_format']],
      ['a name of 256 characters', { name: 'a'.repeat(256) }, ['name:too_big']],
      ['a missing name', { name: undefined }, ['name:invalid_type']],
      ['null as the name', { name: null }, ['name:invalid_type']],
      ['a name that is not text', { name: 42 }, ['name:invalid_type']],
      [
        'a blank description',
        { description: ' \n' },
        ['description:invalid_format'],
      ],
      [
        'an empty description',
        { description: '' },
        ['description:invalid_format'],
      ],
      [
        'a blank short description',
        { shortDescription: ' ' },
        ['shortDescription:invalid_format'],
      ],
      [
        'a short description of 501 characters',
        { shortDescription: 'a'.repeat(501) },
        ['shortDescription:too_big'],
      ],
      ['a duration of 0', { duration: 0 }, ['duration:too_small']],
      ['a duration of 1441 minutes', { duration: 1441 }, ['duration:too_big']],
      [
        'a duration that is not a whole number',
        { duration: 1.5 },
        ['duration:invalid_type'],
      ],
      ['a duration as text', { duration: '60' }, ['duration:invalid_type']],
      ['null as the duration', { duration: null }, ['duration:invalid_type']],
      [
        'a negative price',
        { price: -1, discountPrice: null },
        ['price:too_small'],
      ],
      [
        'a price above the largest integer of the column',
        { price: MAX_INTEGER + 1 },
        ['price:too_big'],
      ],
      ['null as the price', { price: null }, ['price:invalid_type']],
      [
        'a negative discount',
        { discountPrice: -1 },
        ['discountPrice:too_small'],
      ],
      [
        'a discount above the largest integer of the column',
        { discountPrice: MAX_INTEGER + 1 },
        ['discountPrice:too_big'],
      ],
      [
        'taxIncluded as text',
        { taxIncluded: 'yes' },
        ['taxIncluded:invalid_type'],
      ],
      [
        'null as requiresConsultation',
        { requiresConsultation: null },
        ['requiresConsultation:invalid_type'],
      ],
      [
        'allowOnlineBooking as a number',
        { allowOnlineBooking: 1 },
        ['allowOnlineBooking:invalid_type'],
      ],
      ['isActive as text', { isActive: 'true' }, ['isActive:invalid_type']],
      [
        'a pricing strategy that does not exist',
        { pricingStrategy: 'free' },
        ['pricingStrategy:invalid_value'],
      ],
      [
        'null as the pricing strategy',
        { pricingStrategy: null },
        ['pricingStrategy:invalid_value'],
      ],
      [
        'a status that does not exist',
        { serviceStatus: 'paused' },
        ['serviceStatus:invalid_value'],
      ],
      [
        'null as the status',
        { serviceStatus: null },
        ['serviceStatus:invalid_value'],
      ],
      [
        'an availability that does not exist',
        { availability: 'sometimes' },
        ['availability:invalid_value'],
      ],
      [
        'null as the availability',
        { availability: null },
        ['availability:invalid_value'],
      ],
      [
        'an image URL that is not a URL',
        { imageUrl: 'cut.jpg' },
        ['imageUrl:invalid_format'],
      ],
      [
        'an image URL that is neither http nor https',
        { imageUrl: 'ftp://aoyama.example.com/cut.jpg' },
        ['imageUrl:invalid_format'],
      ],
      [
        'an image URL of 501 characters',
        { imageUrl: urlOfLength(501) },
        ['imageUrl:too_big'],
      ],
      [
        'one image URL in place of a list',
        { imageUrls: 'https://aoyama.example.com/cut.jpg' },
        ['imageUrls:invalid_type'],
      ],
      ['null as the images', { imageUrls: null }, ['imageUrls:invalid_type']],
      [
        'an image in the list that is not an http URL',
        {
          imageUrls: [
            'https://aoyama.example.com/1.jpg',
            'mailto:aoyama@example.com',
          ],
        },
        ['imageUrls.1:invalid_format'],
      ],
      [
        'a staff level that does not exist',
        { requiredStaffLevel: 'master' },
        ['requiredStaffLevel:invalid_value'],
      ],
      [
        'a limit of 0 bookings a day',
        { maxBookingsPerDay: 0 },
        ['maxBookingsPerDay:too_small'],
      ],
      [
        'a booking requirement that does not exist',
        { bookingRequirements: ['walk_in'] },
        ['bookingRequirements.0:invalid_value'],
      ],
      [
        'a booking requirement twice',
        {
          bookingRequirements: [
            'deposit_required',
            'patch_test_required',
            'deposit_required',
          ],
        },
        ['bookingRequirements.2:custom'],
      ],
      [
        'null as the booking requirements',
        { bookingRequirements: null },
        ['bookingRequirements:invalid_type'],
      ],
      ['a blank tag', { tags: ['cut', ' '] }, ['tags.1:invalid_format']],
      ['null as the tags', { tags: null }, ['tags:invalid_type']],
      ['a negative sort order', { sortOrder: -1 }, ['sortOrder:too_small']],
      [
        'a sort order above the largest integer of the column',
        { sortOrder: MAX_INTEGER + 1 },
        ['sortOrder:too_big'],
      ],
      ['null as the options', { options: null }, ['options:invalid_type']],
      [
        'one option in place of a list',
        { options: optionRequest() },
        ['options:invalid_type'],
      ],
      [
        'an option with a blank name',
        { options: [optionRequest({ name: ' ' })] },
        ['options.0.name:invalid_format'],
      ],
      [
        'an option with a name of 256 characters',
        { options: [optionRequest({ name: 'a'.repeat(256) })] },
        ['options.0.name:too_big'],
      ],
      [
        'an option without a name',
        { options: [optionRequest({ name: undefined })] },
        ['options.0.name:invalid_type'],
      ],
      [
        'an option with a blank description',
        { options: [optionRequest(), optionRequest({ description: '' })] },
        ['options.1.description:invalid_format'],
      ],
      [
        'an option of a type that does not exist',
        { options: [optionRequest({ optionType: 'gift' })] },
        ['options.0.optionType:invalid_value'],
      ],
      [
        'an option without a type',
        { options: [optionRequest({ optionType: null })] },
        ['options.0.optionType:invalid_value'],
      ],
      [
        'an option with a negative additional time',
        { options: [optionRequest({ additionalTime: -1 })] },
        ['options.0.additionalTime:too_small'],
      ],
      [
        'an option with a negative additional price',
        { options: [optionRequest({ additionalPrice: -1 })] },
        ['options.0.additionalPrice:too_small'],
      ],
      [
        'an option with an additional price above the largest integer of the column',
        { options: [optionRequest({ additionalPrice: MAX_INTEGER + 1 })] },
        ['options.0.additionalPrice:too_big'],
      ],
      [
        'an option with a largest quantity of 0',
        { options: [optionRequest({ maxQuantity: 0 })] },
        ['options.0.maxQuantity:too_small'],
      ],
      [
        'an option with a negative sort order',
        { options: [optionRequest({ sortOrder: -1 })] },
        ['options.0.sortOrder:too_small'],
      ],
      [
        'an option with isRequired as text',
        { options: [optionRequest({ isRequired: 'no' })] },
        ['options.0.isRequired:invalid_type'],
      ],
      [
        'an option with null as isActive',
        { options: [optionRequest({ isActive: null })] },
        ['options.0.isActive:invalid_type'],
      ],
      [
        'an option with an ID',
        { options: [optionRequest(), optionRequest({ id: UNKNOWN_ID })] },
        ['options.1.id:unrecognized_keys'],
      ],
      [
        'the salon in the body',
        { salonId: UNKNOWN_ID },
        ['salonId:unrecognized_keys'],
      ],
      [
        'the products a service needs, which never go in or out',
        { requiredProducts: [] },
        ['requiredProducts:unrecognized_keys'],
      ],
      [
        'what the server assigns',
        { id: UNKNOWN_ID, createdAt: '2026-11-14T09:00:00.000Z' },
        ['id:unrecognized_keys', 'createdAt:unrecognized_keys'],
      ],
      [
        'a property that does not exist',
        { category: 'cut' },
        ['category:unrecognized_keys'],
      ],
      [
        'more than 20 services in a package',
        {
          isPackage: true,
          packageServiceIds: Array.from({ length: 21 }, () => randomUUID()),
        },
        ['packageServiceIds:too_big'],
      ],
      [
        'a member of a package that is not a UUID',
        { isPackage: true, packageServiceIds: [UNKNOWN_ID, 'cut'] },
        ['packageServiceIds.1:invalid_format'],
      ],
      [
        'the same member of a package twice',
        {
          isPackage: true,
          packageServiceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID, UNKNOWN_ID],
        },
        ['packageServiceIds.2:custom'],
      ],
      [
        'the same member of a package once in upper and once in lower case',
        {
          isPackage: true,
          packageServiceIds: [UNKNOWN_ID.toUpperCase(), UNKNOWN_ID],
        },
        ['packageServiceIds.1:custom'],
      ],
    ])('rejects %s and stores nothing', async (_case, change, expected) => {
      const response = await post(asAdmin, serviceRequest(change))

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(await db.$count(services)).toBe(0)
      expect(await db.$count(serviceOptions)).toBe(0)
    })

    it('reports several broken rules together, of the service and of its options', async () => {
      const response = await post(
        asAdmin,
        serviceRequest({
          name: '',
          duration: 0,
          tags: [''],
          options: [optionRequest({ maxQuantity: 0, optionType: 'gift' })],
          salonId: UNKNOWN_ID,
        }),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(
        [
          'name:invalid_format',
          'duration:too_small',
          'tags.0:invalid_format',
          'options.0.optionType:invalid_value',
          'options.0.maxQuantity:too_small',
          'salonId:unrecognized_keys',
        ].toSorted(),
      )
      expect(await db.$count(services)).toBe(0)
    })

    it('reports each broken rule with its field, its rule and a message', async () => {
      const response = await post(asAdmin, serviceRequest({ duration: 0 }))

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        expect.objectContaining({
          field: 'duration',
          rule: 'too_small',
          message: expect.any(String),
        }),
      ])
    })

    it.each(
      Object.keys(serviceRequest()).filter((property) => property !== 'name'),
    )('rejects a request that leaves %s out', async (property) => {
      const response = await post(
        asAdmin,
        serviceRequest({ [property]: undefined }),
      )

      expectProblem(response, badRequest)
      expect(
        brokenRules(response).map((rule) => rule.replace(/:.*$/, '')),
      ).toEqual([property])
      expect(await db.$count(services)).toBe(0)
    })

    it('rejects a list of requests as a body that is not an object', async () => {
      const response = await post(asAdmin, [serviceRequest()])

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([':invalid_type'])
      expect(await db.$count(services)).toBe(0)
    })

    it('refuses a discount above the price as a broken rule of the discount', async () => {
      const response = await post(
        asAdmin,
        serviceRequest({ price: 6600, discountPrice: 6601 }),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['discountPrice:too_big'])
      expect(await db.$count(services)).toBe(0)
    })

    it('reports the rules that tie properties together only once each property keeps its own rule', async () => {
      const response = await post(
        asAdmin,
        serviceRequest({ name: '', price: 6600, discountPrice: 9900 }),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['name:invalid_format'])
    })

    describe('a package', () => {
      it('combines services of the salon, which it names in the order of the request', async () => {
        const [first, second, third] = await createServices(3)
        const memberIds = [third?.id ?? '', first?.id ?? '', second?.id ?? '']

        const response = await post(
          asAdmin,
          serviceRequest({
            name: 'Full course',
            isPackage: true,
            packageServiceIds: memberIds,
          }),
        )

        expect(response.status).toBe(201)
        expect(response.body.data).toMatchObject({
          isPackage: true,
          packageServiceIds: memberIds,
        })
        expect(
          (await storedService(response.body.data.id)).packageServiceIds,
        ).toEqual(memberIds)
        expect((await get(response.body.data.id)).body.data).toEqual(
          response.body.data,
        )
      })

      it('combines up to 20 services', async () => {
        const memberIds: string[] = []
        for (let index = 0; index < 20; index += 1) {
          memberIds.push(await insertServiceRow(salonId))
        }

        const response = await post(
          asAdmin,
          serviceRequest({ isPackage: true, packageServiceIds: memberIds }),
        )

        expect(response.status).toBe(201)
        expect(response.body.data.packageServiceIds).toEqual(memberIds)
      })

      it.each([
        ['no services', []],
        ['one service', [UNKNOWN_ID]],
      ])(
        'refuses a package of %s as too small',
        async (_case, packageServiceIds) => {
          const response = await post(
            asAdmin,
            serviceRequest({ isPackage: true, packageServiceIds }),
          )

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['packageServiceIds:too_small'])
          expect(await db.$count(services)).toBe(0)
        },
      )

      it('refuses members for a service that is not a package', async () => {
        const [first, second] = await createServices(2)

        const response = await post(
          asAdmin,
          serviceRequest({
            isPackage: false,
            packageServiceIds: [first?.id, second?.id],
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['packageServiceIds:not_allowed'])
        expect(await db.$count(services)).toBe(2)
      })

      it('reports a discount above the price and a package of one service together', async () => {
        const response = await post(
          asAdmin,
          serviceRequest({
            price: 1000,
            discountPrice: 2000,
            isPackage: true,
            packageServiceIds: [UNKNOWN_ID],
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response).toSorted()).toEqual([
          'discountPrice:too_big',
          'packageServiceIds:too_small',
        ])
      })

      it.each<[string, () => Promise<string>]>([
        ['a service that never existed', async () => UNKNOWN_ID],
        [
          'a service of another salon',
          async () => (await createService({}, await insertSalon(db))).id,
        ],
        [
          'a deleted service of the salon',
          async () => {
            const deleted = await createService({ name: 'Deleted' })
            expect((await remove(asAdmin, deleted.id)).status).toBe(204)
            return deleted.id
          },
        ],
      ])(
        'refuses %s as a member, and stores neither the package nor its options',
        async (_case, memberIdOf) => {
          const member = await createService({ name: 'Member' })
          const memberId = await memberIdOf()
          const before = await storedRows()

          const response = await post(
            asAdmin,
            serviceRequest({
              isPackage: true,
              packageServiceIds: [member.id, memberId],
            }),
          )

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['packageServiceIds:not_found'])
          expect(await storedRows()).toEqual(before)
        },
      )

      it('refuses a package as a member, and stores neither the package nor its options', async () => {
        const [first, second, third] = await createServices(3)
        const inner = await createPackage([first?.id, second?.id])
        const before = await storedRows()

        const response = await post(
          asAdmin,
          serviceRequest({
            isPackage: true,
            packageServiceIds: [third?.id, inner.id],
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'packageServiceIds:nested_package',
        ])
        expect(await storedRows()).toEqual(before)
      })

      it('lets a service be a member of several packages', async () => {
        const [first, second, third] = await createServices(3)

        const one = await post(
          asAdmin,
          serviceRequest({
            isPackage: true,
            packageServiceIds: [first?.id, second?.id],
          }),
        )
        const another = await post(
          asAdmin,
          serviceRequest({
            isPackage: true,
            packageServiceIds: [first?.id, third?.id],
          }),
        )

        expect([one.status, another.status]).toEqual([201, 201])
      })
    })

    it.each(malformedIds)(
      'rejects %s as the salon ID and stores nothing',
      async (_case, salon) => {
        const response = await post(asAdmin, serviceRequest(), salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect(await db.$count(services)).toBe(0)
      },
    )

    it('reports a salon that does not exist as not found and stores nothing', async () => {
      const response = await post(asAdmin, serviceRequest(), UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect(await db.$count(services)).toBe(0)
    })

    it('validates the body and the rules of the request before it looks for the salon, and looks for the salon before the category and the members', async () => {
      const invalidBody = await post(
        asAdmin,
        serviceRequest({ name: '' }),
        UNKNOWN_ID,
      )
      const brokenRule = await post(
        asAdmin,
        serviceRequest({ price: 1000, discountPrice: 2000 }),
        UNKNOWN_ID,
      )
      const unknownCategory = await post(
        asAdmin,
        serviceRequest({ categoryId: UNKNOWN_ID }),
        UNKNOWN_ID,
      )
      const unknownMembers = await post(
        asAdmin,
        serviceRequest({
          isPackage: true,
          packageServiceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID],
        }),
        UNKNOWN_ID,
      )

      expectProblem(invalidBody, badRequest)
      expect(brokenRules(invalidBody)).toEqual(['name:invalid_format'])
      expectProblem(brokenRule, badRequest)
      expect(brokenRules(brokenRule)).toEqual(['discountPrice:too_big'])
      expectProblem(unknownCategory, notFound)
      expect(unknownCategory.body.detail).toBe(
        `Salon ${UNKNOWN_ID} was not found`,
      )
      expectProblem(unknownMembers, notFound)
      expect(unknownMembers.body.detail).toBe(
        `Salon ${UNKNOWN_ID} was not found`,
      )
    })
  })

  describe('GET /api/v1/salons/:salonId/services/:id', () => {
    it('returns the service with its options and its links', async () => {
      const created = await createService({
        options: [
          optionRequest({ name: 'Treatment', sortOrder: 1 }),
          optionRequest({ name: 'Head spa', sortOrder: 0 }),
        ],
      })

      const response = await get(created.id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...serviceRequest(),
          options: [
            optionRequest({ name: 'Head spa', sortOrder: 0 }),
            optionRequest({ name: 'Treatment', sortOrder: 1 }),
          ],
          id: created.id,
          salonId,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${servicesOf(salonId)}/${created.id}`,
          list: servicesOf(salonId),
        },
      })
    })

    it('returns an inactive service and one of any status', async () => {
      const created = await createService({
        isActive: false,
        serviceStatus: 'discontinued',
      })

      const response = await get(created.id)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(created)
    })

    it.each(unauthenticated)(
      'answers a request with %s like one without a token: reading is public',
      async (_case, tokenOf) => {
        const created = await createService()
        const authorization = await tokenOf()

        const response = await authorized(
          request(app).get(`${servicesOf(salonId)}/${created.id}`),
          authorization,
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual(created)
      },
    )

    it.each(malformedIds)('rejects %s as the service ID', async (_case, id) => {
      const response = await get(id)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('takes /bulk for the ID of a service, which is not a UUID', async () => {
      await createService()

      const response = await get('bulk')

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it.each(malformedIds)(
      'rejects %s as the salon ID',
      async (_case, salon) => {
        const created = await createService()

        const response = await get(created.id, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
      },
    )

    it('reports an ID that no service has as not found', async () => {
      await createService()

      const response = await get(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Service ${UNKNOWN_ID} was not found`)
    })

    it('reports a service of another salon as not found, like an ID that no service has', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createService({}, otherSalonId)

      const response = await get(elsewhere.id)
      const unknown = await get(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Service ${elsewhere.id} was not found`)
      expect({ ...response.body, detail: null }).toEqual({
        ...unknown.body,
        detail: null,
        instance: response.body.instance,
        correlationId: response.body.correlationId,
        timestamp: response.body.timestamp,
      })
      expect((await get(elsewhere.id, otherSalonId)).status).toBe(200)
    })

    it('reports a deleted service as not found', async () => {
      const created = await createService()
      await remove(asAdmin, created.id)

      const response = await get(created.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Service ${created.id} was not found`)
    })

    it('reports a salon that does not exist as not found', async () => {
      const created = await createService()

      const response = await get(created.id, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
    })

    it('answers 500 without details when the stored service has a time that is no instant', async () => {
      const created = await createService()
      await db
        .update(services)
        .set({ createdAt: 'infinity' })
        .where(eq(services.id, created.id))

      const response = await get(created.id)

      expectProblem(response, databaseProblem)
      expect(response.body.detail).toBeNull()
      expect(JSON.stringify(response.body)).not.toContain('infinity')
    })
  })

  describe('GET /api/v1/salons/:salonId/services', () => {
    /**
     * Six services of the salon in the order of the menu: sort orders repeat,
     * two services are inactive, the statuses differ, and three are in one
     * category. Another salon has a service too, and the salon a deleted one.
     */
    const createMenu = async () => {
      const categoryId = await createCategory()
      const created = [
        await createService({ name: 'Cut', sortOrder: 1, categoryId }),
        await createService({
          name: 'Colour',
          sortOrder: 2,
          isActive: false,
          serviceStatus: 'inactive',
          categoryId,
        }),
        await createService({
          name: 'Perm',
          sortOrder: 2,
          serviceStatus: 'coming_soon',
        }),
        await createService({
          name: 'Spa',
          sortOrder: 2,
          isActive: false,
          serviceStatus: 'discontinued',
          categoryId,
          options: [],
        }),
        await createService({ name: 'Other', sortOrder: 0 }),
        await createService({
          name: 'Treatment',
          sortOrder: 3,
          options: [
            optionRequest({ name: 'Second', sortOrder: 1 }),
            optionRequest({ name: 'First', sortOrder: 0 }),
          ],
        }),
      ]
      const deleted = await createService({ name: 'Deleted', sortOrder: 2 })
      expect((await remove(asAdmin, deleted.id)).status).toBe(204)
      await createService(
        { name: 'Elsewhere', sortOrder: 1 },
        await insertSalon(db),
      )
      return { menu: inMenuOrder(created), categoryId }
    }

    /** Follows `links.next` from the first page to the last. */
    const walk = async (firstPage: string): Promise<Response[]> => {
      const pages: Response[] = []
      let next: string | null = firstPage
      while (next !== null) {
        if (pages.length === 50) {
          throw new Error('The pages do not end')
        }
        const page: Response = await request(app).get(next)
        expect(page.status).toBe(200)
        pages.push(page)
        next = page.body.links.next
      }
      return pages
    }

    it('returns an empty page when the salon has no services', async () => {
      await createService({}, await insertSalon(db))

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: [],
        meta: {
          total: 0,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: servicesOf(salonId),
          first: servicesOf(salonId),
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('returns the services of the salon only, with their options, by sort order and then by ID, inactive ones and every status included, the deleted one left out', async () => {
      const { menu } = await createMenu()

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: menu,
        meta: {
          total: 6,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: servicesOf(salonId),
          first: servicesOf(salonId),
          last: null,
          next: null,
          prev: null,
        },
      })
      expect(response.body.data.at(-1).options).toEqual([
        optionRequest({ name: 'First', sortOrder: 0 }),
        optionRequest({ name: 'Second', sortOrder: 1 }),
      ])
    })

    it.each([
      ['true', true],
      ['false', false],
    ])(
      'returns only the services with isActive %s when asked, and counts only them',
      async (text, isActive) => {
        const { menu } = await createMenu()
        const expected = menu.filter((service) => service.isActive === isActive)

        const response = await list(`isActive=${text}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual(expected)
        expect(response.body.meta).toMatchObject({
          total: expected.length,
          hasMore: false,
        })
      },
    )

    it('returns only the services of a category when asked, and counts only them', async () => {
      const { menu, categoryId } = await createMenu()
      const expected = menu.filter(
        (service) => service.categoryId === categoryId,
      )

      const response = await list(`categoryId=${categoryId}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(expected)
      expect(response.body.meta).toMatchObject({ total: 3, hasMore: false })
    })

    it('combines the filters', async () => {
      const { menu, categoryId } = await createMenu()
      const expected = menu.filter(
        (service) => service.categoryId === categoryId && !service.isActive,
      )

      const response = await list(`categoryId=${categoryId}&isActive=false`)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(expected)
      expect(response.body.meta.total).toBe(2)
    })

    it.each<[string, () => Promise<string>]>([
      ['a category that does not exist', async () => UNKNOWN_ID],
      [
        'a category of another salon',
        async () => {
          const otherSalonId = await insertSalon(db)
          const categoryId = await createCategory(otherSalonId)
          await createService({ categoryId }, otherSalonId)
          return categoryId
        },
      ],
    ])(
      'returns an empty page for %s, not an error',
      async (_case, categoryIdOf) => {
        await createMenu()
        const categoryId = await categoryIdOf()

        const response = await list(`categoryId=${categoryId}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
        expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
      },
    )

    it('walks through the pages with the link of the page before, returning every service once and in order where sort orders repeat', async () => {
      const { menu } = await createMenu()
      const ids = menu.map(({ id }) => id)
      const firstPage = `${servicesOf(salonId)}?limit=2`

      const pages = await walk(firstPage)

      expect(pages.flatMap((page) => page.body.data)).toEqual(menu)
      expect(pages.map((page) => page.body.meta)).toEqual([
        {
          total: 6,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: ids[1],
          prevCursor: null,
        },
        {
          total: 6,
          limit: 2,
          hasMore: true,
          cursor: ids[1],
          nextCursor: ids[3],
          prevCursor: null,
        },
        {
          total: 6,
          limit: 2,
          hasMore: false,
          cursor: ids[3],
          nextCursor: null,
          prevCursor: null,
        },
      ])
      expect(pages.map((page) => page.body.links)).toEqual([
        {
          self: firstPage,
          first: firstPage,
          last: null,
          next: `${firstPage}&cursor=${ids[1]}`,
          prev: null,
        },
        {
          self: `${firstPage}&cursor=${ids[1]}`,
          first: firstPage,
          last: null,
          next: `${firstPage}&cursor=${ids[3]}`,
          prev: null,
        },
        {
          self: `${firstPage}&cursor=${ids[3]}`,
          first: firstPage,
          last: null,
          next: null,
          prev: null,
        },
      ])
    })

    it.each<
      [
        string,
        (categoryId: string) => string,
        (service: Service, categoryId: string) => boolean,
      ]
    >([
      ['isActive=true', () => 'isActive=true', (service) => service.isActive],
      [
        'isActive=false',
        () => 'isActive=false',
        (service) => !service.isActive,
      ],
      [
        'a category',
        (categoryId) => `categoryId=${categoryId}`,
        (service, categoryId) => service.categoryId === categoryId,
      ],
    ])(
      'walks through the services with %s one at a time, keeping the filter in every link',
      async (_case, queryOf, matches) => {
        const { menu, categoryId } = await createMenu()
        const expected = menu.filter((service) => matches(service, categoryId))
        const firstPage = `${servicesOf(salonId)}?${queryOf(categoryId)}&limit=1`

        const pages = await walk(firstPage)

        expect(pages.flatMap((page) => page.body.data)).toEqual(expected)
        expect(pages.map((page) => page.body.meta.total)).toEqual(
          expected.map(() => expected.length),
        )
        expect(pages.map((page) => page.body.links.self)).toEqual([
          firstPage,
          ...expected.slice(0, -1).map(({ id }) => `${firstPage}&cursor=${id}`),
        ])
        expect(pages.at(-1)?.body.meta).toMatchObject({
          hasMore: false,
          nextCursor: null,
        })
      },
    )

    it('says that no page follows a page that the last services fill exactly', async () => {
      const { menu } = await createMenu()

      const whole = await list('limit=6')
      const rest = await list(`limit=4&cursor=${menu[1]?.id}`)

      expect(idsOf(whole)).toEqual(menu.map(({ id }) => id))
      expect(whole.body.meta).toMatchObject({
        total: 6,
        hasMore: false,
        nextCursor: null,
      })
      expect(whole.body.links.next).toBeNull()
      expect(idsOf(rest)).toEqual(menu.slice(2).map(({ id }) => id))
      expect(rest.body.meta).toMatchObject({
        total: 6,
        hasMore: false,
        nextCursor: null,
      })
      expect(rest.body.links.next).toBeNull()
    })

    it('gives pages of 20 services unless another limit is asked for, and up to 100', async () => {
      for (let order = 0; order < 21; order += 1) {
        await insertServiceRow(salonId, { sortOrder: order })
      }

      const byDefault = await list()
      const largest = await list('limit=100')
      const smallest = await list('limit=1')

      expect(byDefault.body.data).toHaveLength(20)
      expect(byDefault.body.meta).toMatchObject({
        total: 21,
        limit: 20,
        hasMore: true,
        nextCursor: byDefault.body.data[19].id,
      })
      expect(largest.body.data).toHaveLength(21)
      expect(largest.body.meta).toMatchObject({
        total: 21,
        limit: 100,
        hasMore: false,
      })
      expect(smallest.body.data).toHaveLength(1)
      expect(smallest.body.meta).toMatchObject({ limit: 1, hasMore: true })
    })

    it('continues after a service that was deleted since it ended a page: its row still says where the next page begins', async () => {
      const { menu } = await createMenu()
      const firstPage = await list('limit=2')
      const lastOfThePage = menu[1]?.id ?? ''
      expect(firstPage.body.meta.nextCursor).toBe(lastOfThePage)
      expect((await remove(asAdmin, lastOfThePage)).status).toBe(204)

      const nextPage = await request(app).get(firstPage.body.links.next)

      expect(nextPage.status).toBe(200)
      expect(idsOf(nextPage)).toEqual(menu.slice(2, 4).map(({ id }) => id))
      expect(nextPage.body.meta).toEqual({
        total: 5,
        limit: 2,
        hasMore: true,
        cursor: lastOfThePage,
        nextCursor: menu[3]?.id,
        prevCursor: null,
      })
    })

    it('starts the page after a cursor that names a service of the salon which the filter leaves out', async () => {
      const { menu } = await createMenu()
      const inactive = menu.findIndex(({ isActive }) => !isActive)
      const cursor = menu[inactive]?.id

      const response = await list(`isActive=true&cursor=${cursor}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(
        menu.slice(inactive + 1).filter(({ isActive }) => isActive),
      )
      expect(response.body.meta).toMatchObject({
        total: 4,
        hasMore: false,
        cursor,
        nextCursor: null,
      })
    })

    it.each<[string, () => Promise<string>]>([
      ['a service that never existed', async () => UNKNOWN_ID],
      [
        'a service of another salon',
        async () => (await createService({}, await insertSalon(db))).id,
      ],
    ])(
      'refuses a cursor that names %s as a broken rule of the cursor',
      async (_case, cursorOf) => {
        await createService()
        const cursor = await cursorOf()

        const response = await list(`cursor=${cursor}`)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['cursor:not_found'])
      },
    )

    it.each([
      ['a limit that is not a number', 'limit=ten', ['limit:invalid_format']],
      ['an empty limit', 'limit=', ['limit:invalid_format']],
      ['a limit of 0', 'limit=0', ['limit:too_small']],
      ['a limit of 101', 'limit=101', ['limit:too_big']],
      [
        'a limit that is not a whole number',
        'limit=1.5',
        ['limit:invalid_type'],
      ],
      [
        'isActive that is neither true nor false',
        'isActive=yes',
        ['isActive:invalid_value'],
      ],
      ['isActive as a digit', 'isActive=1', ['isActive:invalid_value']],
      ['a cursor that is not a UUID', 'cursor=abc', ['cursor:invalid_format']],
      [
        'a category that is not a UUID',
        'categoryId=cut',
        ['categoryId:invalid_format'],
      ],
      ['a parameter that does not exist', 'page=2', ['page:unrecognized_keys']],
      [
        'the salon as a parameter of the query',
        `salonId=${UNKNOWN_ID}`,
        ['salonId:unrecognized_keys'],
      ],
      [
        'several broken rules, all of which it reports',
        'limit=0&cursor=abc&page=2',
        ['limit:too_small', 'cursor:invalid_format', 'page:unrecognized_keys'],
      ],
    ])('rejects %s', async (_case, query, expected) => {
      await createService()

      const response = await list(query)

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected.toSorted())
    })

    it.each(unauthenticated)(
      'answers a request with %s like one without a token: reading is public',
      async (_case, tokenOf) => {
        const created = await createService()
        const authorization = await tokenOf()

        const response = await authorized(
          request(app).get(servicesOf(salonId)),
          authorization,
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([created])
      },
    )

    it.each(malformedIds)(
      'rejects %s as the salon ID',
      async (_case, salon) => {
        const response = await list('', salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
      },
    )

    it('reports a salon that does not exist as not found', async () => {
      await createService()

      const response = await list('', UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
    })

    it('answers 500 without details when a stored service of the page has a time that is no instant', async () => {
      await createService({ sortOrder: 0 })
      const corrupt = await createService({ sortOrder: 1 })
      await db
        .update(services)
        .set({ updatedAt: 'infinity' })
        .where(eq(services.id, corrupt.id))

      const response = await list()

      expectProblem(response, databaseProblem)
      expect(response.body.detail).toBeNull()
      expect(JSON.stringify(response.body)).not.toContain('infinity')
    })
  })

  describe('PATCH /api/v1/salons/:salonId/services/:id', () => {
    it('changes the given properties and nothing else, and moves updatedAt', async () => {
      const created = await createService()
      const other = await createService({ name: 'Colour' })
      const optionsBefore = await storedOptions()

      const response = await patch(asAdmin, created.id, {
        name: 'Renamed',
        duration: 90,
      })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...created,
          name: 'Renamed',
          duration: 90,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${servicesOf(salonId)}/${created.id}`,
          list: servicesOf(salonId),
        },
      })
      expect(response.body.data.updatedAt).not.toBe(created.updatedAt)
      expect((await get(created.id)).body.data).toEqual(response.body.data)
      expect(await hasMoved(created.id)).toBe(true)
      expect((await get(other.id)).body.data).toEqual(other)
      expect(await hasMoved(other.id)).toBe(false)
      expect(await storedOptions()).toEqual(optionsBefore)
    })

    it.each([
      ['name', 'Renamed'],
      ['description', 'Another description'],
      ['shortDescription', 'Short'],
      ['duration', 90],
      ['price', 7700],
      ['discountPrice', 6000],
      ['taxIncluded', false],
      ['pricingStrategy', 'consultation_based'],
      ['imageUrl', 'http://aoyama.example.com/other.jpg'],
      ['imageUrls', []],
      ['requiredStaffLevel', 'director'],
      ['maxBookingsPerDay', 1],
      ['requiresConsultation', true],
      ['allowOnlineBooking', false],
      ['bookingRequirements', ['patch_test_required', 'deposit_required']],
      ['isPackage', false],
      ['packageServiceIds', []],
      ['tags', ['seasonal']],
      ['sortOrder', 0],
      ['serviceStatus', 'coming_soon'],
      ['availability', 'weekends_only'],
      ['isActive', false],
    ])(
      'changes %s alone when it is the only property given, and leaves the options as they are',
      async (property, value) => {
        const created = await createService()
        const optionsBefore = await storedOptions()

        const response = await patch(asAdmin, created.id, { [property]: value })

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...created,
          [property]: value,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
        expect((await get(created.id)).body.data).toEqual(response.body.data)
        expect(await storedOptions()).toEqual(optionsBefore)
      },
    )

    it('unsets a property that may be unset when it is given as null', async () => {
      const categoryId = await createCategory()
      const created = await createService({ categoryId })
      const unset = {
        categoryId: null,
        description: null,
        shortDescription: null,
        discountPrice: null,
        imageUrl: null,
        requiredStaffLevel: null,
        maxBookingsPerDay: null,
      }

      const response = await patch(asAdmin, created.id, unset)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...created,
        ...unset,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(await storedService(created.id)).toMatchObject(unset)
    })

    it('accepts a request that changes every property at once, and keeps the ID, the salon and the creation time', async () => {
      const categoryId = await createCategory()
      const created = await createService()
      const everything = serviceRequest({
        categoryId,
        name: 'Head spa',
        description: null,
        duration: 30,
        price: 4400,
        discountPrice: null,
        pricingStrategy: 'variable',
        imageUrls: [],
        bookingRequirements: [],
        tags: [],
        sortOrder: 1,
        serviceStatus: 'inactive',
        availability: 'seasonal',
        isActive: false,
        options: [optionRequest({ name: 'Aroma', optionType: 'upgrade' })],
      })

      const response = await patch(asAdmin, created.id, everything)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...everything,
        id: created.id,
        salonId,
        createdAt: created.createdAt,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
    })

    describe('the options', () => {
      it('replaces every option of the service with the options of the request, and leaves those of other services alone', async () => {
        const created = await createService({
          options: [
            optionRequest({ name: 'Old A', sortOrder: 0 }),
            optionRequest({ name: 'Old B', sortOrder: 1 }),
          ],
        })
        const other = await createService({ name: 'Colour' })
        const before = await storedOptionsOf(created.id)
        const othersBefore = await storedOptionsOf(other.id)
        const replacement = [
          optionRequest({ name: 'New C', sortOrder: 2 }),
          optionRequest({ name: 'New A', sortOrder: 0, optionType: 'upgrade' }),
          optionRequest({ name: 'New B', sortOrder: 1, maxQuantity: 3 }),
        ]

        const response = await patch(asAdmin, created.id, {
          options: replacement,
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...created,
          options: [replacement[1], replacement[2], replacement[0]],
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
        const after = await storedOptionsOf(created.id)
        expect(after.map(({ name }) => name)).toEqual([
          'New A',
          'New B',
          'New C',
        ])
        expect(
          after.filter(({ id }) => before.some((old) => old.id === id)),
        ).toEqual([])
        expect(await storedOptionsOf(other.id)).toEqual(othersBefore)
      })

      it('removes every option of the service with an empty list', async () => {
        const created = await createService({
          options: [optionRequest(), optionRequest({ name: 'Treatment' })],
        })
        const other = await createService({ name: 'Colour' })

        const response = await patch(asAdmin, created.id, { options: [] })

        expect(response.status).toBe(200)
        expect(response.body.data.options).toEqual([])
        expect(await storedOptionsOf(created.id)).toEqual([])
        expect(await storedOptionsOf(other.id)).toHaveLength(1)
      })

      it('leaves the stored options, rows and all, as they are when the request has none', async () => {
        const created = await createService({
          options: [optionRequest(), optionRequest({ name: 'Treatment' })],
        })
        const before = await storedOptionsOf(created.id)

        const response = await patch(asAdmin, created.id, { price: 7000 })

        expect(response.status).toBe(200)
        expect(response.body.data.options).toEqual(created.options)
        expect(await storedOptionsOf(created.id)).toEqual(before)
      })
    })

    describe('the category', () => {
      it('puts the service into a category of the same salon, and takes it out with null', async () => {
        const categoryId = await createCategory()
        const created = await createService()

        const into = await patch(asAdmin, created.id, { categoryId })
        const outOf = await patch(asAdmin, created.id, { categoryId: null })

        expect(into.status).toBe(200)
        expect(into.body.data.categoryId).toBe(categoryId)
        expect(outOf.status).toBe(200)
        expect(outOf.body.data.categoryId).toBeNull()
        expect((await storedService(created.id)).categoryId).toBeNull()
      })

      it.each<[string, () => Promise<string>]>([
        ['a category that never existed', async () => UNKNOWN_ID],
        [
          'a category of another salon',
          async () => createCategory(await insertSalon(db)),
        ],
      ])(
        'refuses %s, and changes nothing, also not the other properties of the request or the options',
        async (_case, categoryIdOf) => {
          const created = await createService()
          const categoryId = await categoryIdOf()
          const before = await storedRows()

          const response = await patch(asAdmin, created.id, {
            name: 'Renamed',
            options: [],
            categoryId,
          })

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['categoryId:not_found'])
          expect(await storedRows()).toEqual(before)
        },
      )
    })

    describe('the price and the discount, as the service will be stored', () => {
      /** A service of price 6600 with a discount to 5500. */
      const discounted = () =>
        createService({ price: 6600, discountPrice: 5500 })

      it.each([
        [
          'a discount above the stored price',
          { discountPrice: 6601 },
          'discountPrice:too_big',
        ],
        [
          'a price below the stored discount',
          { price: 5499 },
          'discountPrice:too_big',
        ],
        [
          'a price and a discount above it',
          { price: 3000, discountPrice: 3001 },
          'discountPrice:too_big',
        ],
      ])(
        'refuses %s, and changes nothing, also not the other properties of the request or the options',
        async (_case, change, expected) => {
          const created = await discounted()
          const before = await storedRows()

          const response = await patch(asAdmin, created.id, {
            ...change,
            name: 'Renamed',
            options: [],
          })

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual([expected])
          expect(await storedRows()).toEqual(before)
        },
      )

      it.each([
        ['a discount equal to the stored price', { discountPrice: 6600 }],
        ['a price equal to the stored discount', { price: 5500 }],
        [
          'a price below the stored discount together with a lower discount',
          { price: 4000, discountPrice: 3000 },
        ],
        [
          'a price below the stored discount together with no discount',
          { price: 4000, discountPrice: null },
        ],
      ])('accepts %s', async (_case, change) => {
        const created = await discounted()

        const response = await patch(asAdmin, created.id, change)

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject(change)
        expect(await storedService(created.id)).toMatchObject(change)
      })
    })

    describe('a package, as the service will be stored', () => {
      it('turns a plain service into a package of services of the salon, named in the order of the request', async () => {
        const [first, second, third] = await createServices(3)
        const created = await createService({ name: 'Becomes a package' })
        const memberIds = [third?.id, first?.id, second?.id]

        const response = await patch(asAdmin, created.id, {
          isPackage: true,
          packageServiceIds: memberIds,
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          isPackage: true,
          packageServiceIds: memberIds,
        })
        expect((await storedService(created.id)).packageServiceIds).toEqual(
          memberIds,
        )
      })

      it('refuses isPackage alone for a plain service, which would be a package without services', async () => {
        const created = await createService()
        const before = await storedRows()

        const response = await patch(asAdmin, created.id, { isPackage: true })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['packageServiceIds:too_small'])
        expect(await storedRows()).toEqual(before)
      })

      it('refuses members alone for a plain service', async () => {
        const [first, second] = await createServices(2)
        const created = await createService()
        const before = await storedRows()

        const response = await patch(asAdmin, created.id, {
          packageServiceIds: [first?.id, second?.id],
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['packageServiceIds:not_allowed'])
        expect(await storedRows()).toEqual(before)
      })

      it('refuses isPackage false alone for a package, which would keep its members', async () => {
        const [first, second] = await createServices(2)
        const created = await createPackage([first?.id, second?.id])
        const before = await storedRows()

        const response = await patch(asAdmin, created.id, { isPackage: false })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['packageServiceIds:not_allowed'])
        expect(await storedRows()).toEqual(before)
      })

      it('turns a package into a plain service when the request takes its members away as well', async () => {
        const [first, second] = await createServices(2)
        const created = await createPackage([first?.id, second?.id])

        const response = await patch(asAdmin, created.id, {
          isPackage: false,
          packageServiceIds: [],
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          isPackage: false,
          packageServiceIds: [],
        })
        expect((await remove(asAdmin, first?.id ?? '')).status).toBe(204)
      })

      it('replaces the members of a package with members alone', async () => {
        const [first, second, third] = await createServices(3)
        const created = await createPackage([first?.id, second?.id])

        const response = await patch(asAdmin, created.id, {
          packageServiceIds: [third?.id, first?.id],
        })

        expect(response.status).toBe(200)
        expect(response.body.data.packageServiceIds).toEqual([
          third?.id,
          first?.id,
        ])
      })

      it('refuses fewer than two members for a package', async () => {
        const [first, second] = await createServices(2)
        const created = await createPackage([first?.id, second?.id])
        const before = await storedRows()

        const response = await patch(asAdmin, created.id, {
          packageServiceIds: [first?.id],
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['packageServiceIds:too_small'])
        expect(await storedRows()).toEqual(before)
      })

      it('changes the other properties of a package without looking at its members again', async () => {
        const nested = await insertServiceRow(salonId, {
          isPackage: true,
          packageServiceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID],
        })
        const deleted = await insertServiceRow(salonId, {
          deletedAt: '2026-11-01T00:00:00.000Z',
        })
        const packageId = await insertServiceRow(salonId, {
          name: 'Inherited',
          isPackage: true,
          packageServiceIds: [nested, deleted],
        })

        const response = await patch(asAdmin, packageId, {
          name: 'Renamed',
          price: 9900,
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          name: 'Renamed',
          price: 9900,
          isPackage: true,
          packageServiceIds: [nested, deleted],
        })
      })

      it.each<[string, (id: string) => string, (id: string) => string]>([
        ['the service itself', (id) => id, (id) => id],
        [
          'the service itself, written in upper case',
          (id) => id,
          (id) => id.toUpperCase(),
        ],
        [
          'the service itself, when the path writes its ID in upper case',
          (id) => id.toUpperCase(),
          (id) => id,
        ],
      ])(
        'refuses %s as a member as circular, before it looks for the salon',
        async (_case, pathIdOf, memberIdOf) => {
          const [other] = await createServices(1)
          const created = await createService()
          const body = {
            isPackage: true,
            packageServiceIds: [other?.id, memberIdOf(created.id)],
          }
          const before = await storedRows()

          const here = await patch(asAdmin, pathIdOf(created.id), body)
          const inNoSalon = await patch(
            asAdmin,
            pathIdOf(created.id),
            body,
            UNKNOWN_ID,
          )

          for (const response of [here, inNoSalon]) {
            expectProblem(response, badRequest)
            expect(brokenRules(response)).toEqual([
              'packageServiceIds:circular',
            ])
          }
          expect(await storedRows()).toEqual(before)
        },
      )

      it.each<[string, () => Promise<string>]>([
        ['a service that never existed', async () => UNKNOWN_ID],
        [
          'a service of another salon',
          async () => (await createService({}, await insertSalon(db))).id,
        ],
        [
          'a deleted service of the salon',
          async () => {
            const deleted = await createService({ name: 'Deleted' })
            expect((await remove(asAdmin, deleted.id)).status).toBe(204)
            return deleted.id
          },
        ],
      ])(
        'refuses %s as a member, and changes nothing, also not the other properties of the request or the options',
        async (_case, memberIdOf) => {
          const [first] = await createServices(1)
          const created = await createService()
          const memberId = await memberIdOf()
          const before = await storedRows()

          const response = await patch(asAdmin, created.id, {
            name: 'Renamed',
            options: [],
            isPackage: true,
            packageServiceIds: [first?.id, memberId],
          })

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['packageServiceIds:not_found'])
          expect(await storedRows()).toEqual(before)
        },
      )

      it('refuses a package as a member', async () => {
        const [first, second, third] = await createServices(3)
        const inner = await createPackage([first?.id, second?.id])
        const created = await createService()
        const before = await storedRows()

        const response = await patch(asAdmin, created.id, {
          isPackage: true,
          packageServiceIds: [third?.id, inner.id],
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'packageServiceIds:nested_package',
        ])
        expect(await storedRows()).toEqual(before)
      })

      it('refuses to turn a service that a package contains into a package, and changes nothing', async () => {
        const [member, other, third, fourth] = await createServices(4)
        await createPackage([member?.id, other?.id])
        const before = await storedRows()

        const response = await patch(asAdmin, member?.id ?? '', {
          name: 'Renamed',
          isPackage: true,
          packageServiceIds: [third?.id, fourth?.id],
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'isPackage:contained_in_package',
        ])
        expect(await storedRows()).toEqual(before)
      })

      it('turns a service into a package once the package that contained it is deleted', async () => {
        const [member, other, third, fourth] = await createServices(4)
        const container = await createPackage([member?.id, other?.id])
        expect((await remove(asAdmin, container.id)).status).toBe(204)

        const response = await patch(asAdmin, member?.id ?? '', {
          isPackage: true,
          packageServiceIds: [third?.id, fourth?.id],
        })

        expect(response.status).toBe(200)
        expect(response.body.data.isPackage).toBe(true)
      })

      it('turns a service into a package once it has left the package that contained it', async () => {
        const [member, other, third, fourth] = await createServices(4)
        const container = await createPackage([member?.id, other?.id])
        const left = await patch(asAdmin, container.id, {
          packageServiceIds: [other?.id, third?.id],
        })

        const response = await patch(asAdmin, member?.id ?? '', {
          isPackage: true,
          packageServiceIds: [fourth?.id, other?.id],
        })

        expect(left.status).toBe(200)
        expect(response.status).toBe(200)
        expect(response.body.data.isPackage).toBe(true)
        expect(await packagesContainingPackages()).toEqual([])
      })
    })

    it.each([
      ['an empty request', {}, [':custom']],
      ['null as the name', { name: null }, ['name:invalid_type']],
      ['null as the duration', { duration: null }, ['duration:invalid_type']],
      ['null as the price', { price: null }, ['price:invalid_type']],
      [
        'null as taxIncluded',
        { taxIncluded: null },
        ['taxIncluded:invalid_type'],
      ],
      [
        'null as the pricing strategy',
        { pricingStrategy: null },
        ['pricingStrategy:invalid_value'],
      ],
      ['null as the images', { imageUrls: null }, ['imageUrls:invalid_type']],
      [
        'null as the booking requirements',
        { bookingRequirements: null },
        ['bookingRequirements:invalid_type'],
      ],
      ['null as isPackage', { isPackage: null }, ['isPackage:invalid_type']],
      [
        'null as the members',
        { packageServiceIds: null },
        ['packageServiceIds:invalid_type'],
      ],
      ['null as the tags', { tags: null }, ['tags:invalid_type']],
      [
        'null as the sort order',
        { sortOrder: null },
        ['sortOrder:invalid_type'],
      ],
      [
        'null as the status',
        { serviceStatus: null },
        ['serviceStatus:invalid_value'],
      ],
      [
        'null as the availability',
        { availability: null },
        ['availability:invalid_value'],
      ],
      ['null as isActive', { isActive: null }, ['isActive:invalid_type']],
      ['null as the options', { options: null }, ['options:invalid_type']],
      ['a blank name', { name: ' ' }, ['name:invalid_format']],
      ['a name of 256 characters', { name: 'a'.repeat(256) }, ['name:too_big']],
      ['a duration of 0', { duration: 0 }, ['duration:too_small']],
      ['a duration of 1441 minutes', { duration: 1441 }, ['duration:too_big']],
      ['a negative price', { price: -1 }, ['price:too_small']],
      [
        'a negative discount',
        { discountPrice: -1 },
        ['discountPrice:too_small'],
      ],
      [
        'a category that is not a UUID',
        { categoryId: 'cut' },
        ['categoryId:invalid_format'],
      ],
      [
        'an image URL that is not a URL',
        { imageUrl: 'cut.jpg' },
        ['imageUrl:invalid_format'],
      ],
      [
        'a booking requirement twice',
        { bookingRequirements: ['deposit_required', 'deposit_required'] },
        ['bookingRequirements.1:custom'],
      ],
      [
        'a member of a package that is not a UUID',
        { packageServiceIds: ['cut', UNKNOWN_ID] },
        ['packageServiceIds.0:invalid_format'],
      ],
      [
        'the same member twice',
        { packageServiceIds: [UNKNOWN_ID, UNKNOWN_ID.toUpperCase()] },
        ['packageServiceIds.1:custom'],
      ],
      [
        'an option with a largest quantity of 0',
        { options: [optionRequest({ maxQuantity: 0 })] },
        ['options.0.maxQuantity:too_small'],
      ],
      [
        'an option with an ID',
        { options: [optionRequest({ id: UNKNOWN_ID })] },
        ['options.0.id:unrecognized_keys'],
      ],
      [
        'another salon for the service',
        { salonId: UNKNOWN_ID },
        ['salonId:unrecognized_keys'],
      ],
      [
        'the products a service needs, which never go in or out',
        { requiredProducts: [] },
        ['requiredProducts:unrecognized_keys'],
      ],
      [
        'a property the client may not set',
        { name: 'Renamed', createdAt: '2026-11-14T09:00:00.000Z' },
        ['createdAt:unrecognized_keys'],
      ],
      [
        'several broken rules, all of which it reports',
        { name: '', price: -1, tags: [' '], deletedAt: null },
        [
          'name:invalid_format',
          'price:too_small',
          'tags.0:invalid_format',
          'deletedAt:unrecognized_keys',
        ],
      ],
    ])('rejects %s and changes nothing', async (_case, body, expected) => {
      const created = await createService()
      const before = await storedRows()

      const response = await patch(asAdmin, created.id, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected.toSorted())
      expect(await storedRows()).toEqual(before)
    })

    it('accepts a request with the options alone', async () => {
      const created = await createService()

      const response = await patch(asAdmin, created.id, {
        options: [optionRequest({ name: 'Aroma' })],
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...created,
        options: [optionRequest({ name: 'Aroma' })],
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
    })

    it('rejects a body that is not an object', async () => {
      const created = await createService()

      const response = await patch(asAdmin, created.id, [{ name: 'Renamed' }])

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([':invalid_type'])
    })

    it.each(malformedIds)(
      'rejects %s as the service ID before it looks at the body',
      async (_case, id) => {
        const created = await createService()

        const valid = await patch(asAdmin, id, { name: 'Renamed' })
        const invalid = await patch(asAdmin, id, { name: '' })

        for (const response of [valid, invalid]) {
          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['id:invalid_format'])
        }
        expect((await get(created.id)).body.data).toEqual(created)
      },
    )

    it.each(malformedIds)(
      'rejects %s as the salon ID and changes nothing',
      async (_case, salon) => {
        const created = await createService()

        const response = await patch(
          asAdmin,
          created.id,
          { name: 'Renamed' },
          salon,
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect((await get(created.id)).body.data).toEqual(created)
      },
    )

    it('reports an ID that no service has as not found', async () => {
      await createService()

      const response = await patch(asAdmin, UNKNOWN_ID, { name: 'Renamed' })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Service ${UNKNOWN_ID} was not found`)
    })

    it('reports a service of another salon as not found and leaves it untouched', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createService({}, otherSalonId)
      const before = await storedRows()

      const response = await patch(asAdmin, elsewhere.id, {
        name: 'Renamed',
        options: [],
      })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Service ${elsewhere.id} was not found`)
      expect(await storedRows()).toEqual(before)
    })

    it('reports a deleted service as not found and leaves it untouched', async () => {
      const created = await createService()
      await remove(asAdmin, created.id)
      const before = await storedRows()

      const response = await patch(asAdmin, created.id, { name: 'Renamed' })

      expectProblem(response, notFound)
      expect(await storedRows()).toEqual(before)
    })

    it('reports not found when neither the service nor the category exists', async () => {
      await createService()

      const response = await patch(asAdmin, UNKNOWN_ID, {
        categoryId: ANOTHER_UNKNOWN_ID,
      })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Service ${UNKNOWN_ID} was not found`)
    })

    it('reports a salon that does not exist as not found, once the body is valid, and changes nothing', async () => {
      const created = await createService()
      const before = await storedRows()

      const invalidBody = await patch(
        asAdmin,
        created.id,
        { name: '' },
        UNKNOWN_ID,
      )
      const response = await patch(
        asAdmin,
        created.id,
        { name: 'Renamed', categoryId: UNKNOWN_ID },
        UNKNOWN_ID,
      )

      expectProblem(invalidBody, badRequest)
      expect(brokenRules(invalidBody)).toEqual(['name:invalid_format'])
      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect(await storedRows()).toEqual(before)
    })
  })

  describe('PATCH /api/v1/salons/:salonId/services/bulk', () => {
    it('applies the same changes to every named service, and lists them in the order of the request', async () => {
      const [first, second, third] = await createServices(3)
      const serviceIds = [third?.id ?? '', first?.id ?? '']

      const response = await bulk(asAdmin, {
        serviceIds,
        updates: { price: 8800, isActive: false },
      })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: { updated: serviceIds },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { list: servicesOf(salonId) },
      })
      for (const service of [first, third]) {
        expect((await get(service?.id ?? '')).body.data).toEqual({
          ...service,
          price: 8800,
          isActive: false,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
        expect(await hasMoved(service?.id ?? '')).toBe(true)
      }
      expect((await get(second?.id ?? '')).body.data).toEqual(second)
      expect(await hasMoved(second?.id ?? '')).toBe(false)
    })

    it('gives every named service its own copy of the options of the request', async () => {
      const [first, second, third] = await createServices(3)
      const othersBefore = await storedOptionsOf(third?.id ?? '')
      const options = [
        optionRequest({ name: 'Aroma', sortOrder: 1 }),
        optionRequest({ name: 'Scalp care', sortOrder: 0 }),
      ]

      const response = await bulk(asAdmin, {
        serviceIds: [first?.id, second?.id],
        updates: { options },
      })

      expect(response.status).toBe(200)
      const rowsOfFirst = await storedOptionsOf(first?.id ?? '')
      const rowsOfSecond = await storedOptionsOf(second?.id ?? '')
      for (const rows of [rowsOfFirst, rowsOfSecond]) {
        expect(rows.map(({ name }) => name)).toEqual(['Scalp care', 'Aroma'])
      }
      expect(
        rowsOfFirst.filter(({ id }) =>
          rowsOfSecond.some((row) => row.id === id),
        ),
      ).toEqual([])
      expect((await get(first?.id ?? '')).body.data.options).toEqual([
        options[1],
        options[0],
      ])
      expect(await storedOptionsOf(third?.id ?? '')).toEqual(othersBefore)
    })

    it('removes every option of every named service with an empty list, and leaves the options alone without one', async () => {
      const [first, second] = await createServices(2)
      const before = await storedOptionsOf(second?.id ?? '')

      const removed = await bulk(asAdmin, {
        serviceIds: [first?.id],
        updates: { options: [] },
      })
      const kept = await bulk(asAdmin, {
        serviceIds: [second?.id],
        updates: { name: 'Renamed' },
      })

      expect([removed.status, kept.status]).toEqual([200, 200])
      expect(await storedOptionsOf(first?.id ?? '')).toEqual([])
      expect(await storedOptionsOf(second?.id ?? '')).toEqual(before)
    })

    it('moves services into a category of the salon, and out of it with null', async () => {
      const categoryId = await createCategory()
      const [first, second] = await createServices(2)
      const serviceIds = [first?.id ?? '', second?.id ?? '']

      const into = await bulk(asAdmin, { serviceIds, updates: { categoryId } })
      const categories = (await storedServices()).map((row) => row.categoryId)
      const outOf = await bulk(asAdmin, {
        serviceIds,
        updates: { categoryId: null },
      })

      expect([into.status, outOf.status]).toEqual([200, 200])
      expect(categories).toEqual([categoryId, categoryId])
      expect((await storedServices()).map((row) => row.categoryId)).toEqual([
        null,
        null,
      ])
    })

    it('turns several plain services into packages of the same members', async () => {
      const [first, second, third, fourth] = await createServices(4)

      const response = await bulk(asAdmin, {
        serviceIds: [first?.id, second?.id],
        updates: {
          isPackage: true,
          packageServiceIds: [fourth?.id, third?.id],
        },
      })

      expect(response.status).toBe(200)
      for (const service of [first, second]) {
        expect(await storedService(service?.id ?? '')).toMatchObject({
          isPackage: true,
          packageServiceIds: [fourth?.id, third?.id],
        })
      }
    })

    it.each<[string, () => Promise<string>]>([
      ['a service that never existed', async () => UNKNOWN_ID],
      [
        'a service of another salon',
        async () => (await createService({}, await insertSalon(db))).id,
      ],
      [
        'a deleted service of the salon',
        async () => {
          const deleted = await createService({ name: 'Deleted' })
          expect((await remove(asAdmin, deleted.id)).status).toBe(204)
          return deleted.id
        },
      ],
    ])(
      'reports %s among the services as not found, and changes none of them',
      async (_case, missingIdOf) => {
        const [first, second] = await createServices(2)
        const missingId = await missingIdOf()
        const before = await storedRows()

        const response = await bulk(asAdmin, {
          serviceIds: [first?.id, missingId, second?.id],
          updates: { name: 'Renamed', options: [] },
        })

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Service ${missingId} was not found`)
        expect(await storedRows()).toEqual(before)
      },
    )

    it('names the first of several missing services in the order of the request', async () => {
      const [first] = await createServices(1)

      const response = await bulk(asAdmin, {
        serviceIds: [first?.id, ANOTHER_UNKNOWN_ID, UNKNOWN_ID],
        updates: { name: 'Renamed' },
      })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Service ${ANOTHER_UNKNOWN_ID} was not found`,
      )
    })

    it('refuses a discount above the price of one of the services, as each will be stored, and changes none of them', async () => {
      const cheap = await createService({ price: 3000, discountPrice: null })
      const dear = await createService({ price: 9000, discountPrice: null })
      const before = await storedRows()

      const response = await bulk(asAdmin, {
        serviceIds: [dear.id, cheap.id],
        updates: { discountPrice: 5000, name: 'Renamed' },
      })

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['updates.discountPrice:too_big'])
      expect(await storedRows()).toEqual(before)
    })

    it('refuses a price below the stored discount of one of the services, and changes none of them', async () => {
      const discounted = await createService({
        price: 6600,
        discountPrice: 5500,
      })
      const plain = await createService({ price: 6600, discountPrice: null })
      const before = await storedRows()

      const response = await bulk(asAdmin, {
        serviceIds: [plain.id, discounted.id],
        updates: { price: 5000 },
      })

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['updates.discountPrice:too_big'])
      expect(await storedRows()).toEqual(before)
    })

    it.each<
      [
        string,
        (ids: {
          plain: string[]
          packageId: string
          memberOf: string
        }) => object,
        string,
      ]
    >([
      [
        'members for services that are not packages',
        ({ plain }) => ({
          serviceIds: [plain[0], plain[1]],
          updates: { packageServiceIds: [plain[2], plain[3]] },
        }),
        'updates.packageServiceIds:not_allowed',
      ],
      [
        'members for a package and a service that is not one',
        ({ plain, packageId }) => ({
          serviceIds: [packageId, plain[0]],
          updates: { packageServiceIds: [plain[2], plain[3]] },
        }),
        'updates.packageServiceIds:not_allowed',
      ],
      [
        'isPackage alone for services that have no members',
        ({ plain }) => ({
          serviceIds: [plain[0]],
          updates: { isPackage: true },
        }),
        'updates.packageServiceIds:too_small',
      ],
      [
        'isPackage false alone for a package',
        ({ packageId }) => ({
          serviceIds: [packageId],
          updates: { isPackage: false },
        }),
        'updates.packageServiceIds:not_allowed',
      ],
      [
        'a member that never existed',
        ({ plain }) => ({
          serviceIds: [plain[0]],
          updates: {
            isPackage: true,
            packageServiceIds: [plain[2], UNKNOWN_ID],
          },
        }),
        'updates.packageServiceIds:not_found',
      ],
      [
        'a package as a member',
        ({ plain, packageId }) => ({
          serviceIds: [plain[0]],
          updates: {
            isPackage: true,
            packageServiceIds: [plain[2], packageId],
          },
        }),
        'updates.packageServiceIds:nested_package',
      ],
      [
        'a category that never existed',
        ({ plain }) => ({
          serviceIds: [plain[0], plain[1]],
          updates: { categoryId: UNKNOWN_ID },
        }),
        'updates.categoryId:not_found',
      ],
      [
        'a package made of a service that another package contains',
        ({ plain, memberOf }) => ({
          serviceIds: [plain[0], memberOf],
          updates: { isPackage: true, packageServiceIds: [plain[2], plain[3]] },
        }),
        'updates.isPackage:contained_in_package',
      ],
    ])(
      'refuses %s, reported under updates, and changes none of the services',
      async (_case, bodyOf, expected) => {
        const plain = (await createServices(4)).map(({ id }) => id)
        const [memberOf, otherMember] = await createServices(2)
        const container = await createPackage([memberOf?.id, otherMember?.id])
        const before = await storedRows()

        const response = await bulk(
          asAdmin,
          bodyOf({
            plain,
            packageId: container.id,
            memberOf: memberOf?.id ?? '',
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([expected])
        expect(await storedRows()).toEqual(before)
      },
    )

    it('refuses a category of another salon, and changes none of the services', async () => {
      const categoryId = await createCategory(await insertSalon(db))
      const [first, second] = await createServices(2)
      const before = await storedRows()

      const response = await bulk(asAdmin, {
        serviceIds: [first?.id, second?.id],
        updates: { categoryId, name: 'Renamed' },
      })

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['updates.categoryId:not_found'])
      expect(await storedRows()).toEqual(before)
    })

    it.each([
      ['the first named service', 0],
      ['the second named service, written in upper case', 1],
    ])(
      'refuses members that name %s as circular, before it looks for the salon',
      async (_case, index) => {
        const [first, second, third] = await createServices(3)
        const serviceIds = [first?.id ?? '', second?.id ?? '']
        const named = serviceIds[index] ?? ''
        const body = {
          serviceIds,
          updates: {
            isPackage: true,
            packageServiceIds: [
              third?.id,
              index === 1 ? named.toUpperCase() : named,
            ],
          },
        }
        const before = await storedRows()

        const here = await bulk(asAdmin, body)
        const inNoSalon = await bulk(asAdmin, body, UNKNOWN_ID)

        for (const response of [here, inNoSalon]) {
          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual([
            'updates.packageServiceIds:circular',
          ])
        }
        expect(await storedRows()).toEqual(before)
      },
    )

    it('changes a package together with one of its members when the package gets members that are not among the named services', async () => {
      const [member, otherMember, third, fourth] = await createServices(4)
      const container = await createPackage([member?.id, otherMember?.id])

      const response = await bulk(asAdmin, {
        serviceIds: [container.id, member?.id],
        updates: {
          isPackage: true,
          packageServiceIds: [third?.id, fourth?.id],
        },
      })

      expect(response.status).toBe(200)
      expect(response.body.data.updated).toEqual([container.id, member?.id])
      for (const id of [container.id, member?.id ?? '']) {
        expect(await storedService(id)).toMatchObject({
          isPackage: true,
          packageServiceIds: [third?.id, fourth?.id],
        })
      }
      expect(await packagesContainingPackages()).toEqual([])
    })

    it.each([
      ['no services', { serviceIds: [] }, ['serviceIds:too_small']],
      [
        'more than 100 services',
        { serviceIds: Array.from({ length: 101 }, () => randomUUID()) },
        ['serviceIds:too_big'],
      ],
      [
        'a service ID that is not a UUID',
        { serviceIds: [UNKNOWN_ID, 'latest'] },
        ['serviceIds.1:invalid_format'],
      ],
      [
        'the same service twice',
        { serviceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID, UNKNOWN_ID] },
        ['serviceIds.2:custom'],
      ],
      [
        'the same service once in upper and once in lower case',
        { serviceIds: [UNKNOWN_ID, UNKNOWN_ID.toUpperCase()] },
        ['serviceIds.1:custom'],
      ],
      [
        'no services at all',
        { serviceIds: undefined },
        ['serviceIds:invalid_type'],
      ],
      ['no changes at all', { updates: undefined }, ['updates:invalid_type']],
      ['empty changes', { updates: {} }, ['updates:custom']],
      [
        'a change that breaks the rule of its property',
        { updates: { price: -1 } },
        ['updates.price:too_small'],
      ],
      [
        'null for a property that is never unset',
        { updates: { name: null } },
        ['updates.name:invalid_type'],
      ],
      [
        'an option that breaks a rule',
        { updates: { options: [optionRequest({ optionType: 'gift' })] } },
        ['updates.options.0.optionType:invalid_value'],
      ],
      [
        'another salon for the services',
        { updates: { salonId: UNKNOWN_ID } },
        ['updates.salonId:unrecognized_keys'],
      ],
      [
        'a property of the body that does not exist',
        { salonId: UNKNOWN_ID },
        ['salonId:unrecognized_keys'],
      ],
      [
        'several broken rules, all of which it reports',
        { serviceIds: ['latest'], updates: { duration: 0, sortOrder: -1 } },
        [
          'serviceIds.0:invalid_format',
          'updates.duration:too_small',
          'updates.sortOrder:too_small',
        ],
      ],
    ])('rejects %s and changes nothing', async (_case, change, expected) => {
      const [first] = await createServices(1)
      const before = await storedRows()

      const response = await bulk(asAdmin, {
        serviceIds: [first?.id],
        updates: { name: 'Renamed' },
        ...change,
      })

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected.toSorted())
      expect(await storedRows()).toEqual(before)
    })

    it('accepts 100 services at once', async () => {
      const serviceIds: string[] = []
      for (let index = 0; index < 100; index += 1) {
        serviceIds.push(await insertServiceRow(salonId))
      }

      const response = await bulk(asAdmin, {
        serviceIds,
        updates: { sortOrder: 7 },
      })

      expect(response.status).toBe(200)
      expect(response.body.data.updated).toEqual(serviceIds)
      expect(
        new Set((await storedServices()).map(({ sortOrder }) => sortOrder)),
      ).toEqual(new Set([7]))
    })

    it('rejects a body that is not an object', async () => {
      const response = await bulk(asAdmin, [{ serviceIds: [UNKNOWN_ID] }])

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([':invalid_type'])
    })

    it.each(malformedIds)(
      'rejects %s as the salon ID and changes nothing',
      async (_case, salon) => {
        const [first] = await createServices(1)
        const before = await storedRows()

        const response = await bulk(
          asAdmin,
          { serviceIds: [first?.id], updates: { name: 'Renamed' } },
          salon,
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect(await storedRows()).toEqual(before)
      },
    )

    it('reports a salon that does not exist as not found, once the body is valid, and changes nothing', async () => {
      const [first] = await createServices(1)
      const before = await storedRows()

      const invalidBody = await bulk(
        asAdmin,
        { serviceIds: [first?.id], updates: {} },
        UNKNOWN_ID,
      )
      const response = await bulk(
        asAdmin,
        { serviceIds: [first?.id], updates: { categoryId: UNKNOWN_ID } },
        UNKNOWN_ID,
      )

      expectProblem(invalidBody, badRequest)
      expect(brokenRules(invalidBody)).toEqual(['updates:custom'])
      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect(await storedRows()).toEqual(before)
    })
  })

  describe('DELETE /api/v1/salons/:salonId/services/:id', () => {
    it('marks the service as deleted and keeps its row and its options, and leaves everything else as it is', async () => {
      const otherSalonId = await insertSalon(db)
      const created = await createService({
        options: [optionRequest(), optionRequest({ name: 'Treatment' })],
      })
      await createService({ name: 'Colour' })
      await createService({}, otherSalonId)
      const before = await storedRows()

      const response = await remove(asAdmin, created.id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(response.headers['content-type']).toBeUndefined()
      const after = await storedRows()
      expect(after.options).toEqual(before.options)
      expect(after.services).toEqual(
        before.services.map((row) =>
          row.id === created.id
            ? {
                ...row,
                deletedAt: expect.any(String),
                updatedAt: expect.any(String),
              }
            : row,
        ),
      )
      expect((await storedService(created.id)).deletedAt).not.toBeNull()
    })

    it('hides the deleted service from get, update, delete, the list and its total, packages and bulk updates', async () => {
      const [first, second] = await createServices(2)
      const created = await createService({ name: 'Deleted', sortOrder: 0 })
      expect((await remove(asAdmin, created.id)).status).toBe(204)

      const outcomes = [
        await get(created.id),
        await patch(asAdmin, created.id, { name: 'Renamed' }),
        await remove(asAdmin, created.id),
        await bulk(asAdmin, {
          serviceIds: [first?.id, created.id],
          updates: { name: 'Renamed' },
        }),
      ]
      const listed = await list()
      const asMember = await post(
        asAdmin,
        serviceRequest({
          isPackage: true,
          packageServiceIds: [first?.id, created.id],
        }),
      )

      for (const response of outcomes) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Service ${created.id} was not found`)
      }
      expect(idsOf(listed).toSorted()).toEqual(
        [first?.id, second?.id].toSorted(),
      )
      expect(listed.body.meta.total).toBe(2)
      expectProblem(asMember, badRequest)
      expect(brokenRules(asMember)).toEqual(['packageServiceIds:not_found'])
    })

    it('refuses to delete a service that a package contains with a conflict, and keeps it', async () => {
      const [member, other] = await createServices(2)
      await createPackage([member?.id, other?.id])
      const before = await storedRows()

      const response = await remove(asAdmin, member?.id ?? '')

      expectProblem(response, notAllowed)
      expect(await storedRows()).toEqual(before)
      expect((await get(member?.id ?? '')).status).toBe(200)
    })

    it('deletes a package while it has members, and keeps the members', async () => {
      const [member, other] = await createServices(2)
      const container = await createPackage([member?.id, other?.id])
      const membersBefore = (await storedServices()).filter(
        ({ id }) => id !== container.id,
      )

      const response = await remove(asAdmin, container.id)

      expect(response.status).toBe(204)
      expect(
        (await storedServices()).filter(({ id }) => id !== container.id),
      ).toEqual(membersBefore)
    })

    it('deletes a service once the package that contained it is deleted', async () => {
      const [member, other] = await createServices(2)
      const container = await createPackage([member?.id, other?.id])
      expect((await remove(asAdmin, container.id)).status).toBe(204)

      const response = await remove(asAdmin, member?.id ?? '')

      expect(response.status).toBe(204)
    })

    it('deletes a service once the members of the package that contained it were replaced', async () => {
      const [member, other, third] = await createServices(3)
      const container = await createPackage([member?.id, other?.id])
      const replaced = await patch(asAdmin, container.id, {
        packageServiceIds: [other?.id, third?.id],
      })

      const response = await remove(asAdmin, member?.id ?? '')

      expect(replaced.status).toBe(200)
      expect(response.status).toBe(204)
      expectProblem(await remove(asAdmin, other?.id ?? ''), notAllowed)
    })

    it.each(malformedIds)(
      'rejects %s as the service ID and deletes nothing',
      async (_case, id) => {
        await createService()
        const before = await storedRows()

        const response = await remove(asAdmin, id)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
        expect(await storedRows()).toEqual(before)
      },
    )

    it.each(malformedIds)(
      'rejects %s as the salon ID and deletes nothing',
      async (_case, salon) => {
        const created = await createService()
        const before = await storedRows()

        const response = await remove(asAdmin, created.id, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect(await storedRows()).toEqual(before)
      },
    )

    it('reports an ID that no service has as not found and deletes nothing', async () => {
      await createService()
      const before = await storedRows()

      const response = await remove(asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Service ${UNKNOWN_ID} was not found`)
      expect(await storedRows()).toEqual(before)
    })

    it('reports a service of another salon as not found, like an ID that no service has, and leaves it untouched', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createService({}, otherSalonId)
      const before = await storedRows()

      const response = await remove(asAdmin, elsewhere.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Service ${elsewhere.id} was not found`)
      expect(await storedRows()).toEqual(before)
    })

    it('answers a second DELETE of the same service with 404', async () => {
      const created = await createService()

      const first = await remove(asAdmin, created.id)
      const second = await remove(asAdmin, created.id)

      expect(first.status).toBe(204)
      expectProblem(second, notFound)
    })

    it('reports a salon that does not exist as not found and deletes nothing', async () => {
      const created = await createService()
      const before = await storedRows()

      const response = await remove(asAdmin, created.id, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect(await storedRows()).toEqual(before)
    })

    it('lets one of two DELETEs of the same service at the same moment succeed and answers the other with 404', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createService({ name: `Service ${round}` })

        const responses = await Promise.all([
          remove(asAdmin, created.id),
          remove(asAdmin, created.id),
        ])

        expect(responses.map(({ status }) => status).sort()).toEqual([204, 404])
        expect((await storedService(created.id)).deletedAt).not.toBeNull()
      }
    })
  })

  describe('requests at the same moment', () => {
    /** The rules with which a service is refused that would make packages nest. */
    const nesting = [
      '400 packageServiceIds:nested_package',
      '400 isPackage:contained_in_package',
    ]

    it('lets exactly one of "A becomes a package that contains B" and "B becomes a package" succeed', async () => {
      for (let round = 0; round < 5; round += 1) {
        const [a, b, c, d, e] = await createServices(5)

        const [aBecomes, bBecomes] = await Promise.all([
          patch(asAdmin, a?.id ?? '', {
            isPackage: true,
            packageServiceIds: [b?.id, c?.id],
          }),
          patch(asAdmin, b?.id ?? '', {
            isPackage: true,
            packageServiceIds: [d?.id, e?.id],
          }),
        ])

        expect(
          [aBecomes, bBecomes].map(outcomeOf).filter((o) => o === '200'),
        ).toHaveLength(1)
        expect(
          aBecomes.status === 200 ? outcomeOf(bBecomes) : outcomeOf(aBecomes),
        ).toBe(
          aBecomes.status === 200
            ? '400 isPackage:contained_in_package'
            : '400 packageServiceIds:nested_package',
        )
        expect(await packagesContainingPackages()).toEqual([])
      }
    })

    it('lets exactly one of "a new package contains B" and "B becomes a package" succeed', async () => {
      for (let round = 0; round < 5; round += 1) {
        const [b, c, d, e] = await createServices(4)

        const [created, bBecomes] = await Promise.all([
          post(
            asAdmin,
            serviceRequest({
              isPackage: true,
              packageServiceIds: [b?.id, c?.id],
            }),
          ),
          patch(asAdmin, b?.id ?? '', {
            isPackage: true,
            packageServiceIds: [d?.id, e?.id],
          }),
        ])

        const outcomes = [outcomeOf(created), outcomeOf(bBecomes)]
        expect(outcomes.filter((o) => o === '201' || o === '200')).toHaveLength(
          1,
        )
        for (const outcome of outcomes) {
          expect(['201', '200', ...nesting]).toContain(outcome)
        }
        expect(await packagesContainingPackages()).toEqual([])
      }
    })

    it('lets exactly one of two services succeed that are each to become a package containing the other', async () => {
      for (let round = 0; round < 5; round += 1) {
        const [a, b, x, y] = await createServices(4)

        const responses = await Promise.all([
          patch(asAdmin, a?.id ?? '', {
            isPackage: true,
            packageServiceIds: [b?.id, x?.id],
          }),
          patch(asAdmin, b?.id ?? '', {
            isPackage: true,
            packageServiceIds: [a?.id, y?.id],
          }),
        ])

        const outcomes = responses.map(outcomeOf)
        expect(outcomes.filter((o) => o === '200')).toHaveLength(1)
        for (const outcome of outcomes) {
          expect(['200', ...nesting]).toContain(outcome)
        }
        expect(await packagesContainingPackages()).toEqual([])
      }
    })

    it('refuses at least one of three services that are to become packages in a ring, and never fails', async () => {
      for (let round = 0; round < 5; round += 1) {
        const [a, b, c, x] = await createServices(4)

        const responses = await Promise.all([
          patch(asAdmin, a?.id ?? '', {
            isPackage: true,
            packageServiceIds: [b?.id, x?.id],
          }),
          patch(asAdmin, b?.id ?? '', {
            isPackage: true,
            packageServiceIds: [c?.id, x?.id],
          }),
          patch(asAdmin, c?.id ?? '', {
            isPackage: true,
            packageServiceIds: [a?.id, x?.id],
          }),
        ])

        const outcomes = responses.map(outcomeOf)
        expect(outcomes.filter((o) => o !== '200').length).toBeGreaterThan(0)
        for (const outcome of outcomes) {
          expect(['200', ...nesting]).toContain(outcome)
        }
        expect(await packagesContainingPackages()).toEqual([])
      }
    })

    it('either puts a service that is being deleted into a new package and refuses the delete, or deletes it and refuses the package', async () => {
      for (let round = 0; round < 8; round += 1) {
        const [member, other] = await createServices(2)

        const [created, deleted] = await Promise.all([
          post(
            asAdmin,
            serviceRequest({
              isPackage: true,
              packageServiceIds: [member?.id, other?.id],
            }),
          ),
          remove(asAdmin, member?.id ?? ''),
        ])

        expect([
          ['201', '409'],
          ['400 packageServiceIds:not_found', '204'],
        ]).toContainEqual([outcomeOf(created), outcomeOf(deleted)])
        expect(await packagesNamingDeletedServices()).toEqual([])
      }
    })

    it('either gives a package a member that is being deleted and refuses the delete, or deletes it and refuses the new members', async () => {
      for (let round = 0; round < 8; round += 1) {
        const [member, other, third] = await createServices(3)
        const container = await createPackage([other?.id, third?.id])

        const [changed, deleted] = await Promise.all([
          patch(asAdmin, container.id, {
            packageServiceIds: [member?.id, other?.id],
          }),
          remove(asAdmin, member?.id ?? ''),
        ])

        expect([
          ['200', '409'],
          ['400 packageServiceIds:not_found', '204'],
        ]).toContainEqual([outcomeOf(changed), outcomeOf(deleted)])
        expect(await packagesNamingDeletedServices()).toEqual([])
      }
    })

    it('either creates a service in a category that is being deleted, which then takes it out, or refuses it because the category is gone', async () => {
      const outcomes: string[] = []
      for (let round = 0; round < 8; round += 1) {
        const categoryId = await createCategory()

        const [created, deleted] = await Promise.all([
          post(
            asAdmin,
            serviceRequest({ name: `Service ${round}`, categoryId }),
          ),
          deleteCategory(categoryId),
        ])

        outcomes.push(outcomeOf(created))
        expect(deleted.status).toBe(204)
        expect(['201', '400 categoryId:not_found']).toContain(
          outcomeOf(created),
        )
      }
      expect((await storedServices()).map((row) => row.categoryId)).toEqual(
        outcomes.filter((outcome) => outcome === '201').map(() => null),
      )
    })

    it('either moves services into a category that is being deleted, which then takes them out, or refuses the move because the category is gone', async () => {
      for (let round = 0; round < 8; round += 1) {
        const categoryId = await createCategory()
        const [first, second] = await createServices(2)

        const [moved, deleted] = await Promise.all([
          bulk(asAdmin, {
            serviceIds: [first?.id, second?.id],
            updates: { categoryId },
          }),
          deleteCategory(categoryId),
        ])

        expect(deleted.status).toBe(204)
        expect(['200', '400 updates.categoryId:not_found']).toContain(
          outcomeOf(moved),
        )
        for (const service of [first, second]) {
          expect((await storedService(service?.id ?? '')).categoryId).toBeNull()
        }
      }
    })

    it('runs two bulk updates that name the same services in opposite orders, with single updates among them, to the end, and leaves every service with the changes of the same bulk update', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createServices(4)
        const ids = created.map(({ id }) => id)
        const [, second, third] = ids

        const responses = await Promise.all([
          bulk(asAdmin, {
            serviceIds: ids,
            updates: { name: 'Bulk A', price: 1000, discountPrice: null },
          }),
          patch(asAdmin, second ?? '', { description: 'Single' }),
          bulk(asAdmin, {
            serviceIds: ids.toReversed(),
            updates: { name: 'Bulk B', price: 2000, discountPrice: null },
          }),
          patch(asAdmin, third ?? '', { tags: ['single'] }),
        ])

        expect(responses.map(({ status }) => status)).toEqual([
          200, 200, 200, 200,
        ])
        const rows = (await storedServices()).filter(({ id }) =>
          ids.includes(id),
        )
        const changes = new Set(
          rows.map(({ name, price }) => `${name}:${price}`),
        )
        expect([['Bulk A:1000'], ['Bulk B:2000']]).toContainEqual([...changes])
        expect(rows.find(({ id }) => id === second)?.description).toBe('Single')
        expect(rows.find(({ id }) => id === third)?.tags).toEqual(['single'])
        await db.delete(serviceOptions)
        await db.delete(services)
      }
    })
  })

  describe('a salon that is deleted and still has its services', () => {
    /** A deleted salon with a service and a package, which are all still stored. */
    const deletedSalonWithServices = async () => {
      const [first, second] = await createServices(2)
      const container = await createPackage([first?.id, second?.id])
      await deleteSalon(salonId)
      return { first: first?.id ?? '', container: container.id }
    }

    it('is not found by the list', async () => {
      await deletedSalonWithServices()

      const response = await list()

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
    })

    it('is not found when one of its services is asked for', async () => {
      const { first } = await deletedSalonWithServices()

      const response = await get(first)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
    })

    it('is not found when a service is added to it, and nothing is stored', async () => {
      const { first } = await deletedSalonWithServices()
      const before = await storedRows()

      const response = await post(
        asAdmin,
        serviceRequest({
          isPackage: true,
          packageServiceIds: [first, UNKNOWN_ID],
        }),
      )

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
      expect(await storedRows()).toEqual(before)
    })

    it('is not found when one of its services is changed, alone or with others, and nothing changes', async () => {
      const { first, container } = await deletedSalonWithServices()
      const before = await storedRows()

      const responses = [
        await patch(asAdmin, first, { name: 'Renamed', options: [] }),
        await bulk(asAdmin, {
          serviceIds: [first, container],
          updates: { name: 'Renamed' },
        }),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
      }
      expect(await storedRows()).toEqual(before)
    })

    it('is not found when one of its services is deleted, and nothing is deleted', async () => {
      const { container } = await deletedSalonWithServices()
      const before = await storedRows()

      const response = await remove(asAdmin, container)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
      expect(await storedRows()).toEqual(before)
    })

    it('is not found either when deletedAt was set in its row and not through the API', async () => {
      const created = await createService()
      await db
        .update(salons)
        .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
        .where(eq(salons.id, salonId))
      const before = await storedRows()

      const responses = [
        await list(),
        await get(created.id),
        await post(asAdmin, serviceRequest()),
        await patch(asAdmin, created.id, { name: 'Renamed' }),
        await bulk(asAdmin, {
          serviceIds: [created.id],
          updates: { name: 'Renamed' },
        }),
        await remove(asAdmin, created.id),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(await storedRows()).toEqual(before)
    })
  })

  describe('IDs written in upper case', () => {
    it('name the same service in the path, and the response writes it in lower case', async () => {
      const created = await createService()
      const inUpperCase = created.id.toUpperCase()
      const self = `${servicesOf(salonId)}/${created.id}`

      const one = await get(inUpperCase)
      const changed = await patch(asAdmin, inUpperCase, { name: 'Renamed' })
      const removed = await remove(asAdmin, inUpperCase)

      expect(one.status).toBe(200)
      expect(one.body.data).toEqual(created)
      expect(one.body.links.self).toBe(self)
      expect(changed.status).toBe(200)
      expect(changed.body.data).toMatchObject({
        id: created.id,
        name: 'Renamed',
      })
      expect(changed.body.links.self).toBe(self)
      expect(removed.status).toBe(204)
      expect((await storedService(created.id)).deletedAt).not.toBeNull()
    })

    it('name the same salon in the path, whose links keep the path as written followed by the lower-case ID', async () => {
      const created = await createService()
      const inUpperCase = salonId.toUpperCase()

      const listed = await list('', inUpperCase)
      const one = await get(created.id, inUpperCase)
      const added = await post(asAdmin, serviceRequest(), inUpperCase)
      const changed = await patch(
        asAdmin,
        created.id.toUpperCase(),
        { name: 'Renamed' },
        inUpperCase,
      )
      const changedAll = await bulk(
        asAdmin,
        { serviceIds: [created.id], updates: { sortOrder: 1 } },
        inUpperCase,
      )
      const removed = await remove(asAdmin, created.id, inUpperCase)

      expect(listed.status).toBe(200)
      expect(listed.body.data).toEqual([created])
      expect(listed.body.links.self).toBe(servicesOf(inUpperCase))
      expect(one.status).toBe(200)
      expect(one.body.data).toEqual(created)
      expect(one.body.links).toEqual({
        self: `${servicesOf(inUpperCase)}/${created.id}`,
        list: servicesOf(inUpperCase),
      })
      expect(added.status).toBe(201)
      expect(added.body.data.salonId).toBe(salonId)
      expect(added.body.links.self).toBe(
        `${servicesOf(inUpperCase)}/${added.body.data.id}`,
      )
      expect(added.headers['location']).toBe(added.body.links.self)
      expect(changed.status).toBe(200)
      expect(changed.body.data.salonId).toBe(salonId)
      expect(changed.body.links.self).toBe(
        `${servicesOf(inUpperCase)}/${created.id}`,
      )
      expect(changedAll.status).toBe(200)
      expect(changedAll.body.links).toEqual({ list: servicesOf(inUpperCase) })
      expect(removed.status).toBe(204)
    })

    it('name the same category, when a service is created, changed, moved with others, and when the list is filtered', async () => {
      const categoryId = await createCategory()
      const inUpperCase = categoryId.toUpperCase()
      const created = await createService()

      const added = await post(
        asAdmin,
        serviceRequest({ categoryId: inUpperCase }),
      )
      const changed = await patch(asAdmin, created.id, {
        categoryId: inUpperCase,
      })
      const moved = await bulk(asAdmin, {
        serviceIds: [created.id],
        updates: { categoryId: inUpperCase },
      })
      const listed = await list(`categoryId=${inUpperCase}`)

      expect(added.status).toBe(201)
      expect(added.body.data.categoryId).toBe(categoryId)
      expect(changed.status).toBe(200)
      expect(changed.body.data.categoryId).toBe(categoryId)
      expect(moved.status).toBe(200)
      expect(listed.status).toBe(200)
      expect(idsOf(listed).toSorted()).toEqual(
        [created.id, added.body.data.id].toSorted(),
      )
      expect(listed.body.links.self).toBe(
        `${servicesOf(salonId)}?categoryId=${inUpperCase}`,
      )
    })

    it('name the same services as members of a package, which the response writes in lower case', async () => {
      const [first, second, third] = await createServices(3)
      const created = await createService()

      const added = await post(
        asAdmin,
        serviceRequest({
          isPackage: true,
          packageServiceIds: [
            first?.id.toUpperCase(),
            second?.id.toUpperCase(),
          ],
        }),
      )
      const changed = await patch(asAdmin, created.id, {
        isPackage: true,
        packageServiceIds: [third?.id.toUpperCase(), first?.id],
      })

      expect(added.status).toBe(201)
      expect(added.body.data.packageServiceIds).toEqual([first?.id, second?.id])
      expect(changed.status).toBe(200)
      expect(changed.body.data.packageServiceIds).toEqual([
        third?.id,
        first?.id,
      ])
      expect((await storedService(created.id)).packageServiceIds).toEqual([
        third?.id,
        first?.id,
      ])
    })

    it('name the same services in a bulk update, which lists them in lower case', async () => {
      const [first, second] = await createServices(2)

      const response = await bulk(asAdmin, {
        serviceIds: [second?.id.toUpperCase(), first?.id.toUpperCase()],
        updates: { name: 'Renamed' },
      })

      expect(response.status).toBe(200)
      expect(response.body.data.updated).toEqual([second?.id, first?.id])
      expect((await storedServices()).map(({ name }) => name)).toEqual([
        'Renamed',
        'Renamed',
      ])
    })

    it('name the same service as a cursor, and the page writes it in lower case', async () => {
      const first = await createService({ sortOrder: 1 })
      const second = await createService({ sortOrder: 2 })

      const page = await list(`cursor=${first.id.toUpperCase()}`)

      expect(page.status).toBe(200)
      expect(page.body.data).toEqual([second])
      expect(page.body.meta.cursor).toBe(first.id)
      expect(page.body.links.self).toBe(
        `${servicesOf(salonId)}?cursor=${first.id}`,
      )
    })
  })

  describe('who may manage the services of a salon', () => {
    /** Signs in and returns the Authorization header to send. */
    type SignInAs = (salon: string, otherSalon: string) => Promise<string>

    const member =
      (
        role: 'owner' | 'manager' | 'staff',
        staffOverrides: Parameters<typeof insertMember>[3] = {},
      ): SignInAs =>
      async (salon) => {
        const { email } = await insertMember(db, role, salon, staffOverrides)
        return (await signIn(app, email)).authorization
      }

    const memberOfOther =
      (role: 'owner' | 'manager' | 'staff'): SignInAs =>
      async (salon, otherSalon) =>
        member(role)(otherSalon, salon)

    const customer: SignInAs = async () =>
      (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
        .authorization

    /** Who may add, change and delete the services of the salon under test. */
    const mayManage: [string, SignInAs][] = [
      ['an admin', async () => asAdmin],
      ['the owner of the salon', member('owner')],
      ['a manager of the salon', member('manager')],
    ]

    /** Who may not. The last four have a role without the record it needs. */
    const mayNotManage: [string, SignInAs][] = [
      ['a staff member of the salon', member('staff')],
      ['the owner of another salon', memberOfOther('owner')],
      ['a manager of another salon', memberOfOther('manager')],
      ['a staff member of another salon', memberOfOther('staff')],
      ['a customer', customer],
      [
        'a staff user without a staff member',
        async () =>
          (await signedInUser(app, db, { role: 'staff' })).authorization,
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
        'a manager whose staff member is deleted',
        member('manager', { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ]

    describe('POST /api/v1/salons/:salonId/services', () => {
      it.each(unauthenticated)(
        'answers %s with 401 before looking at anything else, and stores nothing',
        async (_case, tokenOf, problem, challenge) => {
          const authorization = await tokenOf()

          const responses = [
            await post(authorization, serviceRequest()),
            await post(authorization, serviceRequest({ name: '' }), 'latest'),
            await post(authorization, serviceRequest(), UNKNOWN_ID),
          ]

          for (const response of responses) {
            expectProblem(response, problem)
            expect(response.headers['www-authenticate']).toBe(challenge)
          }
          expect(await db.$count(services)).toBe(0)
        },
      )

      it.each(mayManage)(
        'lets %s add a service to the salon',
        async (_case, signInAs) => {
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await post(authorization, serviceRequest())

          expect(response.status).toBe(201)
          expect(response.body.data).toMatchObject({
            salonId,
            name: 'Cut and blow-dry',
          })
          expect((await get(response.body.data.id)).body.data).toEqual(
            response.body.data,
          )
        },
      )

      it.each(mayNotManage)(
        'forbids %s to add a service to the salon and stores nothing',
        async (_case, signInAs) => {
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await post(authorization, serviceRequest())

          expectProblem(response, forbidden)
          expect(await db.$count(services)).toBe(0)
          expect(await db.$count(serviceOptions)).toBe(0)
        },
      )

      it.each(mayNotManage)(
        'forbids %s before validating the body, before the rules of the request, and before looking for the salon, the category or the members',
        async (_case, signInAs) => {
          const authorization = await signInAs(salonId, await insertSalon(db))

          const responses = [
            await post(authorization, serviceRequest({ name: '' })),
            await post(authorization, { salonId }),
            await post(
              authorization,
              serviceRequest({ price: 1000, discountPrice: 2000 }),
            ),
            await post(
              authorization,
              serviceRequest({ categoryId: UNKNOWN_ID }),
            ),
            await post(
              authorization,
              serviceRequest({
                isPackage: true,
                packageServiceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID],
              }),
            ),
            await post(authorization, serviceRequest(), UNKNOWN_ID),
          ]

          for (const response of responses) {
            expectProblem(response, forbidden)
          }
          expect(await db.$count(services)).toBe(0)
        },
      )
    })

    describe('PATCH /api/v1/salons/:salonId/services/:id', () => {
      it.each(unauthenticated)(
        'answers %s with 401 before looking at anything else, and changes nothing',
        async (_case, tokenOf, problem, challenge) => {
          const created = await createService()
          const authorization = await tokenOf()
          const before = await storedRows()

          const responses = [
            await patch(authorization, created.id, { name: 'Renamed' }),
            await patch(authorization, 'latest', {}, 'latest'),
            await patch(authorization, UNKNOWN_ID, { name: 'Renamed' }),
          ]

          for (const response of responses) {
            expectProblem(response, problem)
            expect(response.headers['www-authenticate']).toBe(challenge)
          }
          expect(await storedRows()).toEqual(before)
        },
      )

      it.each(mayManage)(
        'lets %s change a service of the salon',
        async (_case, signInAs) => {
          const created = await createService()
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await patch(authorization, created.id, {
            name: 'Renamed',
          })

          expect(response.status).toBe(200)
          expect(response.body.data).toEqual({
            ...created,
            name: 'Renamed',
            updatedAt: expect.stringMatching(ISO_TIMESTAMP),
          })
        },
      )

      it.each(mayNotManage)(
        'forbids %s to change a service of the salon and changes nothing',
        async (_case, signInAs) => {
          const created = await createService()
          const authorization = await signInAs(salonId, await insertSalon(db))
          const before = await storedRows()

          const response = await patch(authorization, created.id, {
            name: 'Renamed',
            options: [],
          })

          expectProblem(response, forbidden)
          expect(await storedRows()).toEqual(before)
        },
      )

      it.each(mayNotManage)(
        'forbids %s before looking at the service ID, the body or the rules of the request, or for the salon, the service, the category or the members',
        async (_case, signInAs) => {
          const created = await createService()
          const authorization = await signInAs(salonId, await insertSalon(db))
          const before = await storedRows()

          const responses = [
            await patch(authorization, 'latest', { name: 'Renamed' }),
            await patch(authorization, created.id, {}),
            await patch(authorization, created.id, { name: '' }),
            await patch(authorization, created.id, {
              packageServiceIds: [created.id, UNKNOWN_ID],
            }),
            await patch(authorization, UNKNOWN_ID, { name: 'Renamed' }),
            await patch(authorization, created.id, { categoryId: UNKNOWN_ID }),
            await patch(authorization, created.id, {
              isPackage: true,
              packageServiceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID],
            }),
            await patch(
              authorization,
              created.id,
              { name: 'Renamed' },
              UNKNOWN_ID,
            ),
          ]

          for (const response of responses) {
            expectProblem(response, forbidden)
          }
          expect(await storedRows()).toEqual(before)
        },
      )
    })

    describe('PATCH /api/v1/salons/:salonId/services/bulk', () => {
      it.each(unauthenticated)(
        'answers %s with 401 before looking at anything else, and changes nothing',
        async (_case, tokenOf, problem, challenge) => {
          const created = await createService()
          const authorization = await tokenOf()
          const before = await storedRows()

          const responses = [
            await bulk(authorization, {
              serviceIds: [created.id],
              updates: { name: 'Renamed' },
            }),
            await bulk(authorization, {}, 'latest'),
            await bulk(authorization, {
              serviceIds: [UNKNOWN_ID],
              updates: { name: 'Renamed' },
            }),
          ]

          for (const response of responses) {
            expectProblem(response, problem)
            expect(response.headers['www-authenticate']).toBe(challenge)
          }
          expect(await storedRows()).toEqual(before)
        },
      )

      it.each(mayManage)(
        'lets %s change several services of the salon',
        async (_case, signInAs) => {
          const [first, second] = await createServices(2)
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await bulk(authorization, {
            serviceIds: [first?.id, second?.id],
            updates: { name: 'Renamed' },
          })

          expect(response.status).toBe(200)
          expect(response.body.data.updated).toEqual([first?.id, second?.id])
          expect((await storedServices()).map(({ name }) => name)).toEqual([
            'Renamed',
            'Renamed',
          ])
        },
      )

      it.each(mayNotManage)(
        'forbids %s to change several services of the salon and changes nothing',
        async (_case, signInAs) => {
          const [first, second] = await createServices(2)
          const authorization = await signInAs(salonId, await insertSalon(db))
          const before = await storedRows()

          const response = await bulk(authorization, {
            serviceIds: [first?.id, second?.id],
            updates: { name: 'Renamed', options: [] },
          })

          expectProblem(response, forbidden)
          expect(await storedRows()).toEqual(before)
        },
      )

      it.each(mayNotManage)(
        'forbids %s before looking at the body or the rules of the request, or for the salon, the services, the category or the members',
        async (_case, signInAs) => {
          const created = await createService()
          const authorization = await signInAs(salonId, await insertSalon(db))
          const before = await storedRows()

          const responses = [
            await bulk(authorization, {}),
            await bulk(authorization, {
              serviceIds: ['latest'],
              updates: { name: '' },
            }),
            await bulk(authorization, {
              serviceIds: [created.id],
              updates: { packageServiceIds: [created.id, UNKNOWN_ID] },
            }),
            await bulk(authorization, {
              serviceIds: [UNKNOWN_ID],
              updates: { name: 'Renamed' },
            }),
            await bulk(authorization, {
              serviceIds: [created.id],
              updates: { categoryId: UNKNOWN_ID },
            }),
            await bulk(
              authorization,
              { serviceIds: [created.id], updates: { name: 'Renamed' } },
              UNKNOWN_ID,
            ),
          ]

          for (const response of responses) {
            expectProblem(response, forbidden)
          }
          expect(await storedRows()).toEqual(before)
        },
      )
    })

    describe('DELETE /api/v1/salons/:salonId/services/:id', () => {
      it.each(unauthenticated)(
        'answers %s with 401 before looking at anything else, and deletes nothing',
        async (_case, tokenOf, problem, challenge) => {
          const created = await createService()
          const authorization = await tokenOf()
          const before = await storedRows()

          const responses = [
            await remove(authorization, created.id),
            await remove(authorization, 'latest', 'latest'),
            await remove(authorization, UNKNOWN_ID),
          ]

          for (const response of responses) {
            expectProblem(response, problem)
            expect(response.headers['www-authenticate']).toBe(challenge)
          }
          expect(await storedRows()).toEqual(before)
        },
      )

      it.each(mayManage)(
        'lets %s delete a service of the salon',
        async (_case, signInAs) => {
          const created = await createService()
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await remove(authorization, created.id)

          expect(response.status).toBe(204)
          expect((await storedService(created.id)).deletedAt).not.toBeNull()
        },
      )

      it.each(mayNotManage)(
        'forbids %s to delete a service of the salon and deletes nothing',
        async (_case, signInAs) => {
          const created = await createService()
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await remove(authorization, created.id)

          expectProblem(response, forbidden)
          expect((await get(created.id)).body.data).toEqual(created)
          expect((await storedService(created.id)).deletedAt).toBeNull()
        },
      )

      it.each(mayNotManage)(
        'forbids %s before looking at the service ID, or for the salon or the service',
        async (_case, signInAs) => {
          const [member, other] = await createServices(2)
          await createPackage([member?.id, other?.id])
          const authorization = await signInAs(salonId, await insertSalon(db))
          const before = await storedRows()

          const responses = [
            await remove(authorization, 'latest'),
            await remove(authorization, UNKNOWN_ID),
            await remove(authorization, member?.id ?? ''),
            await remove(authorization, member?.id ?? '', UNKNOWN_ID),
          ]

          for (const response of responses) {
            expectProblem(response, forbidden)
          }
          expect(await storedRows()).toEqual(before)
        },
      )
    })

    it.each([...mayManage, ...mayNotManage])(
      'rejects a salon ID that is not a UUID from %s as invalid, whatever else is wrong',
      async (_case, signInAs) => {
        const created = await createService()
        const authorization = await signInAs(salonId, await insertSalon(db))
        const before = await storedRows()

        const responses = [
          await post(authorization, serviceRequest({ name: '' }), 'latest'),
          await patch(authorization, 'latest', {}, 'latest'),
          await patch(authorization, created.id, { name: 'Renamed' }, '42'),
          await bulk(authorization, {}, 'latest'),
          await remove(authorization, 'latest', 'latest'),
          await remove(authorization, created.id, `${salonId}0`),
        ]

        for (const response of responses) {
          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        }
        expect(await storedRows()).toEqual(before)
      },
    )

    it('lets the owner of a salon manage the services of that salon only', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createService({}, otherSalonId)
      const owner = await member('owner')(salonId, otherSalonId)
      const before = await storedRows()

      const inAnotherSalon = [
        await post(owner, serviceRequest(), otherSalonId),
        await patch(owner, elsewhere.id, { name: 'Renamed' }, otherSalonId),
        await bulk(
          owner,
          { serviceIds: [elsewhere.id], updates: { name: 'Renamed' } },
          otherSalonId,
        ),
        await remove(owner, elsewhere.id, otherSalonId),
      ]
      const forbiddenToChange = await storedRows()
      const inTheirSalon = await post(owner, serviceRequest())

      for (const response of inAnotherSalon) {
        expectProblem(response, forbidden)
      }
      expect(forbiddenToChange).toEqual(before)
      expect(inTheirSalon.status).toBe(201)
      expect(inTheirSalon.body.data.salonId).toBe(salonId)
    })

    it.each([
      ['the owner', member('owner')],
      ['a manager', member('manager')],
    ])(
      'lets %s of the salon manage its services when the path writes the ID of the salon in upper case',
      async (_case, signInAs) => {
        const [first, second] = await createServices(2)
        const authorization = await signInAs(salonId, salonId)
        const inUpperCase = salonId.toUpperCase()

        const responses = [
          await post(authorization, serviceRequest(), inUpperCase),
          await patch(
            authorization,
            first?.id ?? '',
            { name: 'Renamed' },
            inUpperCase,
          ),
          await bulk(
            authorization,
            { serviceIds: [first?.id, second?.id], updates: { sortOrder: 3 } },
            inUpperCase,
          ),
          await remove(authorization, second?.id ?? '', inUpperCase),
        ]

        expect(responses.map(({ status }) => status)).toEqual([
          201, 200, 200, 204,
        ])
      },
    )

    it.each(mayNotManage)(
      'lets %s read the services of the salon like anyone',
      async (_case, signInAs) => {
        const created = await createService()
        const authorization = await signInAs(salonId, await insertSalon(db))

        const listed = await authorized(
          request(app).get(servicesOf(salonId)),
          authorization,
        )
        const one = await authorized(
          request(app).get(`${servicesOf(salonId)}/${created.id}`),
          authorization,
        )

        expect(listed.status).toBe(200)
        expect(listed.body.data).toEqual([created])
        expect(one.status).toBe(200)
        expect(one.body.data).toEqual(created)
      },
    )

    it('forbids the owner of another salon to manage the services of a salon that does not exist, where an admin is told the salon is not found', async () => {
      const owner = await member('owner')(salonId, salonId)
      const body = serviceRequest()

      const fromOwner = await post(owner, body, UNKNOWN_ID)
      const fromAdmin = await post(asAdmin, body, UNKNOWN_ID)

      expectProblem(fromOwner, forbidden)
      expectProblem(fromAdmin, notFound)
    })

    it('forbids the owner of a deleted salon to manage its services, where an admin is told the salon is not found', async () => {
      const created = await createService()
      const owner = await member('owner')(salonId, salonId)
      await deleteSalon(salonId)
      const before = await storedRows()

      const requests = (authorization: string) => [
        post(authorization, serviceRequest()),
        patch(authorization, created.id, { name: 'Renamed' }),
        bulk(authorization, {
          serviceIds: [created.id],
          updates: { name: 'Renamed' },
        }),
        remove(authorization, created.id),
      ]
      const fromOwner = await Promise.all(requests(owner))
      const fromAdmin = await Promise.all(requests(asAdmin))

      for (const response of fromOwner) {
        expectProblem(response, forbidden)
      }
      for (const response of fromAdmin) {
        expectProblem(response, notFound)
      }
      expect(await storedRows()).toEqual(before)
    })

    it('checks in order: the salon ID, the permission, the service ID, the body, the rules of the request, the salon, the service', async () => {
      const staff = await member('staff')(salonId, salonId)
      const created = await createService()

      const outcomes = [
        await patch(staff, 'latest', {}, 'latest'),
        await patch(staff, 'latest', {}, UNKNOWN_ID),
        await patch(asAdmin, 'latest', {}, UNKNOWN_ID),
        await patch(asAdmin, UNKNOWN_ID, {}, UNKNOWN_ID),
        await patch(
          asAdmin,
          created.id,
          { packageServiceIds: [created.id, UNKNOWN_ID] },
          UNKNOWN_ID,
        ),
        await patch(asAdmin, UNKNOWN_ID, { name: 'Renamed' }, UNKNOWN_ID),
        await patch(asAdmin, UNKNOWN_ID, { categoryId: UNKNOWN_ID }),
      ].map((response) =>
        response.status === 404
          ? `404 ${response.body.detail}`
          : outcomeOf(response),
      )

      expect(outcomes).toEqual([
        '400 salonId:invalid_format',
        '403',
        '400 id:invalid_format',
        '400 :custom',
        '400 packageServiceIds:circular',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Service ${UNKNOWN_ID} was not found`,
      ])
    })

    it('checks a creation and a bulk update in order: the salon ID, the permission, the body, the rules of the request, the salon, what is stored', async () => {
      const staff = await member('staff')(salonId, salonId)
      const created = await createService()

      const outcomes = [
        await post(staff, {}, 'latest'),
        await post(staff, {}, UNKNOWN_ID),
        await post(asAdmin, serviceRequest({ duration: 0 }), UNKNOWN_ID),
        await post(
          asAdmin,
          serviceRequest({ price: 1000, discountPrice: 2000 }),
          UNKNOWN_ID,
        ),
        await post(
          asAdmin,
          serviceRequest({ categoryId: UNKNOWN_ID }),
          UNKNOWN_ID,
        ),
        await post(asAdmin, serviceRequest({ categoryId: UNKNOWN_ID })),
        await bulk(staff, {}, 'latest'),
        await bulk(staff, {}, UNKNOWN_ID),
        await bulk(asAdmin, { serviceIds: [] }, UNKNOWN_ID),
        await bulk(
          asAdmin,
          {
            serviceIds: [created.id],
            updates: { packageServiceIds: [created.id, UNKNOWN_ID] },
          },
          UNKNOWN_ID,
        ),
        await bulk(
          asAdmin,
          { serviceIds: [UNKNOWN_ID], updates: { name: 'Renamed' } },
          UNKNOWN_ID,
        ),
        await bulk(asAdmin, {
          serviceIds: [UNKNOWN_ID],
          updates: { categoryId: UNKNOWN_ID },
        }),
      ].map((response) =>
        response.status === 404
          ? `404 ${response.body.detail}`
          : outcomeOf(response),
      )

      expect(outcomes).toEqual([
        '400 salonId:invalid_format',
        '403',
        '400 duration:too_small',
        '400 discountPrice:too_big',
        `404 Salon ${UNKNOWN_ID} was not found`,
        '400 categoryId:not_found',
        '400 salonId:invalid_format',
        '403',
        '400 serviceIds:too_small,updates:invalid_type',
        '400 updates.packageServiceIds:circular',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Service ${UNKNOWN_ID} was not found`,
      ])
    })
  })

  describe('ServiceRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    /** The values of a new plain service with nothing that may be unset. */
    const newService = (
      overrides: Partial<DbNewService> = {},
    ): DbNewService => ({
      categoryId: null,
      name: 'Cut',
      description: null,
      shortDescription: null,
      duration: 60,
      price: 6600,
      discountPrice: null,
      taxIncluded: true,
      pricingStrategy: 'fixed',
      imageUrl: null,
      imageUrls: [],
      requiredStaffLevel: null,
      maxBookingsPerDay: null,
      requiresConsultation: false,
      allowOnlineBooking: true,
      bookingRequirements: [],
      isPackage: false,
      packageServiceIds: [],
      tags: [],
      sortOrder: 0,
      serviceStatus: 'active',
      availability: 'always',
      isActive: true,
      ...overrides,
    })

    const newOption = (
      overrides: Partial<DbNewServiceOption> = {},
    ): DbNewServiceOption => ({
      name: 'Head spa',
      description: null,
      optionType: 'addon',
      additionalTime: 10,
      additionalPrice: 1100,
      maxQuantity: 1,
      isRequired: false,
      sortOrder: 0,
      isActive: true,
      ...overrides,
    })

    const repository = () => new ServiceRepository(db)
    const salon = (id: string = salonId) => salonIdSchema.parse(id)
    const service = (id: string) => serviceIdSchema.parse(id)

    /** Stores a service through the repository and returns it with its options. */
    const stored = async (
      salonOf: string,
      overrides: Partial<DbNewService> = {},
      options: DbNewServiceOption[] = [],
    ): Promise<ServiceWithOptions> => {
      const creation = dataOf(
        await repository().create(
          salon(salonOf),
          newService(overrides),
          options,
        ),
      )
      if (creation.type !== 'created') {
        throw new Error(`Expected a service, got ${creation.type}`)
      }
      return creation.service
    }

    /** Two plain services and a package of them, in the salon. */
    const storedPackage = async () => {
      const first = await stored(salonId, { name: 'First' })
      const second = await stored(salonId, { name: 'Second' })
      const container = await stored(salonId, {
        name: 'Package',
        isPackage: true,
        packageServiceIds: [first.service.id, second.service.id],
      })
      return { first, second, container }
    }

    describe('create', () => {
      it('stores the service with its options in the salon it is given and returns them, the options in the order of the menu', async () => {
        const values = newService({
          description: 'A cut',
          discountPrice: 5500,
          tags: ['cut'],
        })
        const options = [
          newOption({ name: 'Second', sortOrder: 1 }),
          newOption({ name: 'First', sortOrder: 0 }),
        ]

        const creation = dataOf(
          await repository().create(salon(), values, options),
        )

        expect(creation).toEqual({
          type: 'created',
          service: {
            service: {
              ...values,
              id: expect.stringMatching(UUID),
              salonId,
              deletedAt: null,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            options: [
              {
                ...options[1],
                id: expect.stringMatching(UUID),
                serviceId: expect.stringMatching(UUID),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
              },
              {
                ...options[0],
                id: expect.stringMatching(UUID),
                serviceId: expect.stringMatching(UUID),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
              },
            ],
          },
        })
        const rows = await storedRows()
        expect(rows.services).toHaveLength(1)
        expect(rows.options).toHaveLength(2)
        expect(
          rows.options.every(
            ({ serviceId }) => serviceId === rows.services[0]?.id,
          ),
        ).toBe(true)
      })

      it('stores a package of services of the salon, and a service in a category of the salon', async () => {
        const first = await stored(salonId)
        const second = await stored(salonId)
        const categoryId = await createCategory()

        const creation = dataOf(
          await repository().create(
            salon(),
            newService({
              categoryId,
              isPackage: true,
              packageServiceIds: [second.service.id, first.service.id],
            }),
            [],
          ),
        )

        expect(creation).toMatchObject({
          type: 'created',
          service: {
            service: {
              categoryId,
              isPackage: true,
              packageServiceIds: [second.service.id, first.service.id],
            },
            options: [],
          },
        })
      })

      it.each<[string, () => Promise<string>]>([
        ['a category that does not exist', async () => UNKNOWN_ID],
        [
          'a category of another salon',
          async () => createCategory(await insertSalon(db)),
        ],
      ])(
        'resolves to categoryNotFound for %s and stores nothing',
        async (_case, categoryIdOf) => {
          const categoryId = await categoryIdOf()

          const creation = await repository().create(
            salon(),
            newService({ categoryId }),
            [newOption()],
          )

          expect(dataOf(creation)).toEqual({ type: 'categoryNotFound' })
          expect(await db.$count(services)).toBe(0)
          expect(await db.$count(serviceOptions)).toBe(0)
        },
      )

      it.each<[string, () => Promise<string>]>([
        ['a service that does not exist', async () => UNKNOWN_ID],
        [
          'a service of another salon',
          async () => (await stored(await insertSalon(db))).service.id,
        ],
        [
          'a deleted service of the salon',
          async () =>
            insertServiceRow(salonId, {
              deletedAt: '2026-11-01T00:00:00.000Z',
            }),
        ],
      ])(
        'resolves to packageMemberNotFound for %s as a member and stores nothing',
        async (_case, memberIdOf) => {
          const member = await stored(salonId)
          const memberId = await memberIdOf()
          const before = await storedRows()

          const creation = await repository().create(
            salon(),
            newService({
              isPackage: true,
              packageServiceIds: [member.service.id, memberId],
            }),
            [newOption()],
          )

          expect(dataOf(creation)).toEqual({ type: 'packageMemberNotFound' })
          expect(await storedRows()).toEqual(before)
        },
      )

      it('resolves to packageMemberIsPackage for a package as a member and stores nothing', async () => {
        const { first, container } = await storedPackage()
        const before = await storedRows()

        const creation = await repository().create(
          salon(),
          newService({
            isPackage: true,
            packageServiceIds: [first.service.id, container.service.id],
          }),
          [newOption()],
        )

        expect(dataOf(creation)).toEqual({ type: 'packageMemberIsPackage' })
        expect(await storedRows()).toEqual(before)
      })
    })

    describe('findById', () => {
      it('finds a service of the salon with its options in the order of the menu', async () => {
        const created = await stored(salonId, {}, [
          newOption({ name: 'Second', sortOrder: 5 }),
          newOption({ name: 'First', sortOrder: 2 }),
        ])

        const found = await repository().findById(
          salon(),
          service(created.service.id),
        )

        expect(dataOf(found)).toEqual(created)
        expect(dataOf(found)?.options.map(({ name }) => name)).toEqual([
          'First',
          'Second',
        ])
      })

      it('resolves to null for a service of another salon, a deleted service and an ID that no service has', async () => {
        const elsewhere = await stored(await insertSalon(db))
        const deleted = await stored(salonId)
        dataOf(await repository().delete(salon(), service(deleted.service.id)))

        const found = await Promise.all(
          [elsewhere.service.id, deleted.service.id, UNKNOWN_ID].map((id) =>
            repository().findById(salon(), service(id)),
          ),
        )

        expect(found.map(dataOf)).toEqual([null, null, null])
      })
    })

    describe('list', () => {
      /**
       * Four services of the salon in the order of the menu, with options;
       * one deleted, and one of another salon.
       */
      const storedMenu = async () => {
        const categoryId = await createCategory()
        const rows = [
          await stored(salonId, { name: 'Cut', sortOrder: 2, categoryId }, [
            newOption({ name: 'Cut option' }),
          ]),
          await stored(salonId, {
            name: 'Colour',
            sortOrder: 1,
            isActive: false,
          }),
          await stored(salonId, { name: 'Perm', sortOrder: 2, categoryId }, [
            newOption({ name: 'Perm B', sortOrder: 1 }),
            newOption({ name: 'Perm A', sortOrder: 0 }),
          ]),
          await stored(salonId, { name: 'Spa', sortOrder: 0 }),
        ]
        const deleted = await stored(salonId, { name: 'Deleted', sortOrder: 1 })
        dataOf(await repository().delete(salon(), service(deleted.service.id)))
        await stored(await insertSalon(db), { name: 'Elsewhere' })
        return {
          categoryId,
          deleted: deleted.service.id,
          menu: rows.toSorted(
            (left, right) =>
              left.service.sortOrder - right.service.sortOrder ||
              (left.service.id < right.service.id ? -1 : 1),
          ),
        }
      }

      const criteria = (overrides: Record<string, unknown> = {}) => ({
        salonId: salon(),
        limit: 10,
        after: null,
        categoryId: null,
        isActive: null,
        ...overrides,
      })

      it('lists the services of the salon by sort order and then by ID, each with its own options, with their number and whether more follow', async () => {
        const { menu } = await storedMenu()

        const first = await repository().list(criteria({ limit: 3 }))
        const second = await repository().list(
          criteria({ limit: 3, after: service(menu[2]?.service.id ?? '') }),
        )

        expect(dataOf(first)).toEqual({
          services: menu.slice(0, 3),
          total: 4,
          hasMore: true,
        })
        expect(dataOf(second)).toEqual({
          services: menu.slice(3),
          total: 4,
          hasMore: false,
        })
      })

      it('says that nothing follows a page that the last services fill exactly', async () => {
        const { menu } = await storedMenu()

        const page = await repository().list(
          criteria({ limit: 2, after: service(menu[1]?.service.id ?? '') }),
        )

        expect(dataOf(page)).toEqual({
          services: menu.slice(2),
          total: 4,
          hasMore: false,
        })
      })

      it.each([true, false])(
        'lists and counts only the services with isActive %s when told to',
        async (isActive) => {
          const { menu } = await storedMenu()
          const expected = menu.filter(
            (row) => row.service.isActive === isActive,
          )

          const page = await repository().list(criteria({ isActive }))

          expect(dataOf(page)).toEqual({
            services: expected,
            total: expected.length,
            hasMore: false,
          })
        },
      )

      it('lists and counts only the services of a category when told to', async () => {
        const { menu, categoryId } = await storedMenu()
        const expected = menu.filter(
          (row) => row.service.categoryId === categoryId,
        )

        const page = await repository().list(
          criteria({ categoryId: categoryIdSchema.parse(categoryId) }),
        )

        expect(dataOf(page)).toEqual({
          services: expected,
          total: 2,
          hasMore: false,
        })
      })

      it('starts after a deleted service of the salon that the cursor names', async () => {
        const { menu, deleted } = await storedMenu()
        const deletedRow = await storedService(deleted)
        const expected = menu.filter(
          (row) =>
            row.service.sortOrder > deletedRow.sortOrder ||
            (row.service.sortOrder === deletedRow.sortOrder &&
              row.service.id > deleted),
        )

        const page = await repository().list(
          criteria({ after: service(deleted) }),
        )

        expect(dataOf(page)).toEqual({
          services: expected,
          total: 4,
          hasMore: false,
        })
      })

      it('resolves to null for a cursor that names no service of the salon', async () => {
        await storedMenu()
        const elsewhere = await stored(await insertSalon(db))

        const pages = await Promise.all(
          [UNKNOWN_ID, elsewhere.service.id].map((cursor) =>
            repository().list(criteria({ after: service(cursor) })),
          ),
        )

        expect(pages.map(dataOf)).toEqual([null, null])
      })

      it('resolves to an empty list for a salon without services', async () => {
        await stored(await insertSalon(db))

        const page = await repository().list(criteria())

        expect(dataOf(page)).toEqual({ services: [], total: 0, hasMore: false })
      })
    })

    describe('update', () => {
      it('changes the given columns, replaces the options when told to, moves updatedAt and returns the service', async () => {
        const created = await stored(salonId, {}, [newOption()])
        const other = await stored(salonId, { name: 'Other' }, [newOption()])

        const update = dataOf(
          await repository().update(
            salon(),
            service(created.service.id),
            { name: 'Renamed', discountPrice: 6000 },
            {
              type: 'replace',
              options: [newOption({ name: 'New', optionType: 'upgrade' })],
            },
          ),
        )

        expect(update).toEqual({
          type: 'updated',
          service: {
            service: {
              ...created.service,
              name: 'Renamed',
              discountPrice: 6000,
              updatedAt: expect.any(String),
            },
            options: [
              {
                ...newOption({ name: 'New', optionType: 'upgrade' }),
                id: expect.stringMatching(UUID),
                serviceId: created.service.id,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
              },
            ],
          },
        })
        expect(await hasMoved(created.service.id)).toBe(true)
        expect(await hasMoved(other.service.id)).toBe(false)
        expect(await storedOptionsOf(other.service.id)).toEqual(other.options)
      })

      it('keeps the options, rows and all, when told to', async () => {
        const created = await stored(salonId, {}, [newOption()])

        const update = dataOf(
          await repository().update(
            salon(),
            service(created.service.id),
            { name: 'Renamed' },
            { type: 'keep' },
          ),
        )

        expect(update).toMatchObject({
          type: 'updated',
          service: { options: created.options },
        })
      })

      it.each<[string, () => Promise<string>]>([
        ['an ID that no service has', async () => UNKNOWN_ID],
        [
          'a service of another salon',
          async () => (await stored(await insertSalon(db))).service.id,
        ],
        [
          'a deleted service',
          async () =>
            insertServiceRow(salonId, {
              deletedAt: '2026-11-01T00:00:00.000Z',
            }),
        ],
      ])(
        'resolves to notFound with the ID for %s, and changes nothing',
        async (_case, idOf) => {
          const id = await idOf()
          const before = await storedRows()

          const update = await repository().update(
            salon(),
            service(id),
            { name: 'Renamed' },
            { type: 'replace', options: [] },
          )

          expect(dataOf(update)).toEqual({ type: 'notFound', id })
          expect(await storedRows()).toEqual(before)
        },
      )

      it.each<[string, Partial<DbNewService>, string[]]>([
        [
          'a discount above the stored price',
          { discountPrice: 9000 },
          ['discountPrice:too_big'],
        ],
        [
          'isPackage without members',
          { isPackage: true },
          ['packageServiceIds:too_small'],
        ],
        [
          'members without isPackage, and a discount above the price',
          {
            packageServiceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID],
            price: 100,
            discountPrice: 200,
          },
          ['discountPrice:too_big', 'packageServiceIds:not_allowed'],
        ],
      ])(
        'resolves to invalid with the issues for %s, as the service will be stored, and changes nothing',
        async (_case, changes, expected) => {
          const created = await stored(salonId, { price: 6600 }, [newOption()])
          const before = await storedRows()

          const update = dataOf(
            await repository().update(
              salon(),
              service(created.service.id),
              changes,
              { type: 'replace', options: [] },
            ),
          )

          expect(update.type).toBe('invalid')
          expect(
            update.type === 'invalid'
              ? update.issues.map(({ field, rule }) => `${field}:${rule}`)
              : [],
          ).toEqual(expected)
          expect(await storedRows()).toEqual(before)
        },
      )

      it('resolves to containedInPackage for a member that is to become a package, and changes nothing', async () => {
        const { first } = await storedPackage()
        const third = await stored(salonId)
        const fourth = await stored(salonId)
        const before = await storedRows()

        const update = await repository().update(
          salon(),
          service(first.service.id),
          {
            isPackage: true,
            packageServiceIds: [third.service.id, fourth.service.id],
          },
          { type: 'keep' },
        )

        expect(dataOf(update)).toEqual({ type: 'containedInPackage' })
        expect(await storedRows()).toEqual(before)
      })

      it.each<
        [
          string,
          (ids: {
            plain: string
            container: string
          }) => Promise<Partial<DbNewService>>,
          string,
        ]
      >([
        [
          'a category of another salon',
          async () => ({
            categoryId: await createCategory(await insertSalon(db)),
          }),
          'categoryNotFound',
        ],
        [
          'a member of another salon',
          async ({ plain }) => ({
            isPackage: true,
            packageServiceIds: [
              plain,
              (await stored(await insertSalon(db))).service.id,
            ],
          }),
          'packageMemberNotFound',
        ],
        [
          'a package as a member',
          async ({ plain, container }) => ({
            isPackage: true,
            packageServiceIds: [plain, container],
          }),
          'packageMemberIsPackage',
        ],
      ])(
        'resolves to the refusal for %s, and changes nothing',
        async (_case, changesOf, expected) => {
          const { container } = await storedPackage()
          const plain = await stored(salonId)
          const target = await stored(salonId, {}, [newOption()])
          const changes = await changesOf({
            plain: plain.service.id,
            container: container.service.id,
          })
          const before = await storedRows()

          const update = await repository().update(
            salon(),
            service(target.service.id),
            { ...changes, name: 'Renamed' },
            { type: 'replace', options: [] },
          )

          expect(dataOf(update)).toEqual({ type: expected })
          expect(await storedRows()).toEqual(before)
        },
      )
    })

    describe('updateMany', () => {
      it('applies the same changes to every service and gives each its own copy of the options', async () => {
        const first = await stored(salonId, { name: 'First' }, [newOption()])
        const second = await stored(salonId, { name: 'Second' })
        const other = await stored(salonId, { name: 'Other' }, [newOption()])

        const update = await repository().updateMany(
          salon(),
          [service(second.service.id), service(first.service.id)],
          { price: 7700 },
          { type: 'replace', options: [newOption({ name: 'Aroma' })] },
        )

        expect(dataOf(update)).toEqual({ type: 'updated' })
        for (const id of [first.service.id, second.service.id]) {
          expect((await storedService(id)).price).toBe(7700)
          expect((await storedOptionsOf(id)).map(({ name }) => name)).toEqual([
            'Aroma',
          ])
        }
        expect(await storedService(other.service.id)).toEqual(other.service)
        expect(await storedOptionsOf(other.service.id)).toEqual(other.options)
      })

      it('resolves to notFound with the first missing ID in the order given, and changes none of them', async () => {
        const first = await stored(salonId)
        const elsewhere = await stored(await insertSalon(db))
        const before = await storedRows()

        const update = await repository().updateMany(
          salon(),
          [
            service(first.service.id),
            service(elsewhere.service.id),
            service(UNKNOWN_ID),
          ],
          { name: 'Renamed' },
          { type: 'replace', options: [] },
        )

        expect(dataOf(update)).toEqual({
          type: 'notFound',
          id: elsewhere.service.id,
        })
        expect(await storedRows()).toEqual(before)
      })

      it('resolves to invalid when one of the services would break a rule, and changes none of them', async () => {
        const dear = await stored(salonId, { price: 9000 })
        const cheap = await stored(salonId, { price: 3000 })
        const before = await storedRows()

        const update = dataOf(
          await repository().updateMany(
            salon(),
            [service(dear.service.id), service(cheap.service.id)],
            { discountPrice: 5000 },
            { type: 'keep' },
          ),
        )

        expect(update).toMatchObject({
          type: 'invalid',
          issues: [{ field: 'discountPrice', rule: 'too_big' }],
        })
        expect(await storedRows()).toEqual(before)
      })

      it('resolves to packageMemberIsPackage when a member is one of the services that become packages', async () => {
        const first = await stored(salonId)
        const second = await stored(salonId)
        const third = await stored(salonId)
        const before = await storedRows()

        const update = await repository().updateMany(
          salon(),
          [service(first.service.id), service(second.service.id)],
          {
            isPackage: true,
            packageServiceIds: [second.service.id, third.service.id],
          },
          { type: 'keep' },
        )

        expect(dataOf(update)).toEqual({ type: 'packageMemberIsPackage' })
        expect(await storedRows()).toEqual(before)
      })

      it('resolves to containedInPackage when one of the services is a member of a package that is not changed', async () => {
        const { first } = await storedPackage()
        const plain = await stored(salonId)
        const third = await stored(salonId)
        const fourth = await stored(salonId)
        const before = await storedRows()

        const update = await repository().updateMany(
          salon(),
          [service(plain.service.id), service(first.service.id)],
          {
            isPackage: true,
            packageServiceIds: [third.service.id, fourth.service.id],
          },
          { type: 'keep' },
        )

        expect(dataOf(update)).toEqual({ type: 'containedInPackage' })
        expect(await storedRows()).toEqual(before)
      })

      it('resolves to categoryNotFound for a category of another salon, and changes none of them', async () => {
        const first = await stored(salonId)
        const categoryId = await createCategory(await insertSalon(db))
        const before = await storedRows()

        const update = await repository().updateMany(
          salon(),
          [service(first.service.id)],
          { categoryId },
          { type: 'keep' },
        )

        expect(dataOf(update)).toEqual({ type: 'categoryNotFound' })
        expect(await storedRows()).toEqual(before)
      })
    })

    describe('delete', () => {
      it('marks the service of the salon as deleted, keeps its options, and resolves to deleted', async () => {
        const created = await stored(salonId, {}, [newOption()])
        const other = await stored(salonId)

        const deletion = await repository().delete(
          salon(),
          service(created.service.id),
        )

        expect(dataOf(deletion)).toEqual({ type: 'deleted' })
        expect(await storedService(created.service.id)).toEqual({
          ...created.service,
          deletedAt: expect.any(String),
          updatedAt: expect.any(String),
        })
        expect(
          (await storedService(created.service.id)).deletedAt,
        ).not.toBeNull()
        expect(await storedOptionsOf(created.service.id)).toEqual(
          created.options,
        )
        expect(await storedService(other.service.id)).toEqual(other.service)
      })

      it('resolves to notFound for an ID that no service has, a service of another salon, and the second time', async () => {
        const created = await stored(salonId)
        const elsewhere = await stored(await insertSalon(db))

        const unknown = await repository().delete(salon(), service(UNKNOWN_ID))
        const ofAnotherSalon = await repository().delete(
          salon(),
          service(elsewhere.service.id),
        )
        const first = await repository().delete(
          salon(),
          service(created.service.id),
        )
        const second = await repository().delete(
          salon(),
          service(created.service.id),
        )

        expect([unknown, ofAnotherSalon, first, second].map(dataOf)).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
          { type: 'deleted' },
          { type: 'notFound' },
        ])
        expect((await storedService(elsewhere.service.id)).deletedAt).toBeNull()
      })

      it('resolves to containedInPackage for a member of a package, and deletes nothing', async () => {
        const { first } = await storedPackage()
        const before = await storedRows()

        const deletion = await repository().delete(
          salon(),
          service(first.service.id),
        )

        expect(dataOf(deletion)).toEqual({ type: 'containedInPackage' })
        expect(await storedRows()).toEqual(before)
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (constraint: string) => ({
      cause: expect.objectContaining({
        code: '23514',
        constraint_name: constraint,
      }),
    })

    it.each<[string, Partial<NewServiceRow>, string]>([
      ['a duration of 0', { duration: 0 }, 'services_duration_positive'],
      ['a negative price', { price: -1 }, 'services_price_not_negative'],
      [
        'a discount above the price',
        { price: 1000, discountPrice: 1001 },
        'services_discount_price_within_price',
      ],
      [
        'a negative discount',
        { discountPrice: -1 },
        'services_discount_price_within_price',
      ],
      [
        'a limit of 0 bookings a day',
        { maxBookingsPerDay: 0 },
        'services_max_bookings_per_day_positive',
      ],
      [
        'a package of one service',
        { isPackage: true, packageServiceIds: [UNKNOWN_ID] },
        'services_package_members',
      ],
      [
        'a package without services',
        { isPackage: true, packageServiceIds: [] },
        'services_package_members',
      ],
      [
        'a package of 21 services',
        {
          isPackage: true,
          packageServiceIds: Array.from({ length: 21 }, () => randomUUID()),
        },
        'services_package_members',
      ],
      [
        'members of a service that is not a package',
        {
          isPackage: false,
          packageServiceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID],
        },
        'services_package_members',
      ],
    ])('refuses a service with %s', async (_case, values, constraint) => {
      await expect(insertServiceRow(salonId, values)).rejects.toMatchObject(
        violationOf(constraint),
      )
      expect(await db.$count(services)).toBe(0)
    })

    it.each<[string, Partial<NewServiceRow>]>([
      ['a discount equal to the price', { price: 1000, discountPrice: 1000 }],
      ['no discount', { discountPrice: null }],
      [
        'a package of 2 services',
        {
          isPackage: true,
          packageServiceIds: [UNKNOWN_ID, ANOTHER_UNKNOWN_ID],
        },
      ],
      [
        'a package of 20 services',
        {
          isPackage: true,
          packageServiceIds: Array.from({ length: 20 }, () => randomUUID()),
        },
      ],
    ])('accepts a service with %s', async (_case, values) => {
      await insertServiceRow(salonId, values)

      expect(await db.$count(services)).toBe(1)
    })

    it.each([
      'imageUrls',
      'tags',
      'packageServiceIds',
      'bookingRequirements',
      'pricingStrategy',
      'serviceStatus',
      'availability',
    ])('refuses NULL as %s of a service', async (column) => {
      const id = await insertServiceRow(salonId)

      await expect(
        db.execute(
          sql`UPDATE ${services} SET ${sql.identifier(column)} = NULL WHERE ${services.id} = ${id}`,
        ),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({ code: '23502', column_name: column }),
      })
    })

    it.each<[string, Partial<NewOptionRow>, string]>([
      [
        'a negative additional time',
        { additionalTime: -1 },
        'service_options_additional_time_not_negative',
      ],
      [
        'a negative additional price',
        { additionalPrice: -1 },
        'service_options_additional_price_not_negative',
      ],
      [
        'a largest quantity of 0',
        { maxQuantity: 0 },
        'service_options_max_quantity_positive',
      ],
    ])('refuses an option with %s', async (_case, values, constraint) => {
      const serviceId = await insertServiceRow(salonId)

      await expect(insertOptionRow(serviceId, values)).rejects.toMatchObject(
        violationOf(constraint),
      )
      expect(await db.$count(serviceOptions)).toBe(0)
    })

    it('refuses NULL as the type of an option', async () => {
      const serviceId = await insertServiceRow(salonId)
      await insertOptionRow(serviceId)

      await expect(
        db.execute(
          sql`UPDATE ${serviceOptions} SET "optionType" = NULL WHERE ${serviceOptions.serviceId} = ${serviceId}`,
        ),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({
          code: '23502',
          column_name: 'optionType',
        }),
      })
    })
  })
})
