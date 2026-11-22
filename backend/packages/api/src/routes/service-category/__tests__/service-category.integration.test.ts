import {
  salons,
  serviceCategories,
  services,
} from '@beauty-salon-backend/database'
import {
  categoryIdSchema,
  type DbNewServiceCategory,
  type DomainError,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import {
  SalonRepository,
  ServiceCategoryRepository,
} from '@beauty-salon-backend/infrastructure'
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
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

const SALONS = '/api/v1/salons'

/** Where the categories of a salon are. */
const categoriesOf = (salonId: string): string =>
  `${SALONS}/${salonId}/service-categories`

/** A UUID that neither a salon nor a category has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The largest value of an `integer` column. */
const MAX_INTEGER = 2_147_483_647

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

/** A category as the API returns it. */
type Category = {
  id: string
  salonId: string
  name: string
  description: string | null
  parentId: string | null
  category: string
  displayOrder: number
  iconUrl: string | null
  color: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** A request that satisfies every rule: a top-level category. */
const categoryRequest = (overrides: Record<string, unknown> = {}) => ({
  name: 'カット',
  description: 'Cuts for every length',
  parentId: null,
  category: 'cut',
  displayOrder: 10,
  iconUrl: 'https://aoyama.example.com/icons/cut.svg',
  color: '#FF8800',
  isActive: true,
  ...overrides,
})

/** An http URL of exactly `length` characters. */
const urlOfLength = (length: number): string => {
  const start = 'https://aoyama.example.com/icons/'
  return `${start}${'a'.repeat(length - start.length)}`
}

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
  ['a UUID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
]

/** The order in which a menu shows categories: by display order, then by ID. */
const inMenuOrder = (categories: Category[]): Category[] =>
  categories.toSorted(
    (left, right) =>
      left.displayOrder - right.displayOrder || (left.id < right.id ? -1 : 1),
  )

/** The categories from which following the parents never arrives at the top. */
const categoriesInLoops = (parents: Record<string, string | null>): string[] =>
  Object.keys(parents).filter((start) => {
    const seen = new Set<string>()
    let current: string | null = start
    while (current !== null && !seen.has(current)) {
      seen.add(current)
      current = parents[current] ?? null
    }
    return current !== null
  })

/** A response in a word: its status and, for a validation problem, the broken rules. */
const outcomeOf = (response: Response): string =>
  response.status === 400
    ? `400 ${brokenRules(response).join(',')}`
    : String(response.status)

const idsOf = (response: Response): string[] =>
  response.body.data.map(({ id }: Category) => id)

describe('Service category API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon whose categories the tests are about. */
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
    authorized(request(app).post(categoriesOf(salon)), authorization).send(body)

  const patch = (
    authorization: string | null,
    id: string,
    body: object,
    salon: string = salonId,
  ) =>
    authorized(
      request(app).patch(`${categoriesOf(salon)}/${id}`),
      authorization,
    ).send(body)

  const remove = (
    authorization: string | null,
    id: string,
    salon: string = salonId,
  ) =>
    authorized(
      request(app).delete(`${categoriesOf(salon)}/${id}`),
      authorization,
    )

  const get = (id: string, salon: string = salonId) =>
    request(app).get(`${categoriesOf(salon)}/${id}`)

  const list = (query = '', salon: string = salonId) =>
    request(app).get(
      query === '' ? categoriesOf(salon) : `${categoriesOf(salon)}?${query}`,
    )

  const createCategory = async (
    overrides: Record<string, unknown> = {},
    salon: string = salonId,
  ): Promise<Category> => {
    const response = await post(asAdmin, categoryRequest(overrides), salon)
    expect(response.status).toBe(201)
    return response.body.data
  }

  /** Hides a salon as `DELETE /api/v1/salons/:id` does; its rows stay. */
  const deleteSalon = async (id: string): Promise<void> => {
    const response = await request(app)
      .delete(`${SALONS}/${id}`)
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

  /** Every stored category of every salon, as its row. */
  const storedCategories = () =>
    db.select().from(serviceCategories).orderBy(asc(serviceCategories.id))

  /** The parent of every stored category, by the ID of the category. */
  const storedParents = async (): Promise<Record<string, string | null>> =>
    Object.fromEntries(
      (await storedCategories()).map(({ id, parentId }) => [id, parentId]),
    )

  /** Whether the stored `updatedAt` of the category lies after its `createdAt`. */
  const hasMoved = async (id: string): Promise<boolean | undefined> => {
    const [row] = await db
      .select({
        moved: sql<boolean>`${serviceCategories.updatedAt} > ${serviceCategories.createdAt}`,
      })
      .from(serviceCategories)
      .where(eq(serviceCategories.id, id))
    return row?.moved
  }

  /** A service of a salon in one of its categories, as a row; returns its ID. */
  const insertService = async (
    salon: string,
    categoryId: string,
  ): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId: salon,
        categoryId,
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

  /** Every stored service of every salon, as its row. */
  const storedServices = () =>
    db.select().from(services).orderBy(asc(services.id))

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

  describe('POST /api/v1/salons/:salonId/service-categories', () => {
    it('creates the category in the salon of the path and returns it with what the server assigned', async () => {
      const response = await post(asAdmin, categoryRequest())

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      const { data, meta, links } = response.body
      expect(data).toEqual({
        ...categoryRequest(),
        id: expect.stringMatching(UUID),
        salonId,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(links).toEqual({
        self: `${categoriesOf(salonId)}/${data.id}`,
        list: categoriesOf(salonId),
      })
      expect(response.headers['location']).toBe(links.self)
      expect(meta).toEqual({
        correlationId: expect.stringMatching(UUID),
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
        version: 'v1',
      })

      const stored = await request(app).get(links.self)
      expect(stored.body.data).toEqual(data)
      expect(await db.$count(serviceCategories)).toBe(1)
    })

    it('stores null as it is given for the properties that may be unset', async () => {
      const unset = {
        description: null,
        parentId: null,
        iconUrl: null,
        color: null,
      }

      const response = await post(asAdmin, categoryRequest(unset))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(unset)
      expect((await get(response.body.data.id)).body.data).toMatchObject(unset)
    })

    it.each([
      ['a name of 100 characters', { name: 'a'.repeat(100) }],
      ['a name with spaces around it', { name: '  カット  ' }],
      ['a display order of 0', { displayOrder: 0 }],
      [
        'the largest display order the column holds',
        { displayOrder: MAX_INTEGER },
      ],
      ['an icon URL of 500 characters', { iconUrl: urlOfLength(500) }],
      ['a colour in lower case', { color: '#ff88aa' }],
      ['an inactive category', { isActive: false }],
    ])('accepts %s and stores it as it is given', async (_case, change) => {
      const response = await post(asAdmin, categoryRequest(change))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(change)
      expect((await get(response.body.data.id)).body.data).toMatchObject(change)
    })

    it.each([
      'cut',
      'color',
      'perm',
      'treatment',
      'spa',
      'styling',
      'extension',
      'other',
    ])('accepts the category %s', async (category) => {
      const response = await post(asAdmin, categoryRequest({ category }))

      expect(response.status).toBe(201)
      expect(response.body.data.category).toBe(category)
    })

    it('creates a subcategory below a category of the same salon, whose kind need not be that of its parent', async () => {
      const parent = await createCategory({ name: 'Cut', category: 'cut' })

      const response = await post(
        asAdmin,
        categoryRequest({
          name: 'Head spa',
          category: 'spa',
          parentId: parent.id,
        }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        salonId,
        parentId: parent.id,
        category: 'spa',
      })
      expect(await storedParents()).toEqual({
        [parent.id]: null,
        [response.body.data.id]: parent.id,
      })
    })

    it('creates subcategories at any depth', async () => {
      const levels: Category[] = [await createCategory({ name: 'Level 0' })]
      for (let depth = 1; depth <= 6; depth += 1) {
        levels.push(
          await createCategory({
            name: `Level ${depth}`,
            parentId: levels.at(-1)?.id,
          }),
        )
      }

      const deepest = await get(levels.at(-1)?.id ?? '')

      expect(deepest.body.data.parentId).toBe(levels.at(-2)?.id)
      expect(await storedParents()).toEqual(
        Object.fromEntries(
          levels.map(({ id }, depth) => [id, levels[depth - 1]?.id ?? null]),
        ),
      )
    })

    it('lets several categories have the same name, also below the same parent', async () => {
      const parent = await createCategory({ name: 'Cut' })

      const responses = [
        await post(asAdmin, categoryRequest({ name: 'Cut' })),
        await post(
          asAdmin,
          categoryRequest({ name: 'Ladies', parentId: parent.id }),
        ),
        await post(
          asAdmin,
          categoryRequest({ name: 'Ladies', parentId: parent.id }),
        ),
      ]

      expect(responses.map(({ status }) => status)).toEqual([201, 201, 201])
      expect((await storedCategories()).map(({ name }) => name).sort()).toEqual(
        ['Cut', 'Cut', 'Ladies', 'Ladies'],
      )
    })

    it.each([
      ['a blank name', { name: '   ' }, ['name:invalid_format']],
      ['a name of 101 characters', { name: 'a'.repeat(101) }, ['name:too_big']],
      ['a missing name', { name: undefined }, ['name:invalid_type']],
      ['null as the name', { name: null }, ['name:invalid_type']],
      [
        'a blank description',
        { description: ' ' },
        ['description:invalid_format'],
      ],
      [
        'a parent that is not a UUID',
        { parentId: 'top' },
        ['parentId:invalid_format'],
      ],
      [
        'a category that is not a kind of service',
        { category: 'nails' },
        ['category:invalid_value'],
      ],
      [
        'a negative display order',
        { displayOrder: -1 },
        ['displayOrder:too_small'],
      ],
      [
        'a display order that is not a whole number',
        { displayOrder: 1.5 },
        ['displayOrder:invalid_type'],
      ],
      [
        'a display order above the largest integer of the column',
        { displayOrder: MAX_INTEGER + 1 },
        ['displayOrder:too_big'],
      ],
      [
        'an icon URL that is neither http nor https',
        { iconUrl: 'ftp://aoyama.example.com/icons/cut.svg' },
        ['iconUrl:invalid_format'],
      ],
      [
        'an icon URL of 501 characters',
        { iconUrl: urlOfLength(501) },
        ['iconUrl:too_big'],
      ],
      ['a colour by its name', { color: 'red' }, ['color:invalid_format']],
      [
        'a colour of three hexadecimal digits',
        { color: '#FFF' },
        ['color:invalid_format'],
      ],
      [
        'a colour with letters that are not hexadecimal digits',
        { color: '#GGGGGG' },
        ['color:invalid_format'],
      ],
      [
        'a colour without the number sign',
        { color: 'FFFFFF' },
        ['color:invalid_format'],
      ],
      ['isActive as text', { isActive: 'yes' }, ['isActive:invalid_type']],
      [
        'a missing isActive',
        { isActive: undefined },
        ['isActive:invalid_type'],
      ],
      [
        'the salon in the body',
        { salonId: UNKNOWN_ID },
        ['salonId:unrecognized_keys'],
      ],
      [
        'a property that does not exist',
        { sortOrder: 1 },
        ['sortOrder:unrecognized_keys'],
      ],
      [
        'several broken rules, all of which it reports',
        { name: '', displayOrder: -1, color: 'red', isActive: 'yes' },
        [
          'name:invalid_format',
          'displayOrder:too_small',
          'color:invalid_format',
          'isActive:invalid_type',
        ],
      ],
    ])('rejects %s and stores nothing', async (_case, change, expected) => {
      const response = await post(asAdmin, categoryRequest(change))

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(await db.$count(serviceCategories)).toBe(0)
    })

    it('reports each broken rule with its field, its rule and a message', async () => {
      const response = await post(asAdmin, categoryRequest({ color: 'red' }))

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        expect.objectContaining({
          field: 'color',
          rule: 'invalid_format',
          message: expect.any(String),
        }),
      ])
    })

    it('rejects a body that is not an object', async () => {
      const response = await post(asAdmin, [categoryRequest()])

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([':invalid_type'])
      expect(await db.$count(serviceCategories)).toBe(0)
    })

    it.each<[string, () => Promise<string>]>([
      ['a category that never existed', async () => UNKNOWN_ID],
      [
        'a category of another salon',
        async () => (await createCategory({}, await insertSalon(db))).id,
      ],
      [
        'a category of the salon that was deleted',
        async () => {
          const deleted = await createCategory()
          await remove(asAdmin, deleted.id)
          return deleted.id
        },
      ],
    ])(
      'refuses %s as the parent and stores nothing',
      async (_case, parentIdOf) => {
        const parentId = await parentIdOf()
        const before = await storedCategories()

        const response = await post(asAdmin, categoryRequest({ parentId }))

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['parentId:not_found'])
        expect(await storedCategories()).toEqual(before)
      },
    )

    it.each(malformedIds)(
      'rejects %s as the salon ID and stores nothing',
      async (_case, salon) => {
        const response = await post(asAdmin, categoryRequest(), salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect(await db.$count(serviceCategories)).toBe(0)
      },
    )

    it('reports a salon that does not exist as not found and stores nothing', async () => {
      const response = await post(asAdmin, categoryRequest(), UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect(await db.$count(serviceCategories)).toBe(0)
    })

    it('validates the body before it looks for the salon, and looks for the salon before the parent', async () => {
      const invalidBody = await post(
        asAdmin,
        categoryRequest({ name: '' }),
        UNKNOWN_ID,
      )
      const unknownParent = await post(
        asAdmin,
        categoryRequest({ parentId: UNKNOWN_ID }),
        UNKNOWN_ID,
      )

      expectProblem(invalidBody, badRequest)
      expect(brokenRules(invalidBody)).toEqual(['name:invalid_format'])
      expectProblem(unknownParent, notFound)
    })
  })

  describe('GET /api/v1/salons/:salonId/service-categories/:id', () => {
    it('returns the category with its links', async () => {
      const parent = await createCategory({ name: 'Cut' })
      const created = await createCategory({
        name: 'Ladies',
        parentId: parent.id,
        isActive: false,
      })

      const response = await get(created.id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...categoryRequest(),
          name: 'Ladies',
          parentId: parent.id,
          isActive: false,
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
          self: `${categoriesOf(salonId)}/${created.id}`,
          list: categoriesOf(salonId),
        },
      })
    })

    it.each(unauthenticated)(
      'answers a request with %s like one without a token: reading is public',
      async (_case, tokenOf) => {
        const created = await createCategory()
        const authorization = await tokenOf()

        const response = await authorized(
          request(app).get(`${categoriesOf(salonId)}/${created.id}`),
          authorization,
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual(created)
      },
    )

    it.each(malformedIds)(
      'rejects %s as the category ID',
      async (_case, id) => {
        const response = await get(id)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      },
    )

    it.each(malformedIds)(
      'rejects %s as the salon ID',
      async (_case, salon) => {
        const created = await createCategory()

        const response = await get(created.id, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
      },
    )

    it('reports an ID that no category has as not found', async () => {
      await createCategory()

      const response = await get(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Service category ${UNKNOWN_ID} was not found`,
      )
    })

    it('reports a category of another salon as not found, like an ID that no category has', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createCategory({}, otherSalonId)

      const response = await get(elsewhere.id)
      const unknown = await get(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Service category ${elsewhere.id} was not found`,
      )
      expect({ ...response.body, detail: null }).toEqual({
        ...unknown.body,
        detail: null,
        instance: response.body.instance,
        correlationId: response.body.correlationId,
        timestamp: response.body.timestamp,
      })
      expect((await get(elsewhere.id, otherSalonId)).status).toBe(200)
    })

    it('reports a category that was deleted as not found', async () => {
      const created = await createCategory()
      await remove(asAdmin, created.id)

      const response = await get(created.id)

      expectProblem(response, notFound)
    })

    it('reports a salon that does not exist as not found', async () => {
      const created = await createCategory()

      const response = await get(created.id, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
    })
  })

  describe('GET /api/v1/salons/:salonId/service-categories', () => {
    /**
     * Five categories of the salon in the order of the menu: display orders
     * repeat and two categories are inactive. Another salon has one too.
     */
    const createMenu = async (): Promise<Category[]> => {
      const created = [
        await createCategory({ name: 'Cut', displayOrder: 1 }),
        await createCategory({
          name: 'Color',
          displayOrder: 2,
          isActive: false,
        }),
        await createCategory({ name: 'Perm', displayOrder: 2 }),
        await createCategory({ name: 'Spa', displayOrder: 2, isActive: false }),
        await createCategory({ name: 'Other', displayOrder: 0 }),
      ]
      await createCategory(
        { name: 'Elsewhere', displayOrder: 1 },
        await insertSalon(db),
      )
      return inMenuOrder(created)
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

    it('returns an empty page when the salon has no categories', async () => {
      await createCategory({}, await insertSalon(db))

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
          self: categoriesOf(salonId),
          first: categoriesOf(salonId),
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('returns the categories of the salon only, by display order and then by ID, inactive ones included', async () => {
      const menu = await createMenu()

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: menu,
        meta: {
          total: 5,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: categoriesOf(salonId),
          first: categoriesOf(salonId),
          last: null,
          next: null,
          prev: null,
        },
      })
      expect(response.body.data.map(({ name }: Category) => name)).toEqual([
        'Other',
        'Cut',
        ...menu.slice(2).map(({ name }) => name),
      ])
    })

    it.each([
      ['true', true],
      ['false', false],
    ])(
      'returns only the categories with isActive %s when asked, and counts only them',
      async (text, isActive) => {
        const menu = await createMenu()
        const expected = menu.filter(
          (category) => category.isActive === isActive,
        )

        const response = await list(`isActive=${text}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual(expected)
        expect(response.body.meta).toMatchObject({
          total: expected.length,
          hasMore: false,
        })
      },
    )

    it('walks through the pages with the link of the page before, returning every category once and in order where display orders repeat', async () => {
      const menu = await createMenu()
      const ids = menu.map(({ id }) => id)
      const firstPage = `${categoriesOf(salonId)}?limit=2`

      const pages = await walk(firstPage)

      expect(pages.flatMap((page) => page.body.data)).toEqual(menu)
      expect(pages.map((page) => page.body.meta)).toEqual([
        {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: ids[1],
          prevCursor: null,
        },
        {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: ids[1],
          nextCursor: ids[3],
          prevCursor: null,
        },
        {
          total: 5,
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

    it.each([
      ['true', true],
      ['false', false],
    ])(
      'walks through the categories with isActive %s one at a time, keeping the filter in every link',
      async (text, isActive) => {
        const menu = await createMenu()
        const expected = menu.filter(
          (category) => category.isActive === isActive,
        )
        const firstPage = `${categoriesOf(salonId)}?isActive=${text}&limit=1`

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

    it('says that no page follows a page that the last categories fill exactly', async () => {
      const menu = await createMenu()

      const whole = await list('limit=5')
      const rest = await list(`limit=3&cursor=${menu[1]?.id}`)

      expect(idsOf(whole)).toEqual(menu.map(({ id }) => id))
      expect(whole.body.meta).toMatchObject({
        total: 5,
        hasMore: false,
        nextCursor: null,
      })
      expect(whole.body.links.next).toBeNull()
      expect(idsOf(rest)).toEqual(menu.slice(2).map(({ id }) => id))
      expect(rest.body.meta).toMatchObject({
        total: 5,
        hasMore: false,
        nextCursor: null,
      })
      expect(rest.body.links.next).toBeNull()
    })

    it('gives pages of 20 categories unless another limit is asked for, and up to 100', async () => {
      for (let order = 0; order < 21; order += 1) {
        await createCategory({ name: `Category ${order}`, displayOrder: order })
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

    it('starts the page after a cursor that names a category of the salon which the filter leaves out', async () => {
      const menu = await createMenu()
      const inactive = menu.findIndex(({ isActive }) => !isActive)
      const cursor = menu[inactive]?.id

      const response = await list(`isActive=true&cursor=${cursor}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(
        menu.slice(inactive + 1).filter(({ isActive }) => isActive),
      )
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it.each<[string, () => Promise<string>]>([
      ['a category that never existed', async () => UNKNOWN_ID],
      [
        'a category of another salon',
        async () => (await createCategory({}, await insertSalon(db))).id,
      ],
      [
        'a category of the salon that was deleted since',
        async () => {
          const deleted = await createCategory({ displayOrder: 1 })
          await remove(asAdmin, deleted.id)
          return deleted.id
        },
      ],
    ])(
      'refuses a cursor that names %s as a broken rule of the cursor',
      async (_case, cursorOf) => {
        await createCategory()
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
      ['a parameter that does not exist', 'page=2', ['page:unrecognized_keys']],
      [
        'the salon as a parameter of the query',
        `salonId=${UNKNOWN_ID}`,
        ['salonId:unrecognized_keys'],
      ],
      [
        'a filter that the list does not have',
        'category=cut',
        ['category:unrecognized_keys'],
      ],
      [
        'several broken rules, all of which it reports',
        'limit=0&cursor=abc&page=2',
        ['limit:too_small', 'cursor:invalid_format', 'page:unrecognized_keys'],
      ],
    ])('rejects %s', async (_case, query, expected) => {
      await createCategory()

      const response = await list(query)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
    })

    it.each(unauthenticated)(
      'answers a request with %s like one without a token: reading is public',
      async (_case, tokenOf) => {
        const created = await createCategory()
        const authorization = await tokenOf()

        const response = await authorized(
          request(app).get(categoriesOf(salonId)),
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
      await createCategory()

      const response = await list('', UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
    })
  })

  describe('PATCH /api/v1/salons/:salonId/service-categories/:id', () => {
    /**
     * A menu of the salon:
     *
     *   cut ─┬─ ladies ─── bob ─── shortBob
     *        └─ mens
     *   color ── highlights
     */
    const createTree = async () => {
      const cut = await createCategory({ name: 'Cut' })
      const ladies = await createCategory({ name: 'Ladies', parentId: cut.id })
      const mens = await createCategory({ name: 'Mens', parentId: cut.id })
      const bob = await createCategory({ name: 'Bob', parentId: ladies.id })
      const shortBob = await createCategory({
        name: 'Short bob',
        parentId: bob.id,
      })
      const color = await createCategory({ name: 'Color' })
      const highlights = await createCategory({
        name: 'Highlights',
        parentId: color.id,
      })
      return { cut, ladies, mens, bob, shortBob, color, highlights }
    }

    it('changes the given properties and nothing else, and moves updatedAt', async () => {
      const created = await createCategory()
      const other = await createCategory({ name: 'Color' })

      const response = await patch(asAdmin, created.id, {
        name: 'Renamed',
        displayOrder: 3,
      })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...created,
          name: 'Renamed',
          displayOrder: 3,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${categoriesOf(salonId)}/${created.id}`,
          list: categoriesOf(salonId),
        },
      })
      expect((await get(created.id)).body.data).toEqual(response.body.data)
      expect(await hasMoved(created.id)).toBe(true)
      expect((await get(other.id)).body.data).toEqual(other)
      expect(await hasMoved(other.id)).toBe(false)
    })

    it.each([
      ['name', 'Renamed'],
      ['description', 'Another description'],
      ['category', 'spa'],
      ['displayOrder', 0],
      ['iconUrl', 'http://aoyama.example.com/icons/other.svg'],
      ['color', '#00ff00'],
      ['isActive', false],
    ])(
      'changes %s alone when it is the only property given',
      async (property, value) => {
        const created = await createCategory()

        const response = await patch(asAdmin, created.id, { [property]: value })

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...created,
          [property]: value,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
        expect((await get(created.id)).body.data).toEqual(response.body.data)
      },
    )

    it('unsets a property that may be unset when it is given as null', async () => {
      const parent = await createCategory({ name: 'Cut' })
      const created = await createCategory({ parentId: parent.id })
      const unset = {
        description: null,
        parentId: null,
        iconUrl: null,
        color: null,
      }

      const response = await patch(asAdmin, created.id, unset)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...created,
        ...unset,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect((await get(created.id)).body.data).toEqual(response.body.data)
    })

    it('accepts a request that changes every property at once', async () => {
      const parent = await createCategory({ name: 'Cut' })
      const created = await createCategory()
      const everything = {
        name: 'Head spa',
        description: null,
        parentId: parent.id,
        category: 'spa',
        displayOrder: 0,
        iconUrl: null,
        color: '#00ff00',
        isActive: false,
      }

      const response = await patch(asAdmin, created.id, everything)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...created,
        ...everything,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
    })

    it('moves a subcategory to the top level when parentId is null, and leaves its own subcategories below it', async () => {
      const { cut, ladies, mens, bob, shortBob, color, highlights } =
        await createTree()

      const response = await patch(asAdmin, ladies.id, { parentId: null })

      expect(response.status).toBe(200)
      expect(response.body.data.parentId).toBeNull()
      expect(await storedParents()).toEqual({
        [cut.id]: null,
        [ladies.id]: null,
        [mens.id]: cut.id,
        [bob.id]: ladies.id,
        [shortBob.id]: bob.id,
        [color.id]: null,
        [highlights.id]: color.id,
      })
    })

    it('moves a category below a sibling', async () => {
      const { ladies, mens } = await createTree()

      const response = await patch(asAdmin, ladies.id, { parentId: mens.id })

      expect(response.status).toBe(200)
      expect(response.body.data.parentId).toBe(mens.id)
      expect((await storedParents())[ladies.id]).toBe(mens.id)
    })

    it('moves a category with its subcategories below a category of another branch', async () => {
      const { cut, ladies, mens, bob, shortBob, color, highlights } =
        await createTree()

      const response = await patch(asAdmin, ladies.id, {
        parentId: highlights.id,
      })

      expect(response.status).toBe(200)
      expect(response.body.data.parentId).toBe(highlights.id)
      expect(await storedParents()).toEqual({
        [cut.id]: null,
        [ladies.id]: highlights.id,
        [mens.id]: cut.id,
        [bob.id]: ladies.id,
        [shortBob.id]: bob.id,
        [color.id]: null,
        [highlights.id]: color.id,
      })
    })

    it('moves a top-level category below another top-level category', async () => {
      const { cut, color } = await createTree()

      const response = await patch(asAdmin, cut.id, { parentId: color.id })

      expect(response.status).toBe(200)
      expect((await storedParents())[cut.id]).toBe(color.id)
    })

    it('moves a category below its former subcategory once that one was moved out of its subtree', async () => {
      const { cut, ladies, bob } = await createTree()
      const movedOut = await patch(asAdmin, bob.id, { parentId: null })

      const response = await patch(asAdmin, cut.id, { parentId: bob.id })

      expect(movedOut.status).toBe(200)
      expect(response.status).toBe(200)
      expect(response.body.data.parentId).toBe(bob.id)
      expect(await storedParents()).toMatchObject({
        [bob.id]: null,
        [cut.id]: bob.id,
        [ladies.id]: cut.id,
      })
    })

    it('accepts the parent the category already has', async () => {
      const { cut, ladies } = await createTree()

      const response = await patch(asAdmin, ladies.id, { parentId: cut.id })

      expect(response.status).toBe(200)
      expect(response.body.data.parentId).toBe(cut.id)
    })

    it.each<
      [
        string,
        (tree: Awaited<ReturnType<typeof createTree>>) => [Category, Category],
      ]
    >([
      ['the category itself', ({ ladies }) => [ladies, ladies]],
      ['one of its subcategories', ({ cut, mens }) => [cut, mens]],
      [
        'a subcategory of a subcategory',
        ({ ladies, shortBob }) => [ladies, shortBob],
      ],
      [
        'a category three levels below it',
        ({ cut, shortBob }) => [cut, shortBob],
      ],
    ])(
      'refuses %s as the parent as circular, and changes nothing, also not the other properties of the request',
      async (_case, pick) => {
        const [category, parent] = pick(await createTree())
        const before = await storedCategories()

        const response = await patch(asAdmin, category.id, {
          name: 'Renamed',
          isActive: false,
          parentId: parent.id,
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['parentId:circular'])
        expect(await storedCategories()).toEqual(before)
      },
    )

    it.each<
      [
        string,
        (tree: Awaited<ReturnType<typeof createTree>>) => [string, string],
      ]
    >([
      [
        'the request writes the ID of the category itself in upper case',
        ({ ladies }) => [ladies.id, ladies.id.toUpperCase()],
      ],
      [
        'the request writes the ID of a subcategory in upper case',
        ({ cut, shortBob }) => [cut.id, shortBob.id.toUpperCase()],
      ],
      [
        'the path writes the ID of the category in upper case and the parent is the category itself',
        ({ ladies }) => [ladies.id.toUpperCase(), ladies.id],
      ],
      [
        'the path writes the ID of the category in upper case and the parent is a subcategory',
        ({ cut, shortBob }) => [cut.id.toUpperCase(), shortBob.id],
      ],
    ])(
      'refuses a parent that would close a loop as circular when %s',
      async (_case, pick) => {
        const [id, parentId] = pick(await createTree())
        const before = await storedCategories()

        const response = await patch(asAdmin, id, { parentId })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['parentId:circular'])
        expect(await storedCategories()).toEqual(before)
      },
    )

    it.each<[string, () => Promise<string>]>([
      ['a category that never existed', async () => UNKNOWN_ID],
      [
        'a category of another salon',
        async () => (await createCategory({}, await insertSalon(db))).id,
      ],
      [
        'a category of the salon that was deleted',
        async () => {
          const deleted = await createCategory()
          await remove(asAdmin, deleted.id)
          return deleted.id
        },
      ],
    ])(
      'refuses %s as the parent, and changes nothing, also not the other properties of the request',
      async (_case, parentIdOf) => {
        const created = await createCategory()
        const parentId = await parentIdOf()
        const before = await storedCategories()

        const response = await patch(asAdmin, created.id, {
          name: 'Renamed',
          parentId,
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['parentId:not_found'])
        expect(await storedCategories()).toEqual(before)
      },
    )

    it.each([
      ['an empty request', {}, [':custom']],
      ['null as the name', { name: null }, ['name:invalid_type']],
      ['null as the category', { category: null }, ['category:invalid_value']],
      ['null as isActive', { isActive: null }, ['isActive:invalid_type']],
      [
        'null as the display order',
        { displayOrder: null },
        ['displayOrder:invalid_type'],
      ],
      ['a blank name', { name: ' ' }, ['name:invalid_format']],
      ['a name of 101 characters', { name: 'a'.repeat(101) }, ['name:too_big']],
      [
        'a blank description',
        { description: '' },
        ['description:invalid_format'],
      ],
      [
        'a parent that is not a UUID',
        { parentId: 'top' },
        ['parentId:invalid_format'],
      ],
      [
        'a category that is not a kind of service',
        { category: 'nails' },
        ['category:invalid_value'],
      ],
      [
        'a negative display order',
        { displayOrder: -1 },
        ['displayOrder:too_small'],
      ],
      [
        'a display order above the largest integer of the column',
        { displayOrder: MAX_INTEGER + 1 },
        ['displayOrder:too_big'],
      ],
      [
        'an icon URL that is not a URL',
        { iconUrl: 'cut.svg' },
        ['iconUrl:invalid_format'],
      ],
      [
        'a colour of three hexadecimal digits',
        { color: '#FFF' },
        ['color:invalid_format'],
      ],
      ['isActive as text', { isActive: 'no' }, ['isActive:invalid_type']],
      [
        'another salon for the category',
        { salonId: UNKNOWN_ID },
        ['salonId:unrecognized_keys'],
      ],
      [
        'a property the client may not set',
        { name: 'Renamed', createdAt: '2026-11-14T09:00:00.000Z' },
        ['createdAt:unrecognized_keys'],
      ],
      [
        'several broken rules, all of which it reports',
        { name: '', color: 'red', displayOrder: 1.5 },
        [
          'name:invalid_format',
          'displayOrder:invalid_type',
          'color:invalid_format',
        ],
      ],
    ])('rejects %s and changes nothing', async (_case, body, expected) => {
      const created = await createCategory()
      const before = await storedCategories()

      const response = await patch(asAdmin, created.id, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(await storedCategories()).toEqual(before)
    })

    it('rejects a body that is not an object', async () => {
      const created = await createCategory()

      const response = await patch(asAdmin, created.id, [{ name: 'Renamed' }])

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([':invalid_type'])
    })

    it.each(malformedIds)(
      'rejects %s as the category ID before it looks at the body',
      async (_case, id) => {
        const created = await createCategory()

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
        const created = await createCategory()

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

    it('reports an ID that no category has as not found', async () => {
      await createCategory()

      const response = await patch(asAdmin, UNKNOWN_ID, { name: 'Renamed' })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Service category ${UNKNOWN_ID} was not found`,
      )
    })

    it.each([
      ['a change of its name', { name: 'Renamed' }],
      ['a move to the top level', { parentId: null }],
    ])(
      'reports a category of another salon as not found for %s, and leaves it untouched',
      async (_case, body) => {
        const otherSalonId = await insertSalon(db)
        const parent = await createCategory({ name: 'Cut' }, otherSalonId)
        const elsewhere = await createCategory(
          { parentId: parent.id },
          otherSalonId,
        )
        const before = await storedCategories()

        const response = await patch(asAdmin, elsewhere.id, body)

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Service category ${elsewhere.id} was not found`,
        )
        expect(await storedCategories()).toEqual(before)
      },
    )

    it('reports a category of another salon as not found when it is to move below a category of the salon of the path, and leaves it untouched', async () => {
      const here = await createCategory({ name: 'Here' })
      const elsewhere = await createCategory({}, await insertSalon(db))
      const before = await storedCategories()

      const response = await patch(asAdmin, elsewhere.id, { parentId: here.id })

      expectProblem(response, notFound)
      expect(await storedCategories()).toEqual(before)
    })

    it('reports not found when neither the category nor the parent exists', async () => {
      await createCategory()

      const response = await patch(asAdmin, UNKNOWN_ID, {
        parentId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
      })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Service category ${UNKNOWN_ID} was not found`,
      )
    })

    it('reports a category that was deleted as not found', async () => {
      const created = await createCategory()
      await remove(asAdmin, created.id)

      const response = await patch(asAdmin, created.id, { name: 'Renamed' })

      expectProblem(response, notFound)
    })

    it('reports a salon that does not exist as not found, once the body is valid, and changes nothing', async () => {
      const created = await createCategory()

      const invalidBody = await patch(
        asAdmin,
        created.id,
        { name: '' },
        UNKNOWN_ID,
      )
      const response = await patch(
        asAdmin,
        created.id,
        { name: 'Renamed', parentId: UNKNOWN_ID },
        UNKNOWN_ID,
      )

      expectProblem(invalidBody, badRequest)
      expect(brokenRules(invalidBody)).toEqual(['name:invalid_format'])
      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect((await get(created.id)).body.data).toEqual(created)
    })

    it('lets exactly one of two moves at the same moment succeed that would put two categories below each other', async () => {
      for (let round = 0; round < 5; round += 1) {
        const x = await createCategory({ name: `X${round}` })
        const y = await createCategory({ name: `Y${round}` })

        const responses = await Promise.all([
          patch(asAdmin, x.id, { parentId: y.id }),
          patch(asAdmin, y.id, { parentId: x.id }),
        ])

        expect(responses.map(outcomeOf).sort()).toEqual([
          '200',
          '400 parentId:circular',
        ])
        const parents = await storedParents()
        expect(categoriesInLoops(parents)).toEqual([])
        expect({ x: parents[x.id], y: parents[y.id] }).toEqual(
          responses[0].status === 200
            ? { x: y.id, y: null }
            : { x: null, y: x.id },
        )
      }
    })

    it('lets exactly two of three moves at the same moment succeed that would put three categories in a ring', async () => {
      for (let round = 0; round < 5; round += 1) {
        const a = await createCategory({ name: `A${round}` })
        const b = await createCategory({ name: `B${round}` })
        const c = await createCategory({ name: `C${round}` })

        const responses = await Promise.all([
          patch(asAdmin, a.id, { parentId: b.id }),
          patch(asAdmin, b.id, { parentId: c.id }),
          patch(asAdmin, c.id, { parentId: a.id }),
        ])

        expect(responses.map(outcomeOf).sort()).toEqual([
          '200',
          '200',
          '400 parentId:circular',
        ])
        const parents = await storedParents()
        expect(categoriesInLoops(parents)).toEqual([])
        expect(
          [parents[a.id], parents[b.id], parents[c.id]].filter(
            (parent) => parent === null,
          ),
        ).toHaveLength(1)
      }
    })

    it('never leaves a loop when a chain of categories is turned around at the same moment', async () => {
      const { cut, ladies, bob, shortBob } = await createTree()

      const responses = await Promise.all([
        patch(asAdmin, cut.id, { parentId: shortBob.id }),
        patch(asAdmin, ladies.id, { parentId: shortBob.id }),
        patch(asAdmin, bob.id, { parentId: null }),
        patch(asAdmin, shortBob.id, { parentId: null }),
      ])

      for (const response of responses) {
        expect(['200', '400 parentId:circular']).toContain(outcomeOf(response))
      }
      expect(categoriesInLoops(await storedParents())).toEqual([])
    })
  })

  describe('DELETE /api/v1/salons/:salonId/service-categories/:id', () => {
    it('removes the category: its subcategories become top-level, its services lose their category, and everything else stays as it is', async () => {
      const otherSalonId = await insertSalon(db)
      const cut = await createCategory({ name: 'Cut' })
      const ladies = await createCategory({ name: 'Ladies', parentId: cut.id })
      const bob = await createCategory({ name: 'Bob', parentId: ladies.id })
      const fringe = await createCategory({
        name: 'Fringe',
        parentId: ladies.id,
      })
      const shortBob = await createCategory({
        name: 'Short bob',
        parentId: bob.id,
      })
      const color = await createCategory({ name: 'Color' })
      const highlights = await createCategory({
        name: 'Highlights',
        parentId: color.id,
      })
      const elsewhere = await createCategory({ name: 'Cut' }, otherSalonId)
      const elsewhereBelow = await createCategory(
        { name: 'Ladies', parentId: elsewhere.id },
        otherSalonId,
      )
      const serviceOfLadies = await insertService(salonId, ladies.id)
      const anotherOfLadies = await insertService(salonId, ladies.id)
      const serviceOfBob = await insertService(salonId, bob.id)
      const serviceOfColor = await insertService(salonId, color.id)
      const serviceElsewhere = await insertService(otherSalonId, elsewhere.id)
      const categoriesBefore = await storedCategories()
      const servicesBefore = await storedServices()

      const response = await remove(asAdmin, ladies.id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(response.headers['content-type']).toBeUndefined()
      expect(await storedParents()).toEqual({
        [cut.id]: null,
        [bob.id]: null,
        [fringe.id]: null,
        [shortBob.id]: bob.id,
        [color.id]: null,
        [highlights.id]: color.id,
        [elsewhere.id]: null,
        [elsewhereBelow.id]: elsewhere.id,
      })
      const untouched = (id: string): boolean =>
        id !== ladies.id && id !== bob.id && id !== fringe.id
      expect(
        (await storedCategories()).filter(({ id }) => untouched(id)),
      ).toEqual(categoriesBefore.filter(({ id }) => untouched(id)))
      expect(await storedServices()).toEqual(
        servicesBefore.map((service) =>
          service.id === serviceOfLadies || service.id === anotherOfLadies
            ? { ...service, categoryId: null }
            : service,
        ),
      )
      expect(
        Object.fromEntries(
          (await storedServices()).map(({ id, categoryId }) => [
            id,
            categoryId,
          ]),
        ),
      ).toEqual({
        [serviceOfLadies]: null,
        [anotherOfLadies]: null,
        [serviceOfBob]: bob.id,
        [serviceOfColor]: color.id,
        [serviceElsewhere]: elsewhere.id,
      })
    })

    it('removes a category that has neither subcategories nor services', async () => {
      const created = await createCategory()
      const other = await createCategory({ name: 'Color' })

      const response = await remove(asAdmin, created.id)

      expect(response.status).toBe(204)
      expectProblem(await get(created.id), notFound)
      expect(idsOf(await list())).toEqual([other.id])
      expect(await db.$count(serviceCategories)).toBe(1)
    })

    it.each(malformedIds)(
      'rejects %s as the category ID and deletes nothing',
      async (_case, id) => {
        await createCategory()

        const response = await remove(asAdmin, id)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
        expect(await db.$count(serviceCategories)).toBe(1)
      },
    )

    it.each(malformedIds)(
      'rejects %s as the salon ID and deletes nothing',
      async (_case, salon) => {
        const created = await createCategory()

        const response = await remove(asAdmin, created.id, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect(await db.$count(serviceCategories)).toBe(1)
      },
    )

    it('reports an ID that no category has as not found and deletes nothing', async () => {
      await createCategory()

      const response = await remove(asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Service category ${UNKNOWN_ID} was not found`,
      )
      expect(await db.$count(serviceCategories)).toBe(1)
    })

    it('reports a category of another salon as not found, like an ID that no category has, and leaves it and what belongs to it untouched', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createCategory({ name: 'Cut' }, otherSalonId)
      await createCategory({ parentId: elsewhere.id }, otherSalonId)
      await insertService(otherSalonId, elsewhere.id)
      const categoriesBefore = await storedCategories()
      const servicesBefore = await storedServices()

      const response = await remove(asAdmin, elsewhere.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Service category ${elsewhere.id} was not found`,
      )
      expect(await storedCategories()).toEqual(categoriesBefore)
      expect(await storedServices()).toEqual(servicesBefore)
    })

    it('answers a second DELETE of the same category with 404', async () => {
      const created = await createCategory()

      const first = await remove(asAdmin, created.id)
      const second = await remove(asAdmin, created.id)

      expect(first.status).toBe(204)
      expectProblem(second, notFound)
    })

    it('reports a salon that does not exist as not found and deletes nothing', async () => {
      const created = await createCategory()

      const response = await remove(asAdmin, created.id, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect(await db.$count(serviceCategories)).toBe(1)
    })

    it('lets one of two DELETEs of the same category at the same moment succeed and answers the other with 404', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createCategory({ name: `Category ${round}` })
        await createCategory({ name: 'Below', parentId: created.id })

        const responses = await Promise.all([
          remove(asAdmin, created.id),
          remove(asAdmin, created.id),
        ])

        expect(responses.map(({ status }) => status).sort()).toEqual([204, 404])
        expect(await storedParents()).not.toHaveProperty(created.id)
      }
    })

    it('never leaves a new category below a parent that is deleted at the same moment: it is top-level, or refused because the parent is gone', async () => {
      const outcomes: string[] = []
      for (let round = 0; round < 8; round += 1) {
        const parent = await createCategory({ name: `Parent ${round}` })

        const [created, deleted] = await Promise.all([
          post(
            asAdmin,
            categoryRequest({ name: `Child ${round}`, parentId: parent.id }),
          ),
          remove(asAdmin, parent.id),
        ])

        outcomes.push(outcomeOf(created))
        expect(deleted.status).toBe(204)
        expect(['201', '400 parentId:not_found']).toContain(outcomeOf(created))
        const parents = await storedParents()
        expect(parents).not.toHaveProperty(parent.id)
        expect(Object.values(parents)).not.toContain(parent.id)
      }
      expect(Object.values(await storedParents())).toEqual(
        outcomes.filter((outcome) => outcome === '201').map(() => null),
      )
    })

    it('never leaves a category below a parent that is deleted while the category moves there: it is top-level, or refused because the parent is gone', async () => {
      for (let round = 0; round < 8; round += 1) {
        const parent = await createCategory({ name: `Parent ${round}` })
        const moving = await createCategory({ name: `Moving ${round}` })

        const [moved, deleted] = await Promise.all([
          patch(asAdmin, moving.id, { parentId: parent.id }),
          remove(asAdmin, parent.id),
        ])

        expect(deleted.status).toBe(204)
        expect(['200', '400 parentId:not_found']).toContain(outcomeOf(moved))
        const parents = await storedParents()
        expect(parents).not.toHaveProperty(parent.id)
        expect(parents[moving.id]).toBeNull()
      }
    })
  })

  describe('a salon that is deleted and still has its categories', () => {
    /** A deleted salon with two categories and a service, which are all still stored. */
    const deletedSalonWithCategories = async () => {
      const parent = await createCategory({ name: 'Cut' })
      const child = await createCategory({
        name: 'Ladies',
        parentId: parent.id,
      })
      await insertService(salonId, child.id)
      await deleteSalon(salonId)
      return { parent, child }
    }

    it('is not found by the list', async () => {
      await deletedSalonWithCategories()

      const response = await list()

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
    })

    it('is not found when one of its categories is asked for', async () => {
      const { child } = await deletedSalonWithCategories()

      const response = await get(child.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
    })

    it('is not found when a category is added to it, and nothing is stored', async () => {
      const { parent } = await deletedSalonWithCategories()
      const before = await storedCategories()

      const response = await post(
        asAdmin,
        categoryRequest({ parentId: parent.id }),
      )

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
      expect(await storedCategories()).toEqual(before)
    })

    it('is not found when one of its categories is changed, and nothing changes', async () => {
      const { child } = await deletedSalonWithCategories()
      const before = await storedCategories()

      const response = await patch(asAdmin, child.id, {
        name: 'Renamed',
        parentId: null,
      })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
      expect(await storedCategories()).toEqual(before)
    })

    it('is not found when one of its categories is deleted, and nothing is deleted', async () => {
      const { parent } = await deletedSalonWithCategories()
      const categoriesBefore = await storedCategories()
      const servicesBefore = await storedServices()

      const response = await remove(asAdmin, parent.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
      expect(await storedCategories()).toEqual(categoriesBefore)
      expect(await storedServices()).toEqual(servicesBefore)
    })

    it('is not found either when deletedAt was set in its row and not through the API', async () => {
      const created = await createCategory()
      await db
        .update(salons)
        .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
        .where(eq(salons.id, salonId))

      const responses = [
        await list(),
        await get(created.id),
        await post(asAdmin, categoryRequest()),
        await patch(asAdmin, created.id, { name: 'Renamed' }),
        await remove(asAdmin, created.id),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(await storedCategories()).toHaveLength(1)
    })
  })

  describe('the ID of a category written in upper case', () => {
    it('names the same category in the path, and the response writes it in lower case', async () => {
      const created = await createCategory()
      const inUpperCase = created.id.toUpperCase()
      const self = `${categoriesOf(salonId)}/${created.id}`

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
      expect(await storedCategories()).toEqual([])
    })

    it('names the same category as a parent, when a category is created and when one is moved', async () => {
      const parent = await createCategory()
      const other = await createCategory()
      const inUpperCase = parent.id.toUpperCase()

      const added = await post(
        asAdmin,
        categoryRequest({ parentId: inUpperCase }),
      )
      const moved = await patch(asAdmin, other.id, { parentId: inUpperCase })

      expect(added.status).toBe(201)
      expect(added.body.data.parentId).toBe(parent.id)
      expect(moved.status).toBe(200)
      expect(moved.body.data.parentId).toBe(parent.id)
    })

    it('names the same category as a cursor, and the page writes it in lower case', async () => {
      const first = await createCategory({ displayOrder: 1 })
      const second = await createCategory({ displayOrder: 2 })

      const page = await list(`cursor=${first.id.toUpperCase()}`)

      expect(page.status).toBe(200)
      expect(page.body.data).toEqual([second])
      expect(page.body.meta.cursor).toBe(first.id)
      expect(page.body.links.self).toBe(
        `${categoriesOf(salonId)}?cursor=${first.id}`,
      )
    })
  })

  describe('who may manage the service categories of a salon', () => {
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

    /** Who may add, change and delete the categories of the salon under test. */
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

    describe('POST /api/v1/salons/:salonId/service-categories', () => {
      it.each(unauthenticated)(
        'answers %s with 401 before looking at anything else, and stores nothing',
        async (_case, tokenOf, problem, challenge) => {
          const authorization = await tokenOf()

          const responses = [
            await post(authorization, categoryRequest()),
            await post(authorization, categoryRequest({ name: '' }), 'latest'),
            await post(authorization, categoryRequest(), UNKNOWN_ID),
          ]

          for (const response of responses) {
            expectProblem(response, problem)
            expect(response.headers['www-authenticate']).toBe(challenge)
          }
          expect(await db.$count(serviceCategories)).toBe(0)
        },
      )

      it.each(mayManage)(
        'lets %s add a category to the salon',
        async (_case, signInAs) => {
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await post(authorization, categoryRequest())

          expect(response.status).toBe(201)
          expect(response.body.data).toMatchObject({ salonId, name: 'カット' })
          expect((await get(response.body.data.id)).body.data).toEqual(
            response.body.data,
          )
        },
      )

      it.each(mayNotManage)(
        'forbids %s to add a category to the salon and stores nothing',
        async (_case, signInAs) => {
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await post(authorization, categoryRequest())

          expectProblem(response, forbidden)
          expect(await db.$count(serviceCategories)).toBe(0)
        },
      )

      it.each(mayNotManage)(
        'forbids %s before validating the body or looking for the salon or the parent',
        async (_case, signInAs) => {
          const authorization = await signInAs(salonId, await insertSalon(db))

          const responses = [
            await post(authorization, categoryRequest({ name: '' })),
            await post(authorization, { salonId }),
            await post(
              authorization,
              categoryRequest({ parentId: UNKNOWN_ID }),
            ),
            await post(authorization, categoryRequest(), UNKNOWN_ID),
          ]

          for (const response of responses) {
            expectProblem(response, forbidden)
          }
          expect(await db.$count(serviceCategories)).toBe(0)
        },
      )
    })

    describe('PATCH /api/v1/salons/:salonId/service-categories/:id', () => {
      it.each(unauthenticated)(
        'answers %s with 401 before looking at anything else, and changes nothing',
        async (_case, tokenOf, problem, challenge) => {
          const created = await createCategory()
          const authorization = await tokenOf()

          const responses = [
            await patch(authorization, created.id, { name: 'Renamed' }),
            await patch(authorization, 'latest', {}, 'latest'),
            await patch(authorization, UNKNOWN_ID, { name: 'Renamed' }),
          ]

          for (const response of responses) {
            expectProblem(response, problem)
            expect(response.headers['www-authenticate']).toBe(challenge)
          }
          expect((await get(created.id)).body.data).toEqual(created)
        },
      )

      it.each(mayManage)(
        'lets %s change a category of the salon',
        async (_case, signInAs) => {
          const created = await createCategory()
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
        'forbids %s to change a category of the salon and changes nothing',
        async (_case, signInAs) => {
          const created = await createCategory()
          const authorization = await signInAs(salonId, await insertSalon(db))
          const before = await storedCategories()

          const response = await patch(authorization, created.id, {
            name: 'Renamed',
          })

          expectProblem(response, forbidden)
          expect(await storedCategories()).toEqual(before)
        },
      )

      it.each(mayNotManage)(
        'forbids %s before looking at the category ID or the body, or for the salon, the category or the parent',
        async (_case, signInAs) => {
          const created = await createCategory()
          const authorization = await signInAs(salonId, await insertSalon(db))
          const before = await storedCategories()

          const responses = [
            await patch(authorization, 'latest', { name: 'Renamed' }),
            await patch(authorization, created.id, {}),
            await patch(authorization, created.id, { name: '' }),
            await patch(authorization, UNKNOWN_ID, { name: 'Renamed' }),
            await patch(authorization, created.id, { parentId: UNKNOWN_ID }),
            await patch(authorization, created.id, { parentId: created.id }),
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
          expect(await storedCategories()).toEqual(before)
        },
      )
    })

    describe('DELETE /api/v1/salons/:salonId/service-categories/:id', () => {
      it.each(unauthenticated)(
        'answers %s with 401 before looking at anything else, and deletes nothing',
        async (_case, tokenOf, problem, challenge) => {
          const created = await createCategory()
          const authorization = await tokenOf()

          const responses = [
            await remove(authorization, created.id),
            await remove(authorization, 'latest', 'latest'),
            await remove(authorization, UNKNOWN_ID),
          ]

          for (const response of responses) {
            expectProblem(response, problem)
            expect(response.headers['www-authenticate']).toBe(challenge)
          }
          expect(await db.$count(serviceCategories)).toBe(1)
        },
      )

      it.each(mayManage)(
        'lets %s delete a category of the salon',
        async (_case, signInAs) => {
          const created = await createCategory()
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await remove(authorization, created.id)

          expect(response.status).toBe(204)
          expect(await db.$count(serviceCategories)).toBe(0)
        },
      )

      it.each(mayNotManage)(
        'forbids %s to delete a category of the salon and deletes nothing',
        async (_case, signInAs) => {
          const created = await createCategory()
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await remove(authorization, created.id)

          expectProblem(response, forbidden)
          expect((await get(created.id)).body.data).toEqual(created)
        },
      )

      it.each(mayNotManage)(
        'forbids %s before looking at the category ID, or for the salon or the category',
        async (_case, signInAs) => {
          const created = await createCategory()
          const authorization = await signInAs(salonId, await insertSalon(db))

          const responses = [
            await remove(authorization, 'latest'),
            await remove(authorization, UNKNOWN_ID),
            await remove(authorization, created.id, UNKNOWN_ID),
          ]

          for (const response of responses) {
            expectProblem(response, forbidden)
          }
          expect(await db.$count(serviceCategories)).toBe(1)
        },
      )
    })

    it.each([...mayManage, ...mayNotManage])(
      'rejects a salon ID that is not a UUID from %s as invalid, whatever else is wrong',
      async (_case, signInAs) => {
        const created = await createCategory()
        const authorization = await signInAs(salonId, await insertSalon(db))

        const responses = [
          await post(authorization, categoryRequest({ name: '' }), 'latest'),
          await patch(authorization, 'latest', {}, 'latest'),
          await patch(authorization, created.id, { name: 'Renamed' }, '42'),
          await remove(authorization, 'latest', 'latest'),
          await remove(authorization, created.id, `${salonId}0`),
        ]

        for (const response of responses) {
          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        }
        expect((await get(created.id)).body.data).toEqual(created)
      },
    )

    it('lets the owner of a salon manage the categories of that salon only', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createCategory({}, otherSalonId)
      const owner = await member('owner')(salonId, otherSalonId)
      const before = await storedCategories()

      const inAnotherSalon = [
        await post(owner, categoryRequest(), otherSalonId),
        await patch(owner, elsewhere.id, { name: 'Renamed' }, otherSalonId),
        await remove(owner, elsewhere.id, otherSalonId),
      ]
      const inTheirSalon = await post(owner, categoryRequest())

      for (const response of inAnotherSalon) {
        expectProblem(response, forbidden)
      }
      expect(inTheirSalon.status).toBe(201)
      expect(
        (await storedCategories()).filter(
          ({ id }) => id !== inTheirSalon.body.data.id,
        ),
      ).toEqual(before)
    })

    it.each([
      ['the owner', member('owner')],
      ['a manager', member('manager')],
    ])(
      'lets %s of the salon manage its categories when the path writes the ID of the salon in upper case',
      async (_case, signInAs) => {
        const created = await createCategory()
        const authorization = await signInAs(salonId, salonId)
        const inUpperCase = salonId.toUpperCase()

        const responses = [
          await post(authorization, categoryRequest(), inUpperCase),
          await patch(
            authorization,
            created.id,
            { name: 'Renamed' },
            inUpperCase,
          ),
          await remove(authorization, created.id, inUpperCase),
        ]

        expect(responses.map(({ status }) => status)).toEqual([201, 200, 204])
      },
    )

    it('takes the ID of the salon in upper case for the same salon when an admin manages its categories and when anyone reads them', async () => {
      const created = await createCategory()
      const inUpperCase = salonId.toUpperCase()

      const listed = await list('', inUpperCase)
      const one = await get(created.id, inUpperCase)
      const added = await post(asAdmin, categoryRequest(), inUpperCase)
      const changed = await patch(
        asAdmin,
        created.id,
        { name: 'Renamed' },
        inUpperCase,
      )
      const removed = await remove(asAdmin, created.id, inUpperCase)

      expect(listed.status).toBe(200)
      expect(listed.body.data).toEqual([created])
      expect(one.status).toBe(200)
      expect(one.body.data).toEqual(created)
      expect(added.status).toBe(201)
      expect(added.body.data.salonId).toBe(salonId)
      expect(changed.status).toBe(200)
      expect(removed.status).toBe(204)
    })

    it.each(mayNotManage)(
      'lets %s read the categories of the salon like anyone',
      async (_case, signInAs) => {
        const created = await createCategory()
        const authorization = await signInAs(salonId, await insertSalon(db))

        const listed = await authorized(
          request(app).get(categoriesOf(salonId)),
          authorization,
        )
        const one = await authorized(
          request(app).get(`${categoriesOf(salonId)}/${created.id}`),
          authorization,
        )

        expect(listed.status).toBe(200)
        expect(listed.body.data).toEqual([created])
        expect(one.status).toBe(200)
        expect(one.body.data).toEqual(created)
      },
    )

    it('forbids the owner of a deleted salon to manage its categories, where an admin is told the salon is not found', async () => {
      const created = await createCategory()
      const owner = await member('owner')(salonId, salonId)
      await deleteSalon(salonId)

      const fromOwner = [
        await post(owner, categoryRequest()),
        await patch(owner, created.id, { name: 'Renamed' }),
        await remove(owner, created.id),
      ]
      const fromAdmin = [
        await post(asAdmin, categoryRequest()),
        await patch(asAdmin, created.id, { name: 'Renamed' }),
        await remove(asAdmin, created.id),
      ]

      for (const response of fromOwner) {
        expectProblem(response, forbidden)
      }
      for (const response of fromAdmin) {
        expectProblem(response, notFound)
      }
      expect(await storedCategories()).toHaveLength(1)
    })

    it('checks in order: the salon ID, the permission, the category ID, the body, the salon, the category', async () => {
      const staff = await member('staff')(salonId, salonId)

      const outcomes = [
        await patch(staff, 'latest', {}, 'latest'),
        await patch(staff, 'latest', {}, UNKNOWN_ID),
        await patch(asAdmin, 'latest', {}, UNKNOWN_ID),
        await patch(asAdmin, UNKNOWN_ID, {}, UNKNOWN_ID),
        await patch(asAdmin, UNKNOWN_ID, { name: 'Renamed' }, UNKNOWN_ID),
        await patch(asAdmin, UNKNOWN_ID, { name: 'Renamed' }),
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
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Service category ${UNKNOWN_ID} was not found`,
      ])
    })
  })

  describe('ServiceCategoryRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    /** The values of a new category: top-level, with nothing that may be unset. */
    const newCategory = (
      overrides: Partial<DbNewServiceCategory> = {},
    ): DbNewServiceCategory => ({
      name: 'カット',
      description: null,
      parentId: null,
      category: 'cut',
      displayOrder: 10,
      iconUrl: null,
      color: null,
      isActive: true,
      ...overrides,
    })

    const repository = () => new ServiceCategoryRepository(db)

    /** Stores a category through the repository and returns its row. */
    const stored = async (
      salon: string,
      overrides: Partial<DbNewServiceCategory> = {},
    ) => {
      const creation = dataOf(
        await repository().create(
          salonIdSchema.parse(salon),
          newCategory(overrides),
        ),
      )
      if (creation.type !== 'created') {
        throw new Error(`Expected a category, got ${creation.type}`)
      }
      return creation.category
    }

    describe('create', () => {
      it('stores the category in the salon it is given and returns the row', async () => {
        const values = newCategory({
          description: 'Cuts for every length',
          iconUrl: 'https://aoyama.example.com/icons/cut.svg',
          color: '#FF8800',
          isActive: false,
        })

        const creation = dataOf(
          await repository().create(salonIdSchema.parse(salonId), values),
        )

        expect(creation).toEqual({
          type: 'created',
          category: {
            ...values,
            id: expect.stringMatching(UUID),
            salonId,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        })
        expect(await storedCategories()).toEqual([
          creation.type === 'created' ? creation.category : null,
        ])
      })

      it('stores the category in the salon it is given, whatever salon the values name', async () => {
        const otherSalonId = await insertSalon(db)
        const wished = { ...newCategory(), salonId: otherSalonId }

        const creation = dataOf(
          await repository().create(salonIdSchema.parse(salonId), wished),
        )

        expect(creation).toMatchObject({
          type: 'created',
          category: { salonId },
        })
        expect((await storedCategories()).map((row) => row.salonId)).toEqual([
          salonId,
        ])
      })

      it('stores a category below a category of the same salon', async () => {
        const parent = await stored(salonId)

        const creation = dataOf(
          await repository().create(
            salonIdSchema.parse(salonId),
            newCategory({ parentId: parent.id }),
          ),
        )

        expect(creation).toMatchObject({
          type: 'created',
          category: { salonId, parentId: parent.id },
        })
      })

      it.each<[string, () => Promise<string>]>([
        ['a category that does not exist', async () => UNKNOWN_ID],
        [
          'a category of another salon',
          async () => (await stored(await insertSalon(db))).id,
        ],
      ])(
        'resolves to parentNotFound for %s as the parent and stores nothing',
        async (_case, parentIdOf) => {
          const parentId = await parentIdOf()
          const before = await storedCategories()

          const creation = dataOf(
            await repository().create(
              salonIdSchema.parse(salonId),
              newCategory({ parentId }),
            ),
          )

          expect(creation).toEqual({ type: 'parentNotFound' })
          expect(await storedCategories()).toEqual(before)
        },
      )
    })

    describe('findById', () => {
      it('finds a category of the salon', async () => {
        const category = await stored(salonId)

        const found = await repository().findById(
          salonIdSchema.parse(salonId),
          categoryIdSchema.parse(category.id),
        )

        expect(dataOf(found)).toEqual(category)
      })

      it('resolves to null for a category of another salon and for an ID that no category has', async () => {
        const otherSalonId = await insertSalon(db)
        const elsewhere = await stored(otherSalonId)
        await stored(salonId)

        const ofAnotherSalon = await repository().findById(
          salonIdSchema.parse(salonId),
          categoryIdSchema.parse(elsewhere.id),
        )
        const unknown = await repository().findById(
          salonIdSchema.parse(salonId),
          categoryIdSchema.parse(UNKNOWN_ID),
        )

        expect(dataOf(ofAnotherSalon)).toBeNull()
        expect(dataOf(unknown)).toBeNull()
      })
    })

    describe('list', () => {
      /** Four categories of the salon in the order of the menu, and one of another salon. */
      const storedMenu = async () => {
        const rows = [
          await stored(salonId, { name: 'Cut', displayOrder: 2 }),
          await stored(salonId, {
            name: 'Color',
            displayOrder: 1,
            isActive: false,
          }),
          await stored(salonId, { name: 'Perm', displayOrder: 2 }),
          await stored(salonId, { name: 'Spa', displayOrder: 0 }),
        ]
        await stored(await insertSalon(db), { name: 'Elsewhere' })
        return rows.toSorted(
          (left, right) =>
            left.displayOrder - right.displayOrder ||
            (left.id < right.id ? -1 : 1),
        )
      }

      it('lists the categories of the salon by display order and then by ID, with their number and whether more follow', async () => {
        const menu = await storedMenu()
        const criteria = {
          salonId: salonIdSchema.parse(salonId),
          limit: 3,
          isActive: null,
        }

        const first = await repository().list({ ...criteria, after: null })
        const second = await repository().list({
          ...criteria,
          after: categoryIdSchema.parse(menu[2]?.id),
        })

        expect(dataOf(first)).toEqual({
          categories: menu.slice(0, 3),
          total: 4,
          hasMore: true,
        })
        expect(dataOf(second)).toEqual({
          categories: menu.slice(3),
          total: 4,
          hasMore: false,
        })
      })

      it('says that nothing follows a page that the last categories fill exactly', async () => {
        const menu = await storedMenu()

        const page = await repository().list({
          salonId: salonIdSchema.parse(salonId),
          limit: 2,
          after: categoryIdSchema.parse(menu[1]?.id),
          isActive: null,
        })

        expect(dataOf(page)).toEqual({
          categories: menu.slice(2),
          total: 4,
          hasMore: false,
        })
      })

      it.each([true, false])(
        'lists and counts only the categories with isActive %s when told to',
        async (isActive) => {
          const menu = await storedMenu()
          const expected = menu.filter((row) => row.isActive === isActive)

          const page = await repository().list({
            salonId: salonIdSchema.parse(salonId),
            limit: 10,
            after: null,
            isActive,
          })

          expect(dataOf(page)).toEqual({
            categories: expected,
            total: expected.length,
            hasMore: false,
          })
        },
      )

      it('resolves to an empty list for a salon without categories', async () => {
        await stored(await insertSalon(db))

        const page = await repository().list({
          salonId: salonIdSchema.parse(salonId),
          limit: 10,
          after: null,
          isActive: null,
        })

        expect(dataOf(page)).toEqual({
          categories: [],
          total: 0,
          hasMore: false,
        })
      })

      it('resolves to null for a cursor that names no category of the salon', async () => {
        await storedMenu()
        const elsewhere = await stored(await insertSalon(db))

        const pages = await Promise.all(
          [UNKNOWN_ID, elsewhere.id].map((cursor) =>
            repository().list({
              salonId: salonIdSchema.parse(salonId),
              limit: 10,
              after: categoryIdSchema.parse(cursor),
              isActive: null,
            }),
          ),
        )

        expect(pages.map(dataOf)).toEqual([null, null])
      })
    })

    describe('update', () => {
      it('changes the given columns of the category, moves updatedAt and returns the row', async () => {
        const category = await stored(salonId)
        const other = await stored(salonId, { name: 'Color' })

        const update = dataOf(
          await repository().update(
            salonIdSchema.parse(salonId),
            categoryIdSchema.parse(category.id),
            { name: 'Renamed', color: '#00ff00' },
          ),
        )

        if (update.type !== 'updated') {
          throw new Error(`Expected an updated category, got ${update.type}`)
        }
        expect(update.category).toEqual({
          ...category,
          name: 'Renamed',
          color: '#00ff00',
          updatedAt: expect.any(String),
        })
        const rows = await storedCategories()
        expect(rows).toHaveLength(2)
        expect(rows).toEqual(expect.arrayContaining([update.category, other]))
        expect(await hasMoved(category.id)).toBe(true)
        expect(await hasMoved(other.id)).toBe(false)
      })

      it.each<[string, Partial<DbNewServiceCategory>]>([
        ['a change without parentId', { name: 'Renamed' }],
        ['a change with parentId null', { parentId: null }],
      ])(
        'applies %s to the only category of a salon',
        async (_case, changes) => {
          const category = await stored(salonId)

          const update = dataOf(
            await repository().update(
              salonIdSchema.parse(salonId),
              categoryIdSchema.parse(category.id),
              changes,
            ),
          )

          expect(update).toMatchObject({
            type: 'updated',
            category: { id: category.id, parentId: null, ...changes },
          })
        },
      )

      it('moves a subcategory to the top level with parentId null and below another category with its ID', async () => {
        const parent = await stored(salonId, { name: 'Cut' })
        const other = await stored(salonId, { name: 'Color' })
        const child = await stored(salonId, { parentId: parent.id })
        const ids = {
          salon: salonIdSchema.parse(salonId),
          child: categoryIdSchema.parse(child.id),
        }

        const toTheTop = dataOf(
          await repository().update(ids.salon, ids.child, { parentId: null }),
        )
        const below = dataOf(
          await repository().update(ids.salon, ids.child, {
            parentId: other.id,
          }),
        )

        expect(toTheTop).toMatchObject({
          type: 'updated',
          category: { parentId: null },
        })
        expect(below).toMatchObject({
          type: 'updated',
          category: { parentId: other.id },
        })
        expect(await storedParents()).toEqual({
          [parent.id]: null,
          [other.id]: null,
          [child.id]: other.id,
        })
      })

      it.each<[string, Partial<DbNewServiceCategory>]>([
        ['a change without parentId', { name: 'Renamed' }],
        ['a change with parentId null', { parentId: null }],
      ])(
        'resolves to notFound for %s of a category of another salon or of an ID that no category has, and changes nothing',
        async (_case, changes) => {
          const elsewhere = await stored(await insertSalon(db))
          const before = await storedCategories()

          const updates = [
            await repository().update(
              salonIdSchema.parse(salonId),
              categoryIdSchema.parse(elsewhere.id),
              changes,
            ),
            await repository().update(
              salonIdSchema.parse(salonId),
              categoryIdSchema.parse(UNKNOWN_ID),
              changes,
            ),
          ]

          expect(updates.map(dataOf)).toEqual([
            { type: 'notFound' },
            { type: 'notFound' },
          ])
          expect(await storedCategories()).toEqual(before)
        },
      )

      it('resolves to notFound for a move of a category of another salon below a category of the salon, and changes nothing', async () => {
        const here = await stored(salonId)
        const elsewhere = await stored(await insertSalon(db))
        const before = await storedCategories()

        const update = await repository().update(
          salonIdSchema.parse(salonId),
          categoryIdSchema.parse(elsewhere.id),
          { parentId: here.id },
        )

        expect(dataOf(update)).toEqual({ type: 'notFound' })
        expect(await storedCategories()).toEqual(before)
      })

      it.each<[string, () => Promise<string>]>([
        ['a category that does not exist', async () => UNKNOWN_ID],
        [
          'a category of another salon',
          async () => (await stored(await insertSalon(db))).id,
        ],
      ])(
        'resolves to parentNotFound for %s as the parent and changes nothing, also not the other columns',
        async (_case, parentIdOf) => {
          const category = await stored(salonId)
          const parentId = await parentIdOf()
          const before = await storedCategories()

          const update = await repository().update(
            salonIdSchema.parse(salonId),
            categoryIdSchema.parse(category.id),
            { name: 'Renamed', parentId },
          )

          expect(dataOf(update)).toEqual({ type: 'parentNotFound' })
          expect(await storedCategories()).toEqual(before)
        },
      )

      it('resolves to parentWithinSubtree for the category itself and for a category below it, and changes nothing, also not the other columns', async () => {
        const top = await stored(salonId, { name: 'Cut' })
        const middle = await stored(salonId, { parentId: top.id })
        const bottom = await stored(salonId, { parentId: middle.id })
        const before = await storedCategories()

        const updates = []
        for (const parentId of [top.id, middle.id, bottom.id]) {
          updates.push(
            await repository().update(
              salonIdSchema.parse(salonId),
              categoryIdSchema.parse(top.id),
              { name: 'Renamed', parentId },
            ),
          )
        }

        expect(updates.map(dataOf)).toEqual([
          { type: 'parentWithinSubtree' },
          { type: 'parentWithinSubtree' },
          { type: 'parentWithinSubtree' },
        ])
        expect(await storedCategories()).toEqual(before)
      })
    })

    describe('delete', () => {
      it('removes the category of the salon and resolves to true', async () => {
        const category = await stored(salonId)
        const other = await stored(salonId, { name: 'Color' })

        const deleted = await repository().delete(
          salonIdSchema.parse(salonId),
          categoryIdSchema.parse(category.id),
        )

        expect(dataOf(deleted)).toBe(true)
        expect(await storedCategories()).toEqual([other])
      })

      it('resolves to false when the salon has no such category, and the second time', async () => {
        const category = await stored(salonId)
        const salon = salonIdSchema.parse(salonId)
        const id = categoryIdSchema.parse(category.id)

        const unknown = await repository().delete(
          salon,
          categoryIdSchema.parse(UNKNOWN_ID),
        )
        const first = await repository().delete(salon, id)
        const second = await repository().delete(salon, id)

        expect(dataOf(unknown)).toBe(false)
        expect(dataOf(first)).toBe(true)
        expect(dataOf(second)).toBe(false)
      })

      it('deletes nothing of another salon when the IDs are mixed up', async () => {
        const otherSalonId = await insertSalon(db)
        const here = await stored(salonId)
        const elsewhere = await stored(otherSalonId)
        await stored(otherSalonId, { parentId: elsewhere.id })
        await insertService(otherSalonId, elsewhere.id)
        const categoriesBefore = await storedCategories()
        const servicesBefore = await storedServices()

        const deletions = [
          await repository().delete(
            salonIdSchema.parse(salonId),
            categoryIdSchema.parse(elsewhere.id),
          ),
          await repository().delete(
            salonIdSchema.parse(otherSalonId),
            categoryIdSchema.parse(here.id),
          ),
        ]

        expect(deletions.map(dataOf)).toEqual([false, false])
        expect(await storedCategories()).toEqual(categoriesBefore)
        expect(await storedServices()).toEqual(servicesBefore)
      })
    })
  })

  describe('SalonRepository.exists', () => {
    const exists = async (id: string): Promise<boolean> => {
      const result = await new SalonRepository(db).exists(
        salonIdSchema.parse(id),
      )
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    it('is true for a salon that is stored and not deleted, active or not', async () => {
      const inactive = await insertSalon(db, { isActive: false })

      expect(await exists(salonId)).toBe(true)
      expect(await exists(inactive)).toBe(true)
    })

    it('is false for an ID that no salon has', async () => {
      expect(await exists(UNKNOWN_ID)).toBe(false)
    })

    it('is false for a deleted salon and still true for the other salons', async () => {
      const deleted = await insertSalon(db, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      })

      expect(await exists(deleted)).toBe(false)
      expect(await exists(salonId)).toBe(true)
    })

    it('is false once the salon was deleted through the API', async () => {
      await deleteSalon(salonId)

      expect(await exists(salonId)).toBe(false)
    })
  })
})
