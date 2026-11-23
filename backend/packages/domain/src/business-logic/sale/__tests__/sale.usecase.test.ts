import { Result } from '@beauty-salon-backend/utility'
import { textIn } from '@beauty-salon-shared/i18n'
import {
  entityMessages,
  ruleMessages,
  saleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors, CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { BOOKING_ID } from '../../../__tests__/fixtures/booking-fixtures'
import {
  brokenRules,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiSale,
  OTHER_SALE_ID,
  saleRepositoryCalls as repositoryCalls,
  SALE_ID,
  SALE_NUMBER,
  saleCreateRequest,
  saleDependencies,
  saleWithDetails,
} from '../../../__tests__/fixtures/sale-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  ISaleRepository,
  SaleCreation,
  SaleUpdate,
  SaleVoiding,
} from '../../../repositories/sale.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CreateSaleUseCase,
  GetSaleUseCase,
  ListSalesUseCase,
  type SaleUseCaseDependencies,
  UpdateSaleUseCase,
  VoidSaleUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** The message of a failed validation; null for anything else. */
const validationMessageOf = (
  result: Result<unknown, DomainError>,
): string | null =>
  result.type === 'error' && result.error.type === 'validation'
    ? textIn(result.error.message, 'en')
    : null

/** A sale whose time cannot be turned into a response. */
const corruptSale = saleWithDetails({ saleTime: 'noon' })

/** Those who keep the sales ledger of the salon of the fixtures. */
const keepers: [string, Actor][] = [
  ['an admin', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['the manager of the salon', actors.ofSalon('manager')],
  ['the staff of the salon', actors.ofSalon('staff')],
]

/** The members of another salon than the one of the fixtures. */
const membersOfAnotherSalon: [string, Actor][] = [
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['the manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
  ['the staff of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
]

/** Those the ledger is closed to. */
const notKeepers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

const everySalon = { type: 'everySalon' }
const ownSalon = { type: 'salon', salonId: SALON_ID }

describe('CreateSaleUseCase', () => {
  const create = (
    dependencies: SaleUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    input: unknown = saleCreateRequest(),
  ) => new CreateSaleUseCase(dependencies).execute(actor, input)

  const creating = (...outcomes: SaleCreation[]): Partial<ISaleRepository> => {
    const upcoming = [...outcomes]
    const last = outcomes.at(-1)

    return {
      create: vi.fn(async () =>
        Result.success<SaleCreation>(
          upcoming.shift() ??
            last ?? { type: 'created', sale: saleWithDetails() },
        ),
      ),
    }
  }

  const taken: SaleCreation = { type: 'saleNumberTaken' }
  const created: SaleCreation = { type: 'created', sale: saleWithDetails() }

  it('enters the sale and returns it', async () => {
    const dependencies = saleDependencies()

    const result = await create(dependencies)

    expect(result).toEqual({ type: 'success', data: apiSale() })
    expect(repositoryCalls(dependencies)).toEqual(['create'])
  })

  it('hands the request on with its time in one spelling, and the number of the sale', async () => {
    const dependencies = saleDependencies()

    await create(dependencies)

    expect(dependencies.saleRepository.create).toHaveBeenCalledWith(
      { ...saleCreateRequest(), saleTime: '2026-11-20T03:40:00.000Z' },
      { saleNumber: SALE_NUMBER },
    )
  })

  it.each(keepers)(
    'lets %s enter a sale of the salon',
    async (_case, actor) => {
      const result = await create(saleDependencies(), actor)

      expect(result.type).toBe('success')
    },
  )

  it('lets an admin enter a sale of any salon', async () => {
    const dependencies = saleDependencies()

    const result = await create(dependencies, actors.admin, {
      ...saleCreateRequest(),
      salonId: OTHER_SALON_ID,
    })

    expect(result.type).toBe('success')
    expect(dependencies.saleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: OTHER_SALON_ID }),
      expect.anything(),
    )
  })

  it.each(notKeepers)(
    'refuses %s without reading the request',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      expect(await create(dependencies, actor)).toEqual(forbidden)
      expect(await create(dependencies, actor, { salonId: 'x' })).toEqual(
        forbidden,
      )
      expect(await create(dependencies, actor, null)).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
      expect(dependencies.saleNumberIssuer.issue).not.toHaveBeenCalled()
    },
  )

  it('does not let a customer enter a sale to themself', async () => {
    const dependencies = saleDependencies()

    const result = await create(dependencies, actors.customer, {
      ...saleCreateRequest(),
      customerId: CUSTOMER_ID,
    })

    expect(result).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each(membersOfAnotherSalon)(
    'refuses %s once the request says which salon it is for',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      expect(await create(dependencies, actor)).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
      expect(dependencies.saleNumberIssuer.issue).not.toHaveBeenCalled()
    },
  )

  it('tells a member of another salon what is wrong with a request before refusing it', async () => {
    const dependencies = saleDependencies()

    const result = await create(
      dependencies,
      actors.ofSalon('owner', OTHER_SALON_ID),
      { ...saleCreateRequest(), pointsUsed: -1 },
    )

    expect(rulesOf(result)).toEqual(['pointsUsed:too_small'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a request that breaks a rule of its own without writing anything', async () => {
    const dependencies = saleDependencies()

    const result = await create(dependencies, actors.admin, {
      ...saleCreateRequest(),
      details: [],
      paymentStatus: 'completed',
    })

    expect(validationMessageOf(result)).toBe('Invalid sale')
    expect(rulesOf(result).toSorted()).toEqual([
      'details:too_small',
      'paymentStatus:unrecognized_keys',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
    expect(dependencies.saleNumberIssuer.issue).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'sale'],
  ])('refuses %s for a request', async (_case, input) => {
    const result = await create(saleDependencies(), actors.admin, input)

    expect(rulesOf(result)).toEqual([':invalid_type'])
  })

  it('reports what the request refers to and is not there', async () => {
    const issues = [
      {
        field: 'customerId',
        rule: 'not_found',
        message: ruleMessages.aCustomer,
      },
      {
        field: 'details.0.itemId',
        rule: 'not_found',
        message: ruleMessages.aServiceOfSalon,
      },
    ]
    const dependencies = saleDependencies(creating({ type: 'invalid', issues }))

    const result = await create(dependencies)

    expect(result).toEqual({
      type: 'error',
      error: { type: 'validation', message: saleMessages.invalidSale, issues },
    })
    expect(repositoryCalls(dependencies)).toEqual(['create'])
  })

  it('reports a booking that has a sale as a conflict: the request is not at fault', async () => {
    const result = await create(
      saleDependencies(creating({ type: 'bookingBilled' })),
    )

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: saleMessages.bookingBilled,
      },
    })
  })

  it('reports a salon whose time zone is not known as a conflict', async () => {
    const result = await create(
      saleDependencies(creating({ type: 'timeZoneUnknown' })),
    )

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: saleMessages.timeZoneUnknown,
      },
    })
  })

  it('does not try again after a refusal that another number would not change', async () => {
    const refusals: SaleCreation[] = [
      { type: 'invalid', issues: [] },
      { type: 'bookingBilled' },
      { type: 'timeZoneUnknown' },
    ]

    for (const refusal of refusals) {
      const dependencies = saleDependencies(creating(refusal))

      await create(dependencies)

      expect(repositoryCalls(dependencies)).toEqual(['create'])
      expect(dependencies.saleNumberIssuer.issue).toHaveBeenCalledTimes(1)
    }
  })

  it('tries another number when a sale has the one that was issued', async () => {
    const dependencies = saleDependencies(creating(taken, created), [
      'SL-0000-0001',
      'SL-0000-0002',
    ])

    const result = await create(dependencies)

    expect(result).toEqual({ type: 'success', data: apiSale() })
    expect(
      vi
        .mocked(dependencies.saleRepository.create)
        .mock.calls.map(([, origin]) => origin.saleNumber),
    ).toEqual(['SL-0000-0001', 'SL-0000-0002'])
  })

  it('tries a third number', async () => {
    const dependencies = saleDependencies(creating(taken, taken, created))

    const result = await create(dependencies)

    expect(result.type).toBe('success')
    expect(repositoryCalls(dependencies)).toEqual([
      'create',
      'create',
      'create',
    ])
    expect(dependencies.saleNumberIssuer.issue).toHaveBeenCalledTimes(3)
  })

  it('gives up after three numbers that were all taken', async () => {
    const dependencies = saleDependencies(creating(taken))

    const result = await create(dependencies)

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'No sale number that is free was found in 3 attempts',
        cause: null,
      },
    })
    expect(repositoryCalls(dependencies)).toEqual([
      'create',
      'create',
      'create',
    ])
  })

  it('reports a failure of the database and does not try again', async () => {
    const dependencies = saleDependencies({
      create: vi.fn(async () => databaseDown),
    })

    expect(await create(dependencies)).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['create'])
  })

  it('reports a stored sale that cannot be presented as a fault of the database', async () => {
    const dependencies = saleDependencies(
      creating({ type: 'created', sale: corruptSale }),
    )

    expect(await create(dependencies)).toEqual(storedRowIsCorrupt)
    expect(repositoryCalls(dependencies)).toEqual(['create'])
  })
})

describe('GetSaleUseCase', () => {
  const get = (
    dependencies: SaleUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = SALE_ID,
  ) => new GetSaleUseCase(dependencies).execute(actor, id)

  const finding = (
    sale: ReturnType<typeof saleWithDetails> | null,
  ): Partial<ISaleRepository> => ({
    findById: vi.fn(async () => Result.success(sale)),
  })

  it('returns the sale with its lines and payments', async () => {
    const dependencies = saleDependencies()

    const result = await get(dependencies)

    expect(result).toEqual({ type: 'success', data: apiSale() })
    expect(repositoryCalls(dependencies)).toEqual(['findById'])
  })

  it('looks an admin up the sale among those of every salon', async () => {
    const dependencies = saleDependencies()

    await get(dependencies, actors.admin)

    expect(dependencies.saleRepository.findById).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
    )
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
    ['the staff', actors.ofSalon('staff')],
  ])(
    'looks %s of a salon up the sale among those of that salon',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      await get(dependencies, actor)

      expect(dependencies.saleRepository.findById).toHaveBeenCalledWith(
        SALE_ID,
        ownSalon,
      )
    },
  )

  it.each(membersOfAnotherSalon)(
    'looks %s up the sale among those of their own salon',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      await get(dependencies, actor)

      expect(dependencies.saleRepository.findById).toHaveBeenCalledWith(
        SALE_ID,
        { type: 'salon', salonId: OTHER_SALON_ID },
      )
    },
  )

  it.each(notKeepers)(
    'refuses %s without looking anything up, whatever the ID',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      expect(await get(dependencies, actor)).toEqual(forbidden)
      expect(await get(dependencies, actor, 'not-an-id')).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['a sale number', SALE_NUMBER],
    ['nothing', undefined],
  ])('refuses %s for the ID without looking anything up', async (_case, id) => {
    const dependencies = saleDependencies()

    const result = await new GetSaleUseCase(dependencies).execute(
      actors.admin,
      id,
    )

    expect(validationMessageOf(result)).toBe('Invalid sale ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(rulesOf(result)[0]).toMatch(/^id:/)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a sale the actor does not reach as one that does not exist', async () => {
    expect(await get(saleDependencies(finding(null)))).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.sale, SALE_ID)),
    )
  })

  it('looks the sale up, and names the one that is not there, by the ID in lower case', async () => {
    const dependencies = saleDependencies(finding(null))

    const result = await get(dependencies, actors.admin, SALE_ID.toUpperCase())

    expect(dependencies.saleRepository.findById).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
    )
    expect(result).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.sale, SALE_ID)),
    )
  })

  it('reports a failure of the database', async () => {
    const dependencies = saleDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored sale that cannot be presented as a fault of the database', async () => {
    expect(await get(saleDependencies(finding(corruptSale)))).toEqual(
      storedRowIsCorrupt,
    )
  })
})

describe('ListSalesUseCase', () => {
  const list = (
    dependencies: SaleUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    query: unknown = {},
  ) => new ListSalesUseCase(dependencies).execute(actor, Result.success(query))

  const noConditions = {
    limit: 20,
    after: null,
    salonId: null,
    customerId: null,
    bookingId: null,
    paymentStatus: null,
    startDate: null,
    endDate: null,
  }

  const listing = (
    sales = [saleWithDetails()],
    total = sales.length,
    hasMore = false,
  ): Partial<ISaleRepository> => ({
    list: vi.fn(async () => Result.success({ sales, total, hasMore })),
  })

  it('returns a page of sales and where it stands', async () => {
    const dependencies = saleDependencies()

    const result = await list(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiSale()],
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
    expect(repositoryCalls(dependencies)).toEqual(['list'])
  })

  it('lists an admin the sales of every salon, twenty to a page', async () => {
    const dependencies = saleDependencies()

    await list(dependencies, actors.admin)

    expect(dependencies.saleRepository.list).toHaveBeenCalledWith({
      reach: everySalon,
      ...noConditions,
    })
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
    ['the staff', actors.ofSalon('staff')],
  ])('lists %s of a salon the sales of that salon', async (_case, actor) => {
    const dependencies = saleDependencies()

    await list(dependencies, actor)

    expect(dependencies.saleRepository.list).toHaveBeenCalledWith({
      reach: ownSalon,
      ...noConditions,
    })
  })

  it('hands every condition of the search on', async () => {
    const dependencies = saleDependencies()

    await list(dependencies, actors.admin, {
      limit: 50,
      cursor: OTHER_SALE_ID,
      salonId: OTHER_SALON_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      paymentStatus: 'completed',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    })

    expect(dependencies.saleRepository.list).toHaveBeenCalledWith({
      reach: everySalon,
      limit: 50,
      after: OTHER_SALE_ID,
      salonId: OTHER_SALON_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      paymentStatus: 'completed',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    })
  })

  it('lets a member of a salon name their own salon', async () => {
    const dependencies = saleDependencies()

    const result = await list(dependencies, actors.ofSalon('manager'), {
      salonId: SALON_ID,
    })

    expect(result.type).toBe('success')
    expect(dependencies.saleRepository.list).toHaveBeenCalledWith({
      reach: ownSalon,
      ...noConditions,
      salonId: SALON_ID,
    })
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
    ['the staff', actors.ofSalon('staff')],
  ])('refuses %s of a salon who names another salon', async (_case, actor) => {
    const dependencies = saleDependencies()

    expect(
      await list(dependencies, actor, { salonId: OTHER_SALON_ID }),
    ).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('tells a member of a salon what is wrong with a search before refusing another salon', async () => {
    const dependencies = saleDependencies()

    const result = await list(dependencies, actors.ofSalon('owner'), {
      salonId: OTHER_SALON_ID,
      limit: 0,
    })

    expect(rulesOf(result)).toEqual(['limit:too_small'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each(notKeepers)(
    'refuses %s without looking at the search',
    async (_case, actor) => {
      const dependencies = saleDependencies()
      const undecodable = Result.error(
        DomainErrors.validation(saleMessages.invalidSaleSearch, []),
      )

      expect(await list(dependencies, actor)).toEqual(forbidden)
      expect(await list(dependencies, actor, { limit: 0 })).toEqual(forbidden)
      expect(
        await new ListSalesUseCase(dependencies).execute(actor, undecodable),
      ).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('does not list a customer what they paid through the ledger', async () => {
    const dependencies = saleDependencies()

    expect(
      await list(dependencies, actors.customer, { customerId: CUSTOMER_ID }),
    ).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a search that could not be decoded as the caller found it', async () => {
    const dependencies = saleDependencies()
    const undecodable = Result.error(
      DomainErrors.validation(saleMessages.invalidSaleSearch, [
        { field: 'limit', rule: 'invalid_type', message: MADE_UP_MESSAGE },
      ]),
    )

    expect(
      await new ListSalesUseCase(dependencies).execute(
        actors.admin,
        undecodable,
      ),
    ).toEqual(undecodable)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a search that breaks a rule without listing anything', async () => {
    const dependencies = saleDependencies()

    const result = await list(dependencies, actors.admin, {
      paymentStatus: 'paid',
      search: 'yamada',
    })

    expect(validationMessageOf(result)).toBe('Invalid sale search')
    expect(rulesOf(result).toSorted()).toEqual([
      'paymentStatus:invalid_value',
      'search:unrecognized_keys',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses days in the wrong order without listing anything', async () => {
    const dependencies = saleDependencies()

    const result = await list(dependencies, actors.admin, {
      startDate: '2026-11-20',
      endDate: '2026-11-19',
    })

    expect(rulesOf(result)).toEqual(['endDate:custom'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a cursor that names no sale the actor reaches', async () => {
    const dependencies = saleDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, actors.admin, {
      cursor: OTHER_SALE_ID,
    })

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: saleMessages.invalidSaleSearch,
        issues: [
          { field: 'cursor', rule: 'not_found', message: saleMessages.aSale },
        ],
      },
    })
  })

  it('names the last sale of a page as the cursor of the next one', async () => {
    const dependencies = saleDependencies(
      listing(
        [saleWithDetails(), saleWithDetails({ id: OTHER_SALE_ID })],
        5,
        true,
      ),
    )

    const result = await list(dependencies, actors.admin, {
      limit: 2,
      cursor: SALE_ID,
    })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: SALE_ID,
          nextCursor: OTHER_SALE_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor on the last page', async () => {
    const result = await list(
      saleDependencies(listing([saleWithDetails()], 3, false)),
      actors.admin,
      { cursor: OTHER_SALE_ID },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { total: 3, hasMore: false, nextCursor: null } },
    })
  })

  it('returns an empty page when nothing matches', async () => {
    const result = await list(saleDependencies(listing([])))

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

  it('reports a failure of the database', async () => {
    const dependencies = saleDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored sale that cannot be presented as a fault of the database', async () => {
    const result = await list(saleDependencies(listing([corruptSale])))

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateSaleUseCase', () => {
  const note = { notes: 'レシート再発行' }

  const update = (
    dependencies: SaleUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = SALE_ID,
    input: unknown = note,
  ) => new UpdateSaleUseCase(dependencies).execute(actor, id, input)

  const updating = (outcome: SaleUpdate): Partial<ISaleRepository> => ({
    update: vi.fn(async () => Result.success(outcome)),
  })

  it('corrects the sale and returns it as it is afterwards', async () => {
    const dependencies = saleDependencies(
      updating({
        type: 'updated',
        sale: saleWithDetails({ notes: 'レシート再発行' }),
      }),
    )

    const result = await update(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: apiSale({ notes: 'レシート再発行' }),
    })
    expect(repositoryCalls(dependencies)).toEqual(['update'])
  })

  it('hands on what the request names and nothing else, with its time in one spelling', async () => {
    const dependencies = saleDependencies()

    await update(dependencies, actors.admin, SALE_ID, {
      saleTime: '2026-11-21T01:00:00Z',
      bookingId: null,
    })

    expect(dependencies.saleRepository.update).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
      { saleTime: '2026-11-21T01:00:00.000Z', bookingId: null },
    )
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
    ['the staff', actors.ofSalon('staff')],
  ])(
    'looks for the sale %s of a salon corrects among those of that salon',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      await update(dependencies, actor)

      expect(dependencies.saleRepository.update).toHaveBeenCalledWith(
        SALE_ID,
        ownSalon,
        note,
      )
    },
  )

  it.each(membersOfAnotherSalon)(
    'looks for the sale %s corrects among those of their own salon',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      await update(dependencies, actor)

      expect(dependencies.saleRepository.update).toHaveBeenCalledWith(
        SALE_ID,
        { type: 'salon', salonId: OTHER_SALON_ID },
        note,
      )
    },
  )

  it.each(notKeepers)(
    'refuses %s without reading the request, whatever the ID',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      expect(await update(dependencies, actor)).toEqual(forbidden)
      expect(await update(dependencies, actor, 'not-an-id', null)).toEqual(
        forbidden,
      )
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['a sale number', SALE_NUMBER],
    ['nothing', undefined],
  ])('refuses %s for the ID without looking anything up', async (_case, id) => {
    const dependencies = saleDependencies()

    // Not through the helper above: it would put the ID of the fixtures
    // in the place of one that is not given.
    const result = await new UpdateSaleUseCase(dependencies).execute(
      actors.admin,
      id,
      note,
    )

    expect(validationMessageOf(result)).toBe('Invalid sale ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(rulesOf(result)[0]).toMatch(/^id:/)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('says what is wrong with the ID before it reads the request', async () => {
    const result = await update(saleDependencies(), actors.admin, 'not-an-id', {
      notes: '',
    })

    expect(validationMessageOf(result)).toBe('Invalid sale ID')
  })

  it('refuses a request that breaks a rule of its own without looking anything up', async () => {
    const dependencies = saleDependencies()

    const result = await update(dependencies, actors.admin, SALE_ID, {
      notes: '',
      details: [],
      salonId: OTHER_SALON_ID,
    })

    expect(validationMessageOf(result)).toBe('Invalid sale update')
    expect(rulesOf(result).toSorted()).toEqual([
      'details:too_small',
      'notes:invalid_format',
      'salonId:unrecognized_keys',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a request that names nothing', async () => {
    const dependencies = saleDependencies()

    const result = await update(dependencies, actors.admin, SALE_ID, {})

    expect(rulesOf(result)).toEqual([':custom'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'notes'],
  ])('refuses %s for a request', async (_case, input) => {
    const result = await update(
      saleDependencies(),
      actors.admin,
      SALE_ID,
      input,
    )

    expect(rulesOf(result)).toEqual([':invalid_type'])
  })

  it('tells a member of another salon what is wrong with a request: the sale is not looked for', async () => {
    const dependencies = saleDependencies()

    const result = await update(
      dependencies,
      actors.ofSalon('owner', OTHER_SALON_ID),
      SALE_ID,
      { pointsUsed: -1 },
    )

    expect(rulesOf(result)).toEqual(['pointsUsed:too_small'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a sale the actor does not reach as one that does not exist', async () => {
    expect(
      await update(saleDependencies(updating({ type: 'notFound' }))),
    ).toEqual(Result.error(DomainErrors.notFound(entityMessages.sale, SALE_ID)))
  })

  it('looks the sale up, and names the one that is not there, by the ID in lower case', async () => {
    const dependencies = saleDependencies(updating({ type: 'notFound' }))

    const result = await update(
      dependencies,
      actors.admin,
      SALE_ID.toUpperCase(),
    )

    expect(dependencies.saleRepository.update).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
      note,
    )
    expect(result).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.sale, SALE_ID)),
    )
  })

  it('reports a void sale as a conflict', async () => {
    expect(await update(saleDependencies(updating({ type: 'void' })))).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: saleMessages.voidIsNotChanged,
      },
    })
  })

  it('reports new lines for a sale whose payment has begun as a conflict', async () => {
    expect(
      await update(saleDependencies(updating({ type: 'paymentBegun' }))),
    ).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: saleMessages.linesWhilePending,
      },
    })
  })

  it('reports what the request refers to and is not there', async () => {
    const issues = [
      {
        field: 'customerId',
        rule: 'not_found',
        message: saleMessages.theCustomerOfBookingOfSale,
      },
      {
        field: 'pointsUsed',
        rule: 'custom',
        message: saleMessages.noPointsWithoutCustomer,
      },
    ]

    const result = await update(
      saleDependencies(updating({ type: 'invalid', issues })),
    )

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: saleMessages.invalidSaleUpdate,
        issues,
      },
    })
  })

  it('reports a booking that another sale bills as a conflict: the request is not at fault', async () => {
    expect(
      await update(saleDependencies(updating({ type: 'bookingBilled' }))),
    ).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: saleMessages.bookingBilled,
      },
    })
  })

  it('reports a salon whose time zone is not known as a conflict', async () => {
    expect(
      await update(saleDependencies(updating({ type: 'timeZoneUnknown' }))),
    ).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: saleMessages.timeZoneUnknown,
      },
    })
  })

  it('reports a failure of the database', async () => {
    const dependencies = saleDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored sale that cannot be presented as a fault of the database', async () => {
    expect(
      await update(
        saleDependencies(updating({ type: 'updated', sale: corruptSale })),
      ),
    ).toEqual(storedRowIsCorrupt)
  })
})

describe('VoidSaleUseCase', () => {
  const reason = { voidReason: '二重登録' }

  const voidSale = (
    dependencies: SaleUseCaseDependencies,
    actor: Actor = actors.ofSalon('manager'),
    id: unknown = SALE_ID,
    input: unknown = reason,
  ) => new VoidSaleUseCase(dependencies).execute(actor, id, input)

  const voiding = (outcome: SaleVoiding): Partial<ISaleRepository> => ({
    voidSale: vi.fn(async () => Result.success(outcome)),
  })

  const voided = {
    isVoid: true,
    voidedAt: '2026-11-20 14:00:00.25+09',
    voidReason: '二重登録',
  }

  it('voids the sale and returns it as it is afterwards', async () => {
    const dependencies = saleDependencies(
      voiding({ type: 'voided', sale: saleWithDetails(voided) }),
    )

    const result = await voidSale(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: apiSale({
        isVoid: true,
        voidedAt: '2026-11-20T05:00:00.250Z',
        voidReason: '二重登録',
      }),
    })
    expect(repositoryCalls(dependencies)).toEqual(['voidSale'])
  })

  it('lets an admin void a sale of any salon', async () => {
    const dependencies = saleDependencies()

    await voidSale(dependencies, actors.admin)

    expect(dependencies.saleRepository.voidSale).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
      reason,
    )
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
  ])(
    'looks for the sale %s of a salon voids among those of that salon',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      await voidSale(dependencies, actor)

      expect(dependencies.saleRepository.voidSale).toHaveBeenCalledWith(
        SALE_ID,
        ownSalon,
        reason,
      )
    },
  )

  it.each([
    ['the owner', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['the manager', actors.ofSalon('manager', OTHER_SALON_ID)],
  ])(
    'looks for the sale %s of another salon voids among those of their own salon',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      await voidSale(dependencies, actor)

      expect(dependencies.saleRepository.voidSale).toHaveBeenCalledWith(
        SALE_ID,
        { type: 'salon', salonId: OTHER_SALON_ID },
        reason,
      )
    },
  )

  it.each([
    ['the staff of the salon, who correct a sale', actors.ofSalon('staff')],
    ['the staff of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
    ...notKeepers,
  ])(
    'refuses %s without reading the request, whatever the ID',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      expect(await voidSale(dependencies, actor)).toEqual(forbidden)
      expect(await voidSale(dependencies, actor, 'not-an-id', null)).toEqual(
        forbidden,
      )
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('hands null on for a void of which no reason is kept', async () => {
    const dependencies = saleDependencies()

    await voidSale(dependencies, actors.admin, SALE_ID, { voidReason: null })

    expect(dependencies.saleRepository.voidSale).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
      { voidReason: null },
    )
  })

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['a sale number', SALE_NUMBER],
    ['nothing', undefined],
  ])('refuses %s for the ID without looking anything up', async (_case, id) => {
    const dependencies = saleDependencies()

    const result = await new VoidSaleUseCase(dependencies).execute(
      actors.admin,
      id,
      reason,
    )

    expect(validationMessageOf(result)).toBe('Invalid sale ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(rulesOf(result)[0]).toMatch(/^id:/)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('says what is wrong with the ID before it reads the request', async () => {
    const result = await voidSale(
      saleDependencies(),
      actors.admin,
      'not-an-id',
      {},
    )

    expect(validationMessageOf(result)).toBe('Invalid sale ID')
  })

  it.each([
    ['a request without the reason', {}, ['voidReason:invalid_type']],
    [
      'a reason that says nothing',
      { voidReason: ' ' },
      ['voidReason:invalid_format'],
    ],
    [
      'a request that states more than the reason',
      { voidReason: null, isVoid: true },
      ['isVoid:unrecognized_keys'],
    ],
    ['null for the request', null, [':invalid_type']],
    ['a list for the request', [], [':invalid_type']],
  ])('refuses %s without looking anything up', async (_case, input, rules) => {
    const dependencies = saleDependencies()

    const result = await voidSale(dependencies, actors.admin, SALE_ID, input)

    expect(validationMessageOf(result)).toBe('Invalid sale void')
    expect(rulesOf(result)).toEqual(rules)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a sale the actor does not reach as one that does not exist', async () => {
    expect(
      await voidSale(saleDependencies(voiding({ type: 'notFound' }))),
    ).toEqual(Result.error(DomainErrors.notFound(entityMessages.sale, SALE_ID)))
  })

  it('looks the sale up, and names the one that is not there, by the ID in lower case', async () => {
    const dependencies = saleDependencies(voiding({ type: 'notFound' }))

    const result = await voidSale(
      dependencies,
      actors.admin,
      SALE_ID.toUpperCase(),
    )

    expect(dependencies.saleRepository.voidSale).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
      reason,
    )
    expect(result).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.sale, SALE_ID)),
    )
  })

  it('reports a sale that is void already as a conflict', async () => {
    expect(await voidSale(saleDependencies(voiding({ type: 'void' })))).toEqual(
      {
        type: 'error',
        error: { type: 'conflict', message: saleMessages.alreadyVoid },
      },
    )
  })

  it('reports a sale with a payment that was not refunded as a conflict', async () => {
    expect(await voidSale(saleDependencies(voiding({ type: 'paid' })))).toEqual(
      {
        type: 'error',
        error: {
          type: 'conflict',
          message: saleMessages.paymentNotRefunded,
        },
      },
    )
  })

  it('reports a failure of the database', async () => {
    const dependencies = saleDependencies({
      voidSale: vi.fn(async () => databaseDown),
    })

    expect(await voidSale(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored sale that cannot be presented as a fault of the database', async () => {
    expect(
      await voidSale(
        saleDependencies(voiding({ type: 'voided', sale: corruptSale })),
      ),
    ).toEqual(storedRowIsCorrupt)
  })
})
