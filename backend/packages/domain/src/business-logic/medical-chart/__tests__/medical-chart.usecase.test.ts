import { Result } from '@beauty-salon-backend/utility'
import {
  customerMessages,
  medicalChartMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors, CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiMedicalChart,
  dbMedicalChart,
  MEDICAL_CHART_ID,
  medicalChartCreateRequest,
  medicalChartDependencies,
  OTHER_MEDICAL_CHART_ID,
} from '../../../__tests__/fixtures/medical-chart-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  MedicalChartChange,
  MedicalChartCreation,
  MedicalChartListing,
  MedicalChartOfCustomer,
} from '../../../repositories/medical-chart.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CreateMedicalChartUseCase,
  GetMedicalChartUseCase,
  ListMedicalChartsUseCase,
  type MedicalChartUseCaseDependencies,
  UpdateMedicalChartUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Whether the repository was asked nothing. */
const untouched = ({
  medicalChartRepository,
}: MedicalChartUseCaseDependencies): boolean =>
  Object.values(medicalChartRepository).every(
    (method) => vi.mocked(method).mock.calls.length === 0,
  )

/** Everyone who keeps the charts: the customer ledger is one for every salon. */
const keepers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
  ['a staff member of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
]

/** Actors who reach no charts at all. */
const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

describe('CreateMedicalChartUseCase', () => {
  const create = (
    dependencies: MedicalChartUseCaseDependencies,
    actor: Actor = actors.admin,
    input: unknown = medicalChartCreateRequest(),
  ) => new CreateMedicalChartUseCase(dependencies).execute(actor, input)

  const creating = (outcome: MedicalChartCreation) =>
    medicalChartDependencies({
      create: vi.fn(async () => Result.success(outcome)),
    })

  it.each(keepers)(
    'writes the chart for %s as the request states it, and answers it as the API shows it',
    async (_who, actor) => {
      const dependencies = medicalChartDependencies()

      const result = await create(dependencies, actor)

      expect(result).toEqual(Result.success(apiMedicalChart))
      expect(dependencies.medicalChartRepository.create).toHaveBeenCalledWith(
        medicalChartCreateRequest(),
      )
    },
  )

  it.each(outsiders)(
    'refuses %s before the request is read',
    async (_who, actor) => {
      const dependencies = medicalChartDependencies()

      expect(await create(dependencies, actor, null)).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a request that breaks a rule of its own, before anything is looked for', async () => {
    const dependencies = medicalChartDependencies()

    const result = await create(
      dependencies,
      actors.admin,
      medicalChartCreateRequest({ notes: '' }),
    )

    expect(rulesOf(result)).toEqual(['notes:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a treatment after the UTC day after the clock, before anything is looked for', async () => {
    const dependencies = medicalChartDependencies()

    const result = await create(
      dependencies,
      actors.admin,
      medicalChartCreateRequest({
        previousTreatments: [
          {
            treatment: 'cut',
            date: '2026-11-15',
            salonName: null,
            notes: null,
          },
          {
            treatment: 'cut',
            date: '2026-11-16',
            salonName: null,
            notes: null,
          },
        ],
      }),
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(medicalChartMessages.invalidMedicalChart, [
          {
            field: 'previousTreatments.1.date',
            rule: 'too_big',
            message: ruleMessages.notInFuture,
          },
        ]),
      ),
    )
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a customer who is not there as one the request names wrongly', async () => {
    expect(await create(creating({ type: 'customerNotFound' }))).toEqual(
      Result.error(
        DomainErrors.validation(medicalChartMessages.invalidMedicalChart, [
          {
            field: 'customerId',
            rule: 'not_found',
            message: ruleMessages.aCustomer,
          },
        ]),
      ),
    )
  })

  it('refuses a second chart of a customer as a conflict', async () => {
    expect(await create(creating({ type: 'chartExists' }))).toEqual(
      Result.error(
        DomainErrors.conflict(
          'The customer has a medical chart already; a customer has one',
        ),
      ),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = medicalChartDependencies({
      create: vi.fn(async () => databaseDown),
    })

    expect(await create(dependencies)).toEqual(databaseDown)
  })
})

describe('GetMedicalChartUseCase', () => {
  const get = (
    dependencies: MedicalChartUseCaseDependencies,
    actor: Actor = actors.admin,
    customerId: unknown = CUSTOMER_ID,
  ) => new GetMedicalChartUseCase(dependencies).execute(actor, customerId)

  const finding = (outcome: MedicalChartOfCustomer) =>
    medicalChartDependencies({
      findByCustomer: vi.fn(async () => Result.success(outcome)),
    })

  it.each(keepers)(
    'reads the chart of the customer for %s',
    async (_who, actor) => {
      const dependencies = medicalChartDependencies()

      expect(await get(dependencies, actor)).toEqual(
        Result.success(apiMedicalChart),
      )
      expect(
        dependencies.medicalChartRepository.findByCustomer,
      ).toHaveBeenCalledWith(CUSTOMER_ID)
    },
  )

  it('reads a customer ID in upper case as the same customer', async () => {
    const dependencies = medicalChartDependencies()

    await get(dependencies, actors.admin, CUSTOMER_ID.toUpperCase())

    expect(
      dependencies.medicalChartRepository.findByCustomer,
    ).toHaveBeenCalledWith(CUSTOMER_ID)
  })

  it.each(outsiders)(
    'refuses %s before the customer ID is read',
    async (_who, actor) => {
      const dependencies = medicalChartDependencies()

      expect(await get(dependencies, actor, 'customer-1')).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a customer ID that is no UUID, by the name of the path', async () => {
    const dependencies = medicalChartDependencies()

    const result = await get(dependencies, actors.admin, 'customer-1')

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: customerMessages.invalidCustomerId,
      },
    })
    expect(rulesOf(result)).toEqual(['customerId:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it.each<[string, MedicalChartOfCustomer, string]>([
    ['customer who is not there', { type: 'customerNotFound' }, 'Customer'],
    ['customer without a chart', { type: 'chartNotFound' }, 'MedicalChart'],
  ])('answers a %s as not found', async (_case, outcome, entity) => {
    expect(await get(finding(outcome))).toEqual(
      Result.error(DomainErrors.notFound(entity, CUSTOMER_ID)),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = medicalChartDependencies({
      findByCustomer: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })
})

describe('UpdateMedicalChartUseCase', () => {
  const update = (
    dependencies: MedicalChartUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = MEDICAL_CHART_ID,
    input: unknown = { notes: null, avoidProducts: [] },
  ) => new UpdateMedicalChartUseCase(dependencies).execute(actor, id, input)

  it.each(keepers)(
    'writes only what the request names for %s',
    async (_who, actor) => {
      const dependencies = medicalChartDependencies()

      expect(await update(dependencies, actor)).toEqual(
        Result.success(apiMedicalChart),
      )
      expect(dependencies.medicalChartRepository.update).toHaveBeenCalledWith(
        MEDICAL_CHART_ID,
        { notes: null, avoidProducts: [] },
      )
    },
  )

  it.each(outsiders)(
    'refuses %s before the ID is read',
    async (_who, actor) => {
      const dependencies = medicalChartDependencies()

      expect(await update(dependencies, actor, 'chart-1', null)).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID before the request', async () => {
    const dependencies = medicalChartDependencies()

    const result = await update(dependencies, actors.admin, 'chart-1', {})

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it.each<[string, object, string[]]>([
    ['a request that names nothing', {}, [':custom']],
    [
      'the customer of the chart',
      { customerId: CUSTOMER_ID },
      ['customerId:unrecognized_keys'],
    ],
    [
      'a treatment of a later day than the clock allows',
      {
        previousTreatments: [
          {
            treatment: 'cut',
            date: '2026-11-16',
            salonName: null,
            notes: null,
          },
        ],
      },
      ['previousTreatments.0.date:too_big'],
    ],
  ])('refuses %s, and writes nothing', async (_case, input, rules) => {
    const dependencies = medicalChartDependencies()

    const result = await update(
      dependencies,
      actors.admin,
      MEDICAL_CHART_ID,
      input,
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(untouched(dependencies)).toBe(true)
  })

  it('answers a chart that is not there as not found', async () => {
    const dependencies = medicalChartDependencies({
      update: vi.fn(async () =>
        Result.success<MedicalChartChange>({ type: 'notFound' }),
      ),
    })

    expect(await update(dependencies)).toEqual(
      Result.error(DomainErrors.notFound('MedicalChart', MEDICAL_CHART_ID)),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = medicalChartDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })
})

describe('ListMedicalChartsUseCase', () => {
  const list = (
    dependencies: MedicalChartUseCaseDependencies,
    actor: Actor = actors.admin,
    query: Result<unknown, DomainError> = Result.success({}),
  ) => new ListMedicalChartsUseCase(dependencies).execute(actor, query)

  const listing = (outcome: MedicalChartListing) =>
    medicalChartDependencies({
      list: vi.fn(async () => Result.success(outcome)),
    })

  it.each(keepers)(
    'lists the charts for %s, 20 a page unless the query says otherwise',
    async (_who, actor) => {
      const dependencies = medicalChartDependencies()

      expect(await list(dependencies, actor)).toEqual(
        Result.success({
          data: [apiMedicalChart],
          meta: {
            total: 1,
            limit: 20,
            hasMore: false,
            cursor: null,
            nextCursor: null,
            prevCursor: null,
          },
        }),
      )
      expect(dependencies.medicalChartRepository.list).toHaveBeenCalledWith({
        limit: 20,
        after: null,
        search: null,
        hasAllergies: null,
      })
    },
  )

  it('passes every filter, and gives the last chart of a page as the next cursor', async () => {
    const dependencies = listing({
      type: 'listed',
      charts: [
        dbMedicalChart(),
        dbMedicalChart({ id: OTHER_MEDICAL_CHART_ID }),
      ],
      total: 5,
      hasMore: true,
    })

    const result = await list(
      dependencies,
      actors.ofSalon('staff'),
      Result.success({
        limit: 2,
        cursor: MEDICAL_CHART_ID.toUpperCase(),
        search: 'Aveda',
        hasAllergies: false,
      }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: MEDICAL_CHART_ID,
          nextCursor: OTHER_MEDICAL_CHART_ID,
          prevCursor: null,
        },
      },
    })
    expect(dependencies.medicalChartRepository.list).toHaveBeenCalledWith({
      limit: 2,
      after: MEDICAL_CHART_ID,
      search: 'Aveda',
      hasAllergies: false,
    })
  })

  it.each(outsiders)(
    'refuses %s before the query is looked at, even one that could not be read',
    async (_who, actor) => {
      const dependencies = medicalChartDependencies()

      expect(
        await list(
          dependencies,
          actor,
          Result.error(DomainErrors.validation('Invalid query', [])),
        ),
      ).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('answers a query that could not be read as it was told', async () => {
    const unreadable = Result.error(
      DomainErrors.validation(medicalChartMessages.invalidMedicalChartSearch, [
        { field: 'limit', rule: 'invalid_format', message: MADE_UP_MESSAGE },
      ]),
    )
    const dependencies = medicalChartDependencies()

    expect(await list(dependencies, actors.admin, unreadable)).toEqual(
      unreadable,
    )
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a query that breaks a rule, and looks for nothing', async () => {
    const dependencies = medicalChartDependencies()

    const result = await list(
      dependencies,
      actors.admin,
      Result.success({ limit: 0, search: ' ' }),
    )

    expect(rulesOf(result)).toEqual([
      'limit:too_small',
      'search:invalid_format',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a cursor that names no chart of the list', async () => {
    expect(
      await list(
        listing({ type: 'cursorNotFound' }),
        actors.admin,
        Result.success({ cursor: OTHER_MEDICAL_CHART_ID }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.validation(
          medicalChartMessages.invalidMedicalChartSearch,
          [
            {
              field: 'cursor',
              rule: 'not_found',
              message: medicalChartMessages.aMedicalChartOfList,
            },
          ],
        ),
      ),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = medicalChartDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })
})
