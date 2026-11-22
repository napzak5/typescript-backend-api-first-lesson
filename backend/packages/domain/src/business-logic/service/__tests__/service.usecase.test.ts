import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  CATEGORY_ID,
  OTHER_CATEGORY_ID,
} from '../../../__tests__/fixtures/service-category-fixtures'
import {
  dbService,
  dbServiceOption,
  nthServiceId,
  OTHER_SERVICE_ID,
  SERVICE_ID,
  serviceCreateRequest,
  serviceDependencies,
  serviceOptionRequest,
  THIRD_SERVICE_ID,
} from '../../../__tests__/fixtures/service-fixtures'
import type { Actor } from '../../../models/auth'
import { serviceIdSchema } from '../../../models/service'
import type {
  IServiceRepository,
  ServiceBulkUpdate,
  ServiceChangeRefusal,
  ServiceCreation,
  ServiceDeletion,
  ServiceUpdate,
} from '../../../repositories/service.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  BulkUpdateServicesUseCase,
  CreateServiceUseCase,
  DeleteServiceUseCase,
  GetServiceUseCase,
  ListServicesUseCase,
  type ServiceUseCaseDependencies,
  UpdateServiceUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const salonNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
}
const serviceNotFound = (id: string) => ({
  type: 'error',
  error: expect.objectContaining({ type: 'notFound', id }),
})
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

/** The option of the fixtures as the API presents it. */
const apiOption = {
  name: 'トリートメント',
  description: null,
  optionType: 'addon',
  additionalTime: 15,
  additionalPrice: 1100,
  maxQuantity: 1,
  isRequired: false,
  sortOrder: 1,
  isActive: true,
}

/** The service of the fixtures, with its option, as the API presents it. */
const apiService = {
  id: SERVICE_ID,
  salonId: SALON_ID,
  categoryId: CATEGORY_ID,
  name: 'カット＆ブロー',
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
  sortOrder: 10,
  serviceStatus: 'active',
  availability: 'always',
  isActive: true,
  options: [apiOption],
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
}

/** A row whose timestamp cannot be read: it cannot be turned into a response. */
const corruptService = {
  service: dbService({ updatedAt: 'yesterday' }),
  options: [dbServiceOption()],
}

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/**
 * The methods of the two repositories that were called, in the order of the
 * calls: `salons.exists`, `services.create`, …
 */
const repositoryCalls = ({
  salonRepository,
  serviceRepository,
}: ServiceUseCaseDependencies): string[] =>
  [
    ...Object.entries(salonRepository).map(([name, method]) => ({
      name: `salons.${name}`,
      orders: callOrdersOf(method),
    })),
    ...Object.entries(serviceRepository).map(([name, method]) => ({
      name: `services.${name}`,
      orders: callOrdersOf(method),
    })),
  ]
    .flatMap(({ name, orders }) => orders.map((order) => ({ name, order })))
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** Dependencies in which there is no such salon. */
const withoutSalon = (
  services: Partial<IServiceRepository> = {},
): ServiceUseCaseDependencies =>
  serviceDependencies(services, {
    exists: vi.fn(async () => Result.success(false)),
  })

/** Dependencies in which looking for the salon fails. */
const withFailingSalonLookup = (): ServiceUseCaseDependencies =>
  serviceDependencies({}, { exists: vi.fn(async () => databaseDown) })

/** Salon and service IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['an empty ID', ''],
  ['a UUID with a character too many', `${SALON_ID}0`],
  ['a UUID with a space in front', ` ${SALON_ID}`],
  ['a UUID without its hyphens', SALON_ID.replaceAll('-', '')],
]

const creating = (outcome: ServiceCreation): Partial<IServiceRepository> => ({
  create: vi.fn(async () => Result.success(outcome)),
})

const updating = (outcome: ServiceUpdate): Partial<IServiceRepository> => ({
  update: vi.fn(async () => Result.success(outcome)),
})

const updatingMany = (
  outcome: ServiceBulkUpdate,
): Partial<IServiceRepository> => ({
  updateMany: vi.fn(async () => Result.success(outcome)),
})

const deleting = (outcome: ServiceDeletion): Partial<IServiceRepository> => ({
  delete: vi.fn(async () => Result.success(outcome)),
})

/** A request of a package of the two other services, in that order. */
const packageRequest = () => ({
  ...serviceCreateRequest(),
  isPackage: true,
  packageServiceIds: [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
})

/**
 * Why the stored services refuse a change, and the rules a client is told
 * are broken, relative to the service.
 */
const changeRefusals: [string, ServiceChangeRefusal, string[]][] = [
  [
    'a rule that ties properties together, which the service as it would be stored breaks',
    {
      type: 'invalid',
      issues: [
        {
          field: 'discountPrice',
          rule: 'too_big',
          message: 'Must not be greater than the price',
        },
      ],
    },
    ['discountPrice:too_big'],
  ],
  [
    'several such rules',
    {
      type: 'invalid',
      issues: [
        {
          field: 'discountPrice',
          rule: 'too_big',
          message: 'Must not be greater than the price',
        },
        {
          field: 'packageServiceIds',
          rule: 'too_small',
          message: 'A package must name at least 2 services',
        },
      ],
    },
    ['discountPrice:too_big', 'packageServiceIds:too_small'],
  ],
  [
    'members on a service that is not a package',
    {
      type: 'invalid',
      issues: [
        {
          field: 'packageServiceIds',
          rule: 'not_allowed',
          message: 'Must be empty unless the service is a package',
        },
      ],
    },
    ['packageServiceIds:not_allowed'],
  ],
  [
    'a category that is no category of the salon',
    { type: 'categoryNotFound' },
    ['categoryId:not_found'],
  ],
  [
    'a member that is no service of the salon, or a deleted one',
    { type: 'packageMemberNotFound' },
    ['packageServiceIds:not_found'],
  ],
  [
    'a member that is a package',
    { type: 'packageMemberIsPackage' },
    ['packageServiceIds:nested_package'],
  ],
  [
    'a service that a package contains becoming a package',
    { type: 'containedInPackage' },
    ['isPackage:contained_in_package'],
  ],
]

describe('CreateServiceUseCase', () => {
  const create = (
    dependencies: ServiceUseCaseDependencies,
    input: unknown,
    salon: unknown = SALON_ID,
  ) =>
    new CreateServiceUseCase(dependencies).execute(actors.admin, salon, input)

  it('stores the service and its options apart in the salon of the path, once the salon is known to exist, and returns the stored service with its options as the API presents it', async () => {
    const dependencies = serviceDependencies()
    const { options, ...service } = serviceCreateRequest()

    const result = await create(dependencies, serviceCreateRequest())

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      service,
      options,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'services.create',
    ])
    expect(result).toEqual({ type: 'success', data: apiService })
  })

  it('hands null on as null for the properties that may be unset, and no options as none', async () => {
    const dependencies = serviceDependencies()
    const unset = {
      categoryId: null,
      description: null,
      shortDescription: null,
      discountPrice: null,
      imageUrl: null,
      requiredStaffLevel: null,
      maxBookingsPerDay: null,
    }
    const { options: _options, ...service } = serviceCreateRequest()

    await create(dependencies, {
      ...serviceCreateRequest(),
      ...unset,
      options: [],
    })

    expect(dependencies.serviceRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      { ...service, ...unset },
      [],
    )
  })

  it('hands the members of a package on in the order of the request, and every option in its order', async () => {
    const dependencies = serviceDependencies()
    const options = [
      { ...serviceOptionRequest(), name: 'Second', sortOrder: 2 },
      { ...serviceOptionRequest(), name: 'First', sortOrder: 1 },
    ]

    await create(dependencies, { ...packageRequest(), options })

    expect(dependencies.serviceRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      expect.objectContaining({
        isPackage: true,
        packageServiceIds: [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
      }),
      options,
    )
  })

  it('hands the IDs on in lower case when the request writes the salon, the category and the members of a package in upper case', async () => {
    const dependencies = serviceDependencies()

    const result = await create(
      dependencies,
      {
        ...packageRequest(),
        categoryId: CATEGORY_ID.toUpperCase(),
        packageServiceIds: [
          THIRD_SERVICE_ID.toUpperCase(),
          OTHER_SERVICE_ID.toUpperCase(),
        ],
      },
      SALON_ID.toUpperCase(),
    )

    expect(result.type).toBe('success')
    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      expect.objectContaining({
        categoryId: CATEGORY_ID,
        packageServiceIds: [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
      }),
      [serviceOptionRequest()],
    )
  })

  it('stores the service in the salon of the path, whichever salon that is', async () => {
    const dependencies = serviceDependencies()

    await create(dependencies, serviceCreateRequest(), OTHER_SALON_ID)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(
      OTHER_SALON_ID,
    )
    expect(dependencies.serviceRepository.create).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      expect.objectContaining({ name: 'カット＆ブロー' }),
      [serviceOptionRequest()],
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading or writing anything',
    async (_case, salon) => {
      const dependencies = serviceDependencies()

      const result = await create(dependencies, serviceCreateRequest(), salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a blank name', { name: ' ' }, ['name:invalid_format']],
    ['a duration of 0', { duration: 0 }, ['duration:too_small']],
    [
      'a category that is not an ID',
      { categoryId: 'cut' },
      ['categoryId:invalid_format'],
    ],
    [
      'a salon in the body',
      { salonId: OTHER_SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'the products a service needs, which no request writes',
      { requiredProducts: [] },
      ['requiredProducts:unrecognized_keys'],
    ],
    [
      'an option with an ID',
      { options: [{ ...serviceOptionRequest(), id: SERVICE_ID }] },
      ['options.0.id:unrecognized_keys'],
    ],
    [
      'several broken rules',
      { price: -1, pricingStrategy: 'free', isActive: 'yes' },
      [
        'price:too_small',
        'pricingStrategy:invalid_value',
        'isActive:invalid_type',
      ],
    ],
  ])(
    'rejects %s without looking the salon up or storing anything',
    async (_case, change, expected) => {
      const dependencies = serviceDependencies()

      const result = await create(dependencies, {
        ...serviceCreateRequest(),
        ...change,
      })

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a body that is not an object', 'name=Cut'],
    ['a list of requests', [serviceCreateRequest()]],
    ['a missing body', undefined],
  ])('rejects %s', async (_case, input) => {
    const dependencies = serviceDependencies()

    const result = await create(dependencies, input)

    expect(rulesOf(result)).toEqual([':invalid_type'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each([
    [
      'a discount above the price',
      { price: 6600, discountPrice: 6601 },
      ['discountPrice:too_big'],
    ],
    [
      'a package of one service',
      { isPackage: true, packageServiceIds: [OTHER_SERVICE_ID] },
      ['packageServiceIds:too_small'],
    ],
    [
      'a package of no service',
      { isPackage: true, packageServiceIds: [] },
      ['packageServiceIds:too_small'],
    ],
    [
      'members of a service that is not a package',
      {
        isPackage: false,
        packageServiceIds: [OTHER_SERVICE_ID, THIRD_SERVICE_ID],
      },
      ['packageServiceIds:not_allowed'],
    ],
    [
      'a discount above the price on a package of one service',
      {
        price: 1000,
        discountPrice: 2000,
        isPackage: true,
        packageServiceIds: [OTHER_SERVICE_ID],
      },
      ['discountPrice:too_big', 'packageServiceIds:too_small'],
    ],
  ])(
    'refuses %s without looking the salon up or storing anything',
    async (_case, change, expected) => {
      const dependencies = withoutSalon()

      const result = await create(dependencies, {
        ...serviceCreateRequest(),
        ...change,
      })

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a discount equal to the price', { price: 6600, discountPrice: 6600 }],
    ['a discount of 0', { price: 6600, discountPrice: 0 }],
    ['a free service without a discount', { price: 0, discountPrice: null }],
    ['a package of two services', packageRequest()],
    [
      'a package of 20 services',
      {
        isPackage: true,
        packageServiceIds: Array.from({ length: 20 }, (_, index) =>
          nthServiceId(index),
        ),
      },
    ],
  ])('accepts %s and stores it', async (_case, change) => {
    const dependencies = serviceDependencies()

    const result = await create(dependencies, {
      ...serviceCreateRequest(),
      ...change,
    })

    expect(result.type).toBe('success')
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'services.create',
    ])
  })

  it('reports a salon that does not exist, or is deleted, as not found and stores nothing', async () => {
    const dependencies = withoutSalon()

    const result = await create(dependencies, serviceCreateRequest())

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon and stores nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await create(dependencies, serviceCreateRequest())

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it.each<[string, ServiceCreation, string[]]>([
    [
      'a category that is no category of the salon',
      { type: 'categoryNotFound' },
      ['categoryId:not_found'],
    ],
    [
      'a member that is no service of the salon, or a deleted one',
      { type: 'packageMemberNotFound' },
      ['packageServiceIds:not_found'],
    ],
    [
      'a member that is a package',
      { type: 'packageMemberIsPackage' },
      ['packageServiceIds:nested_package'],
    ],
  ])(
    'refuses %s, as the repository finds it, as a broken rule',
    async (_case, outcome, expected) => {
      const dependencies = serviceDependencies(creating(outcome))

      const result = await create(dependencies, packageRequest())

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(expected)
    },
  )

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceDependencies({
      create: vi.fn(async () => databaseDown),
    })

    const result = await create(dependencies, serviceCreateRequest())

    expect(result).toEqual(databaseDown)
  })

  it('reports a stored service that cannot be presented as a database error', async () => {
    const dependencies = serviceDependencies(
      creating({ type: 'created', service: corruptService }),
    )

    const result = await create(dependencies, serviceCreateRequest())

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('GetServiceUseCase', () => {
  const get = (
    dependencies: ServiceUseCaseDependencies,
    id: unknown = SERVICE_ID,
    salon: unknown = SALON_ID,
  ) => new GetServiceUseCase(dependencies).execute(salon, id)

  it('returns the service of the salon with its options as the API presents it, to anyone: reading needs no actor', async () => {
    const dependencies = serviceDependencies()

    const result = await get(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.findById).toHaveBeenCalledWith(
      SALON_ID,
      SERVICE_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'services.findById',
    ])
    expect(result).toEqual({ type: 'success', data: apiService })
  })

  it('looks for the service in the salon of the path only', async () => {
    const dependencies = serviceDependencies()

    await get(dependencies, SERVICE_ID, OTHER_SALON_ID)

    expect(dependencies.serviceRepository.findById).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      SERVICE_ID,
    )
  })

  it('looks the IDs up in lower case when the path writes them in upper case', async () => {
    const dependencies = serviceDependencies()

    const result = await get(
      dependencies,
      SERVICE_ID.toUpperCase(),
      SALON_ID.toUpperCase(),
    )

    expect(result).toEqual({ type: 'success', data: apiService })
    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.findById).toHaveBeenCalledWith(
      SALON_ID,
      SERVICE_ID,
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading anything',
    async (_case, salon) => {
      const dependencies = serviceDependencies()

      const result = await get(dependencies, SERVICE_ID, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([...malformedIds, ['the word bulk', 'bulk']])(
    'rejects %s as the service ID without reading anything',
    async (_case, id) => {
      const dependencies = serviceDependencies()

      const result = await get(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found without looking for the service', async () => {
    const dependencies = withoutSalon()

    const result = await get(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('reports a service the salon does not have, or no longer has, as not found with its ID', async () => {
    const dependencies = serviceDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await get(dependencies, OTHER_SERVICE_ID.toUpperCase())

    expect(result).toEqual(serviceNotFound(OTHER_SERVICE_ID))
  })

  it('passes on a failure to look for the salon', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await get(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    const result = await get(dependencies)

    expect(result).toEqual(databaseDown)
  })

  it('reports a stored service that cannot be presented as a database error', async () => {
    const dependencies = serviceDependencies({
      findById: vi.fn(async () => Result.success(corruptService)),
    })

    const result = await get(dependencies)

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('ListServicesUseCase', () => {
  const list = (
    dependencies: ServiceUseCaseDependencies,
    input: unknown = {},
    salon: unknown = SALON_ID,
  ) => new ListServicesUseCase(dependencies).execute(salon, input)

  const listing = (
    services = [{ service: dbService(), options: [dbServiceOption()] }],
    total = services.length,
    hasMore = false,
  ): Partial<IServiceRepository> => ({
    list: vi.fn(async () => Result.success({ services, total, hasMore })),
  })

  it('lists the first 20 services of the salon, of any category, active or not, by default, to anyone: reading needs no actor', async () => {
    const dependencies = serviceDependencies()

    const result = await list(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      categoryId: null,
      isActive: null,
    })
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'services.list',
    ])
    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiService],
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it.each([true, false])(
    'asks for a page of the given size of one category after the service the cursor names, with isActive %s',
    async (isActive) => {
      const dependencies = serviceDependencies()

      await list(
        dependencies,
        {
          limit: 5,
          cursor: OTHER_SERVICE_ID,
          categoryId: OTHER_CATEGORY_ID,
          isActive,
        },
        OTHER_SALON_ID,
      )

      expect(dependencies.serviceRepository.list).toHaveBeenCalledWith({
        salonId: OTHER_SALON_ID,
        limit: 5,
        after: OTHER_SERVICE_ID,
        categoryId: OTHER_CATEGORY_ID,
        isActive,
      })
    },
  )

  it('hands the salon, the cursor and the category on in lower case when they are written in upper case, and repeats the cursor in lower case', async () => {
    const dependencies = serviceDependencies()

    const result = await list(
      dependencies,
      {
        cursor: OTHER_SERVICE_ID.toUpperCase(),
        categoryId: CATEGORY_ID.toUpperCase(),
      },
      SALON_ID.toUpperCase(),
    )

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 20,
      after: OTHER_SERVICE_ID,
      categoryId: CATEGORY_ID,
      isActive: null,
    })
    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { cursor: OTHER_SERVICE_ID } },
    })
  })

  it('returns the services in the order of the repository, each with its own options, and names the last one as the next cursor when more follow', async () => {
    const dependencies = serviceDependencies(
      listing(
        [
          {
            service: dbService({ id: OTHER_SERVICE_ID, sortOrder: 1 }),
            options: [],
          },
          {
            service: dbService({ sortOrder: 2 }),
            options: [
              dbServiceOption({ name: 'First', sortOrder: 1 }),
              dbServiceOption({ name: 'Second', sortOrder: 2 }),
            ],
          },
        ],
        7,
        true,
      ),
    )

    const result = await list(dependencies, {
      limit: 2,
      cursor: THIRD_SERVICE_ID,
    })

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [
          { ...apiService, id: OTHER_SERVICE_ID, sortOrder: 1, options: [] },
          {
            ...apiService,
            sortOrder: 2,
            options: [
              { ...apiOption, name: 'First', sortOrder: 1 },
              { ...apiOption, name: 'Second', sortOrder: 2 },
            ],
          },
        ],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: THIRD_SERVICE_ID,
          nextCursor: SERVICE_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor for the last page, and repeats the cursor of the request', async () => {
    const dependencies = serviceDependencies(listing(undefined, 3))

    const result = await list(dependencies, { cursor: OTHER_SERVICE_ID })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 3,
          hasMore: false,
          cursor: OTHER_SERVICE_ID,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('returns an empty page when the salon has no service that matches', async () => {
    const dependencies = serviceDependencies(listing([]))

    const result = await list(dependencies, { categoryId: OTHER_CATEGORY_ID })

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [],
        meta: {
          total: 0,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('refuses a cursor that the repository finds to name no service of the salon as a broken rule of the cursor', async () => {
    const dependencies = serviceDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, { cursor: OTHER_SERVICE_ID })

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(rulesOf(result)).toEqual(['cursor:not_found'])
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading anything',
    async (_case, salon) => {
      const dependencies = serviceDependencies()

      const result = await list(dependencies, {}, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    [
      'a limit that is not a whole number',
      { limit: 1.5 },
      ['limit:invalid_type'],
    ],
    [
      'a cursor that is not an ID',
      { cursor: 'page-2' },
      ['cursor:invalid_format'],
    ],
    [
      'a category that is not an ID',
      { categoryId: 'cut' },
      ['categoryId:invalid_format'],
    ],
    [
      'the salon as a parameter of the search',
      { salonId: OTHER_SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'several broken rules',
      { limit: 1000, sort: 'name' },
      ['limit:too_big', 'sort:unrecognized_keys'],
    ],
  ])('rejects %s without reading anything', async (_case, input, expected) => {
    const dependencies = serviceDependencies()

    const result = await list(dependencies, input)

    expect(rulesOf(result)).toEqual(expected)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a salon that does not exist, or is deleted, as not found without listing anything', async () => {
    const dependencies = withoutSalon()

    const result = await list(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await list(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceDependencies({
      list: vi.fn(async () => databaseDown),
    })

    const result = await list(dependencies)

    expect(result).toEqual(databaseDown)
  })

  it('reports a page with a stored service that cannot be presented as a database error', async () => {
    const dependencies = serviceDependencies(
      listing([
        { service: dbService(), options: [] },
        {
          service: dbService({ id: OTHER_SERVICE_ID, createdAt: 'yesterday' }),
          options: [],
        },
      ]),
    )

    const result = await list(dependencies)

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateServiceUseCase', () => {
  const update = (
    dependencies: ServiceUseCaseDependencies,
    input: unknown,
    id: unknown = SERVICE_ID,
    salon: unknown = SALON_ID,
  ) =>
    new UpdateServiceUseCase(dependencies).execute(
      actors.admin,
      salon,
      id,
      input,
    )

  it('hands only the properties of the request to the repository and keeps the options, once the salon is known to exist, and returns the service as it is afterwards', async () => {
    const dependencies = serviceDependencies()

    const result = await update(dependencies, {
      name: 'Renamed',
      discountPrice: null,
    })

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      SERVICE_ID,
      { name: 'Renamed', discountPrice: null },
      { type: 'keep' },
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'services.update',
    ])
    expect(result).toEqual({ type: 'success', data: apiService })
  })

  it.each([
    [
      'new options',
      [
        serviceOptionRequest(),
        { ...serviceOptionRequest(), name: 'Head spa', sortOrder: 0 },
      ],
    ],
    ['no options, which removes them', []],
  ])(
    'replaces the options with %s when the request has options alone',
    async (_case, options) => {
      const dependencies = serviceDependencies()

      const result = await update(dependencies, { options })

      expect(result.type).toBe('success')
      expect(dependencies.serviceRepository.update).toHaveBeenCalledWith(
        SALON_ID,
        SERVICE_ID,
        {},
        { type: 'replace', options },
      )
    },
  )

  it('hands every property on when the request names them all, the options apart', async () => {
    const dependencies = serviceDependencies()
    const { options, ...changes } = serviceCreateRequest()

    const result = await update(dependencies, serviceCreateRequest())

    expect(result.type).toBe('success')
    expect(dependencies.serviceRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      SERVICE_ID,
      changes,
      { type: 'replace', options },
    )
  })

  it.each([
    ['no category', { categoryId: null }],
    ['another category', { categoryId: OTHER_CATEGORY_ID }],
    ['isPackage alone', { isPackage: true }],
    ['members alone', { packageServiceIds: [OTHER_SERVICE_ID] }],
    ['a discount alone', { discountPrice: 100_000 }],
    ['a price alone', { price: 0 }],
    ['the end of a package', { isPackage: false, packageServiceIds: [] }],
  ])(
    'hands %s on as it is given: the rules that tie properties together are judged for the service as it will be stored',
    async (_case, input) => {
      const dependencies = serviceDependencies()

      const result = await update(dependencies, input)

      expect(result.type).toBe('success')
      expect(dependencies.serviceRepository.update).toHaveBeenCalledWith(
        SALON_ID,
        SERVICE_ID,
        input,
        { type: 'keep' },
      )
    },
  )

  it('hands the IDs to the repository in lower case when the request writes the salon, the service, the category and the members in upper case', async () => {
    const dependencies = serviceDependencies()

    const result = await update(
      dependencies,
      {
        categoryId: OTHER_CATEGORY_ID.toUpperCase(),
        packageServiceIds: [
          THIRD_SERVICE_ID.toUpperCase(),
          OTHER_SERVICE_ID.toUpperCase(),
        ],
      },
      SERVICE_ID.toUpperCase(),
      SALON_ID.toUpperCase(),
    )

    expect(result.type).toBe('success')
    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      SERVICE_ID,
      {
        categoryId: OTHER_CATEGORY_ID,
        packageServiceIds: [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
      },
      { type: 'keep' },
    )
  })

  it('changes the service of the salon in the path, whichever salon that is', async () => {
    const dependencies = serviceDependencies()

    await update(
      dependencies,
      { name: 'Renamed' },
      OTHER_SERVICE_ID,
      OTHER_SALON_ID,
    )

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(
      OTHER_SALON_ID,
    )
    expect(dependencies.serviceRepository.update).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      OTHER_SERVICE_ID,
      { name: 'Renamed' },
      { type: 'keep' },
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading or writing anything',
    async (_case, salon) => {
      const dependencies = serviceDependencies()

      const result = await update(
        dependencies,
        { name: 'Renamed' },
        SERVICE_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the service ID without reading or writing anything',
    async (_case, id) => {
      const dependencies = serviceDependencies()

      const result = await update(dependencies, { name: 'Renamed' }, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['an empty request', {}, [':custom']],
    ['null as the name', { name: null }, ['name:invalid_type']],
    [
      'null as the pricing strategy',
      { pricingStrategy: null },
      ['pricingStrategy:invalid_value'],
    ],
    ['null as the options', { options: null }, ['options:invalid_type']],
    ['a negative price', { price: -1 }, ['price:too_small']],
    [
      'an option without a quantity',
      { options: [{ ...serviceOptionRequest(), maxQuantity: 0 }] },
      ['options.0.maxQuantity:too_small'],
    ],
    [
      'another salon for the service',
      { salonId: OTHER_SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'a property the client may not set',
      { name: 'Renamed', createdAt: '2026-11-14T09:00:00.000Z' },
      ['createdAt:unrecognized_keys'],
    ],
    ['a body that is not an object', 'name=Renamed', [':invalid_type']],
    ['a missing body', undefined, [':invalid_type']],
  ])(
    'rejects %s without looking the salon up or changing anything',
    async (_case, input, expected) => {
      const dependencies = serviceDependencies()

      const result = await update(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    [
      'the members name the service itself',
      { isPackage: true, packageServiceIds: [OTHER_SERVICE_ID, SERVICE_ID] },
      SERVICE_ID,
    ],
    [
      'the members name the service itself in upper case',
      { packageServiceIds: [SERVICE_ID.toUpperCase(), OTHER_SERVICE_ID] },
      SERVICE_ID,
    ],
    [
      'the path names the service in upper case and the members name it in lower case',
      { packageServiceIds: [SERVICE_ID, OTHER_SERVICE_ID] },
      SERVICE_ID.toUpperCase(),
    ],
  ])(
    'refuses a package of itself as circular when %s, without looking the salon up or changing anything',
    async (_case, input, id) => {
      const dependencies = withoutSalon()

      const result = await update(dependencies, input, id)

      expect(rulesOf(result)).toEqual(['packageServiceIds:circular'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and changes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await update(dependencies, { name: 'Renamed' })

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon and changes nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await update(dependencies, { name: 'Renamed' })

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('reports a service that the repository does not find in the salon as not found with its ID', async () => {
    const dependencies = serviceDependencies(
      updating({
        type: 'notFound',
        id: serviceIdSchema.parse(OTHER_SERVICE_ID),
      }),
    )

    const result = await update(
      dependencies,
      { categoryId: OTHER_CATEGORY_ID },
      OTHER_SERVICE_ID,
    )

    expect(result).toEqual(serviceNotFound(OTHER_SERVICE_ID))
  })

  it.each(changeRefusals)(
    'refuses %s, as the repository finds it, as a broken rule of the service',
    async (_case, refusal, expected) => {
      const dependencies = serviceDependencies(updating(refusal))

      const result = await update(dependencies, { isPackage: true })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(expected)
    },
  )

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceDependencies({
      update: vi.fn(async () => databaseDown),
    })

    const result = await update(dependencies, { name: 'Renamed' })

    expect(result).toEqual(databaseDown)
  })

  it('reports a changed service that cannot be presented as a database error', async () => {
    const dependencies = serviceDependencies(
      updating({ type: 'updated', service: corruptService }),
    )

    const result = await update(dependencies, { name: 'Renamed' })

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('BulkUpdateServicesUseCase', () => {
  const bulkUpdate = (
    dependencies: ServiceUseCaseDependencies,
    input: unknown,
    salon: unknown = SALON_ID,
  ) =>
    new BulkUpdateServicesUseCase(dependencies).execute(
      actors.admin,
      salon,
      input,
    )

  it('hands the same changes for every named service to the repository at once, once the salon is known to exist, and returns their IDs in the order of the request', async () => {
    const dependencies = serviceDependencies()
    const serviceIds = [THIRD_SERVICE_ID, SERVICE_ID, OTHER_SERVICE_ID]

    const result = await bulkUpdate(dependencies, {
      serviceIds,
      updates: { price: 7000, isActive: false },
    })

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.updateMany).toHaveBeenCalledWith(
      SALON_ID,
      serviceIds,
      { price: 7000, isActive: false },
      { type: 'keep' },
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'services.updateMany',
    ])
    expect(result).toEqual({
      type: 'success',
      data: { updated: serviceIds },
    })
  })

  it('hands the options on to replace those of every named service', async () => {
    const dependencies = serviceDependencies()
    const options = [serviceOptionRequest()]

    await bulkUpdate(dependencies, {
      serviceIds: [SERVICE_ID, OTHER_SERVICE_ID],
      updates: { options },
    })

    expect(dependencies.serviceRepository.updateMany).toHaveBeenCalledWith(
      SALON_ID,
      [SERVICE_ID, OTHER_SERVICE_ID],
      {},
      { type: 'replace', options },
    )
  })

  it('hands the IDs on in lower case, and returns them in lower case, when the request writes the salon, the services, the category and the members in upper case', async () => {
    const dependencies = serviceDependencies()

    const result = await bulkUpdate(
      dependencies,
      {
        serviceIds: [OTHER_SERVICE_ID.toUpperCase(), SERVICE_ID.toUpperCase()],
        updates: {
          categoryId: CATEGORY_ID.toUpperCase(),
          isPackage: true,
          packageServiceIds: [
            THIRD_SERVICE_ID.toUpperCase(),
            '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e04'.toUpperCase(),
          ],
        },
      },
      SALON_ID.toUpperCase(),
    )

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.updateMany).toHaveBeenCalledWith(
      SALON_ID,
      [OTHER_SERVICE_ID, SERVICE_ID],
      {
        categoryId: CATEGORY_ID,
        isPackage: true,
        packageServiceIds: [
          THIRD_SERVICE_ID,
          '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e04',
        ],
      },
      { type: 'keep' },
    )
    expect(result).toEqual({
      type: 'success',
      data: { updated: [OTHER_SERVICE_ID, SERVICE_ID] },
    })
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading or writing anything',
    async (_case, salon) => {
      const dependencies = serviceDependencies()

      const result = await bulkUpdate(
        dependencies,
        { serviceIds: [SERVICE_ID], updates: { price: 7000 } },
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    [
      'no service',
      { serviceIds: [], updates: { price: 7000 } },
      ['serviceIds:too_small'],
    ],
    [
      'a service ID that is not a UUID',
      { serviceIds: [SERVICE_ID, 'latest'], updates: { price: 7000 } },
      ['serviceIds.1:invalid_format'],
    ],
    [
      'the same service twice, once in upper case',
      {
        serviceIds: [SERVICE_ID, OTHER_SERVICE_ID, SERVICE_ID.toUpperCase()],
        updates: { price: 7000 },
      },
      ['serviceIds.2:custom'],
    ],
    ['no changes', { serviceIds: [SERVICE_ID] }, ['updates:invalid_type']],
    [
      'empty changes',
      { serviceIds: [SERVICE_ID], updates: {} },
      ['updates:custom'],
    ],
    [
      'a change that breaks the rule of its property',
      { serviceIds: [SERVICE_ID], updates: { price: -1 } },
      ['updates.price:too_small'],
    ],
    [
      'another salon for the services',
      { serviceIds: [SERVICE_ID], updates: { salonId: OTHER_SALON_ID } },
      ['updates.salonId:unrecognized_keys'],
    ],
    [
      'a property the request does not have',
      { serviceIds: [SERVICE_ID], updates: { price: 7000 }, all: true },
      ['all:unrecognized_keys'],
    ],
    ['a body that is not an object', 'serviceIds=1', [':invalid_type']],
    ['a missing body', undefined, [':invalid_type']],
  ])(
    'rejects %s without looking the salon up or changing anything',
    async (_case, input, expected) => {
      const dependencies = serviceDependencies()

      const result = await bulkUpdate(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    [
      'the members name one of the services',
      [SERVICE_ID, OTHER_SERVICE_ID],
      [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
    ],
    [
      'the members name one of the services in another case',
      [SERVICE_ID.toUpperCase(), OTHER_SERVICE_ID],
      [THIRD_SERVICE_ID, SERVICE_ID],
    ],
  ])(
    'refuses changes that make a package of itself as circular when %s, without looking the salon up or changing anything',
    async (_case, serviceIds, packageServiceIds) => {
      const dependencies = withoutSalon()

      const result = await bulkUpdate(dependencies, {
        serviceIds,
        updates: { isPackage: true, packageServiceIds },
      })

      expect(rulesOf(result)).toEqual(['updates.packageServiceIds:circular'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and changes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await bulkUpdate(dependencies, {
      serviceIds: [SERVICE_ID],
      updates: { price: 7000 },
    })

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon and changes nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await bulkUpdate(dependencies, {
      serviceIds: [SERVICE_ID],
      updates: { price: 7000 },
    })

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('reports the service that the repository does not find in the salon as not found with its ID', async () => {
    const dependencies = serviceDependencies(
      updatingMany({
        type: 'notFound',
        id: serviceIdSchema.parse(OTHER_SERVICE_ID),
      }),
    )

    const result = await bulkUpdate(dependencies, {
      serviceIds: [SERVICE_ID, OTHER_SERVICE_ID],
      updates: { price: 7000 },
    })

    expect(result).toEqual(serviceNotFound(OTHER_SERVICE_ID))
  })

  it.each(changeRefusals)(
    'refuses %s, as the repository finds it for one of the services, as a broken rule of the changes',
    async (_case, refusal, expected) => {
      const dependencies = serviceDependencies(updatingMany(refusal))

      const result = await bulkUpdate(dependencies, {
        serviceIds: [SERVICE_ID, OTHER_SERVICE_ID],
        updates: { isPackage: true },
      })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(expected.map((rule) => `updates.${rule}`))
    },
  )

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceDependencies({
      updateMany: vi.fn(async () => databaseDown),
    })

    const result = await bulkUpdate(dependencies, {
      serviceIds: [SERVICE_ID],
      updates: { price: 7000 },
    })

    expect(result).toEqual(databaseDown)
  })
})

describe('DeleteServiceUseCase', () => {
  const remove = (
    dependencies: ServiceUseCaseDependencies,
    id: unknown = SERVICE_ID,
    salon: unknown = SALON_ID,
  ) => new DeleteServiceUseCase(dependencies).execute(actors.admin, salon, id)

  it('deletes the service of the salon, once the salon is known to exist, and returns its ID', async () => {
    const dependencies = serviceDependencies()

    const result = await remove(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceRepository.delete).toHaveBeenCalledWith(
      SALON_ID,
      SERVICE_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'services.delete',
    ])
    expect(result).toEqual({ type: 'success', data: SERVICE_ID })
  })

  it('deletes by the lower-case IDs when the path writes them in upper case, and returns the ID in lower case', async () => {
    const dependencies = serviceDependencies()

    const result = await remove(
      dependencies,
      SERVICE_ID.toUpperCase(),
      SALON_ID.toUpperCase(),
    )

    expect(dependencies.serviceRepository.delete).toHaveBeenCalledWith(
      SALON_ID,
      SERVICE_ID,
    )
    expect(result).toEqual({ type: 'success', data: SERVICE_ID })
  })

  it('deletes from the salon of the path only, whichever salon that is', async () => {
    const dependencies = serviceDependencies()

    await remove(dependencies, SERVICE_ID, OTHER_SALON_ID)

    expect(dependencies.serviceRepository.delete).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      SERVICE_ID,
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading or deleting anything',
    async (_case, salon) => {
      const dependencies = serviceDependencies()

      const result = await remove(dependencies, SERVICE_ID, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the service ID without reading or deleting anything',
    async (_case, id) => {
      const dependencies = serviceDependencies()

      const result = await remove(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and deletes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await remove(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon and deletes nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await remove(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('reports a service the salon does not have, or no longer has, as not found with its ID', async () => {
    const dependencies = serviceDependencies(deleting({ type: 'notFound' }))

    const result = await remove(dependencies, OTHER_SERVICE_ID)

    expect(result).toEqual(serviceNotFound(OTHER_SERVICE_ID))
  })

  it('refuses to delete a service that a package contains as a conflict', async () => {
    const dependencies = serviceDependencies(
      deleting({ type: 'containedInPackage' }),
    )

    const result = await remove(dependencies)

    expect(result).toEqual({
      type: 'error',
      error: { type: 'conflict', message: expect.any(String) },
    })
  })

  it('refuses to delete a service that bookings have which are not finished as a conflict', async () => {
    const dependencies = serviceDependencies(
      deleting({ type: 'bookingsUnfinished' }),
    )

    const result = await remove(dependencies)

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'The service cannot be deleted: bookings that are not finished refer to it',
      },
    })
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceDependencies({
      delete: vi.fn(async () => databaseDown),
    })

    const result = await remove(dependencies)

    expect(result).toEqual(databaseDown)
  })
})

describe('who may manage the services of a salon', () => {
  /** What a request says; whatever a test leaves out is valid. */
  type Request = { salon?: unknown; id?: unknown; input?: unknown }

  type Operation = (
    dependencies: ServiceUseCaseDependencies,
    actor: Actor,
    request?: Request,
  ) => Promise<Result<unknown, DomainError>>

  /** A request in which everything but the salon ID is wrong. */
  const wrongAfterTheSalon: Request = { id: 'latest', input: { name: '' } }

  /** Repositories in which the salon is not there and no write would succeed. */
  const nothingThere = (): ServiceUseCaseDependencies =>
    withoutSalon({
      ...creating({ type: 'categoryNotFound' }),
      ...updating({ type: 'notFound', id: serviceIdSchema.parse(SERVICE_ID) }),
      ...updatingMany({
        type: 'notFound',
        id: serviceIdSchema.parse(SERVICE_ID),
      }),
      ...deleting({ type: 'notFound' }),
      findById: vi.fn(async () => Result.success(null)),
    })

  const allowed: [string, Actor][] = [
    ['an admin', actors.admin],
    ['the owner of the salon', actors.ofSalon('owner', SALON_ID)],
    ['a manager of the salon', actors.ofSalon('manager', SALON_ID)],
  ]

  const refused: [string, Actor][] = [
    ['a staff member of the salon', actors.ofSalon('staff', SALON_ID)],
    ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
    [
      'a staff member of another salon',
      actors.ofSalon('staff', OTHER_SALON_ID),
    ],
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ]

  const createService: Operation = (
    dependencies,
    actor,
    { salon = SALON_ID, input = serviceCreateRequest() } = {},
  ) => new CreateServiceUseCase(dependencies).execute(actor, salon, input)

  const updateService: Operation = (
    dependencies,
    actor,
    { salon = SALON_ID, id = SERVICE_ID, input = { name: 'Renamed' } } = {},
  ) => new UpdateServiceUseCase(dependencies).execute(actor, salon, id, input)

  const bulkUpdateServices: Operation = (
    dependencies,
    actor,
    {
      salon = SALON_ID,
      input = {
        serviceIds: [SERVICE_ID, OTHER_SERVICE_ID],
        updates: { price: 7000 },
      },
    } = {},
  ) => new BulkUpdateServicesUseCase(dependencies).execute(actor, salon, input)

  const deleteService: Operation = (
    dependencies,
    actor,
    { salon = SALON_ID, id = SERVICE_ID } = {},
  ) => new DeleteServiceUseCase(dependencies).execute(actor, salon, id)

  describe.each<[string, Operation, string]>([
    ['create a service', createService, 'services.create'],
    ['change a service', updateService, 'services.update'],
    [
      'change several services at once',
      bulkUpdateServices,
      'services.updateMany',
    ],
    ['delete a service', deleteService, 'services.delete'],
  ])('to %s', (_operation, execute, write) => {
    it.each(allowed)('lets %s do it', async (_case, actor) => {
      const dependencies = serviceDependencies()

      const result = await execute(dependencies, actor)

      expect(result.type).toBe('success')
      expect(repositoryCalls(dependencies)).toEqual(['salons.exists', write])
    })

    it.each([
      ['the owner of the salon', actors.ofSalon('owner', SALON_ID)],
      ['a manager of the salon', actors.ofSalon('manager', SALON_ID)],
    ])(
      'lets %s do it when the request writes the ID of the salon in upper case',
      async (_case, actor) => {
        const dependencies = serviceDependencies()

        const result = await execute(dependencies, actor, {
          salon: SALON_ID.toUpperCase(),
        })

        expect(result.type).toBe('success')
        expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(
          SALON_ID,
        )
        expect(repositoryCalls(dependencies)).toEqual(['salons.exists', write])
      },
    )

    it.each(refused)(
      'forbids %s, and reads and writes nothing',
      async (_case, actor) => {
        const dependencies = serviceDependencies()

        const result = await execute(dependencies, actor)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(refused)(
      'forbids %s before looking at the service ID or the body, and before looking for the salon or the service',
      async (_case, actor) => {
        const dependencies = nothingThere()

        const result = await execute(dependencies, actor, wrongAfterTheSalon)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(refused)(
      'forbids %s also where the salon and the service do not exist',
      async (_case, actor) => {
        const dependencies = nothingThere()

        const result = await execute(dependencies, actor)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it('decides from the salon of the path: the owner of another salon may do it there, and the owner of this salon may not', async () => {
      const there = serviceDependencies()
      const here = serviceDependencies()

      const inTheirSalon = await execute(
        there,
        actors.ofSalon('owner', OTHER_SALON_ID),
        { salon: OTHER_SALON_ID },
      )
      const inAnotherSalon = await execute(
        here,
        actors.ofSalon('owner', SALON_ID),
        { salon: OTHER_SALON_ID },
      )

      expect(inTheirSalon.type).toBe('success')
      expect(there.salonRepository.exists).toHaveBeenCalledWith(OTHER_SALON_ID)
      expect(inAnotherSalon).toEqual(forbidden)
      expect(repositoryCalls(here)).toEqual([])
    })

    it.each([...allowed, ...refused])(
      'rejects a salon ID that is not a UUID from %s as invalid, whatever else is wrong',
      async (_case, actor) => {
        const dependencies = nothingThere()

        const result = await execute(dependencies, actor, {
          ...wrongAfterTheSalon,
          salon: 'latest',
        })

        expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(allowed)(
      'tells %s that the salon is not found only once the rest of the request is valid',
      async (_case, actor) => {
        const invalid = nothingThere()
        const valid = nothingThere()

        const withInvalidRequest = await execute(
          invalid,
          actor,
          wrongAfterTheSalon,
        )
        const withValidRequest = await execute(valid, actor)

        expect(withInvalidRequest).toMatchObject({
          type: 'error',
          error: { type: 'validation' },
        })
        expect(repositoryCalls(invalid)).toEqual([])
        expect(withValidRequest).toEqual(salonNotFound)
        expect(repositoryCalls(valid)).toEqual(['salons.exists'])
      },
    )
  })

  describe.each<[string, Operation, Request]>([
    [
      'a service with a discount above its price',
      createService,
      { input: { ...serviceCreateRequest(), price: 100, discountPrice: 200 } },
    ],
    [
      'a package of one service',
      createService,
      {
        input: {
          ...serviceCreateRequest(),
          isPackage: true,
          packageServiceIds: [OTHER_SERVICE_ID],
        },
      },
    ],
    [
      'a service that becomes a package of itself',
      updateService,
      {
        input: {
          isPackage: true,
          packageServiceIds: [SERVICE_ID, OTHER_SERVICE_ID],
        },
      },
    ],
    [
      'services one of which becomes a package of itself',
      bulkUpdateServices,
      {
        input: {
          serviceIds: [SERVICE_ID, THIRD_SERVICE_ID],
          updates: {
            isPackage: true,
            packageServiceIds: [SERVICE_ID, OTHER_SERVICE_ID],
          },
        },
      },
    ],
  ])('a request for %s', (_request, execute, request) => {
    it.each(refused)(
      'is forbidden to %s before the rule it breaks is looked at',
      async (_case, actor) => {
        const dependencies = serviceDependencies()

        const result = await execute(dependencies, actor, request)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(allowed)(
      'is refused for %s as a broken rule without reading or writing anything',
      async (_case, actor) => {
        const dependencies = serviceDependencies()

        const result = await execute(dependencies, actor, request)

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'validation' },
        })
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )
  })

  describe('the order of the checks', () => {
    const change = (
      dependencies: ServiceUseCaseDependencies,
      request: Request,
    ) => updateService(dependencies, actors.admin, request)

    it('looks at the service ID of an update before the body', async () => {
      const dependencies = nothingThere()

      const result = await change(dependencies, {
        id: 'latest',
        input: { name: '' },
      })

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('looks at the body of an update before the package naming the service itself', async () => {
      const dependencies = nothingThere()

      const result = await change(dependencies, {
        input: { name: '', packageServiceIds: [SERVICE_ID, OTHER_SERVICE_ID] },
      })

      expect(rulesOf(result)).toEqual(['name:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('looks at the package naming the service itself before looking for the salon', async () => {
      const dependencies = nothingThere()

      const result = await change(dependencies, {
        input: { packageServiceIds: [SERVICE_ID, OTHER_SERVICE_ID] },
      })

      expect(rulesOf(result)).toEqual(['packageServiceIds:circular'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('looks for the salon before the service, its category and its members', async () => {
      const dependencies = nothingThere()

      const result = await change(dependencies, {
        input: {
          categoryId: OTHER_CATEGORY_ID,
          packageServiceIds: [OTHER_SERVICE_ID, THIRD_SERVICE_ID],
        },
      })

      expect(result).toEqual(salonNotFound)
      expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
    })

    it('looks at the body of a creation before the rules that tie its properties together, those before looking for the salon, and the salon before the category and the members', async () => {
      const invalidBody = nothingThere()
      const brokenRule = nothingThere()
      const valid = nothingThere()

      const withInvalidBody = await createService(invalidBody, actors.admin, {
        input: {
          ...serviceCreateRequest(),
          name: '',
          price: 100,
          discountPrice: 200,
        },
      })
      const withBrokenRule = await createService(brokenRule, actors.admin, {
        input: { ...serviceCreateRequest(), price: 100, discountPrice: 200 },
      })
      const withValidBody = await createService(valid, actors.admin, {
        input: packageRequest(),
      })

      expect(rulesOf(withInvalidBody)).toEqual(['name:invalid_format'])
      expect(repositoryCalls(invalidBody)).toEqual([])
      expect(rulesOf(withBrokenRule)).toEqual(['discountPrice:too_big'])
      expect(repositoryCalls(brokenRule)).toEqual([])
      expect(withValidBody).toEqual(salonNotFound)
      expect(repositoryCalls(valid)).toEqual(['salons.exists'])
    })

    it('looks at the body of a bulk update before the package naming one of the services, and that before looking for the salon', async () => {
      const invalidBody = nothingThere()
      const circular = nothingThere()

      const withInvalidBody = await bulkUpdateServices(
        invalidBody,
        actors.admin,
        {
          input: {
            serviceIds: [SERVICE_ID, SERVICE_ID],
            updates: { packageServiceIds: [SERVICE_ID, OTHER_SERVICE_ID] },
          },
        },
      )
      const withCircular = await bulkUpdateServices(circular, actors.admin, {
        input: {
          serviceIds: [SERVICE_ID],
          updates: { packageServiceIds: [SERVICE_ID, OTHER_SERVICE_ID] },
        },
      })

      expect(rulesOf(withInvalidBody)).toEqual(['serviceIds.1:custom'])
      expect(repositoryCalls(invalidBody)).toEqual([])
      expect(rulesOf(withCircular)).toEqual([
        'updates.packageServiceIds:circular',
      ])
      expect(repositoryCalls(circular)).toEqual([])
    })

    it('looks at the service ID of a deletion before looking for the salon', async () => {
      const dependencies = nothingThere()

      const result = await deleteService(dependencies, actors.admin, {
        id: 'latest',
      })

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })
  })
})
