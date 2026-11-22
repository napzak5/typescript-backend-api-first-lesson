import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import {
  GetTreatmentStatisticsUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '../business-logic/treatment-record'
import { TreatmentRecordReadMapper } from '../mappers/read/treatment-record.mapper'
import type { Actor } from '../models/auth'
import { treatmentStatisticsGetRequestSchema } from '../schemas/treatment-record.schema'
import { type DomainError, DomainErrors } from '../shared'
import { actors } from './auth-fixtures'
import { COLOR_ID, CUT_ID } from './booking-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import {
  treatmentFigures,
  treatmentRecordDependencies,
} from './treatment-record-fixtures'

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Whether the repository was asked nothing. */
const untouched = ({
  treatmentRecordRepository,
}: TreatmentRecordUseCaseDependencies): boolean =>
  Object.values(treatmentRecordRepository).every(
    (method) => vi.mocked(method).mock.calls.length === 0,
  )

describe('treatmentStatisticsGetRequestSchema', () => {
  it('takes a salon alone, and a period of one moment', () => {
    expect(
      brokenBy(treatmentStatisticsGetRequestSchema, { salonId: SALON_ID }),
    ).toEqual([])
    expect(
      brokenBy(treatmentStatisticsGetRequestSchema, {
        salonId: SALON_ID,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-01T00:00:00Z',
      }),
    ).toEqual([])
  })

  it('gives the moments back in the spelling of toISOString, and the salon in lower case', () => {
    expect(
      treatmentStatisticsGetRequestSchema.parse({
        salonId: SALON_ID.toUpperCase(),
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T23:59:59.5Z',
      }),
    ).toEqual({
      salonId: SALON_ID,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.500Z',
    })
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no salon', {}, ['salonId:invalid_type']],
    [
      'a salon that is no UUID',
      { salonId: 'salon-1' },
      ['salonId:invalid_format'],
    ],
    [
      'two salons',
      { salonId: [SALON_ID, OTHER_SALON_ID] },
      ['salonId:invalid_type'],
    ],
    [
      'a moment with an offset',
      { salonId: SALON_ID, startDate: '2026-11-01T09:00:00+09:00' },
      ['startDate:invalid_format'],
    ],
    [
      'a day without a time',
      { salonId: SALON_ID, endDate: '2026-11-30' },
      ['endDate:invalid_format'],
    ],
    [
      'an end before the start',
      {
        salonId: SALON_ID,
        startDate: '2026-11-02T00:00:00Z',
        endDate: '2026-11-01T23:59:59.999Z',
      },
      ['endDate:custom'],
    ],
    [
      'a parameter the statistics do not have',
      { salonId: SALON_ID, staffId: SALON_ID },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, query, broken) => {
    expect(brokenBy(treatmentStatisticsGetRequestSchema, query)).toEqual(broken)
  })
})

describe('TreatmentRecordReadMapper.toApiStatistics', () => {
  it('passes the counts on as they were counted, and averages the processing times of the records that state one', () => {
    expect(
      TreatmentRecordReadMapper.toApiStatistics(treatmentFigures()),
    ).toEqual({
      totalTreatments: 3,
      treatmentsByCategory: [
        { category: 'cut', count: 3 },
        { category: 'color', count: 1 },
      ],
      averageProcessingTime: 97.5,
      topServices: [
        { serviceId: CUT_ID, count: 3 },
        { serviceId: COLOR_ID, count: 1 },
      ],
    })
  })

  it.each<[number, number, number]>([
    [120, 1, 120],
    [1, 3, 0.3],
    [2, 3, 0.7],
    [1, 4, 0.3],
    [1, 8, 0.1],
    [3, 8, 0.4],
    [1439, 6, 239.8],
  ])(
    'averages %i minutes over %i records as %d, rounded half up to one decimal',
    (sum, count, average) => {
      expect(
        TreatmentRecordReadMapper.toApiStatistics(
          treatmentFigures({
            processingTimeSum: sum,
            processingTimeCount: count,
          }),
        ).averageProcessingTime,
      ).toBe(average)
    },
  )

  it('has no average when no record states a processing time, and nothing to list without records', () => {
    expect(
      TreatmentRecordReadMapper.toApiStatistics({
        total: 0,
        processingTimeSum: 0,
        processingTimeCount: 0,
        byCategory: [],
        topServices: [],
      }),
    ).toEqual({
      totalTreatments: 0,
      treatmentsByCategory: [],
      averageProcessingTime: null,
      topServices: [],
    })
    expect(
      TreatmentRecordReadMapper.toApiStatistics(
        treatmentFigures({ processingTimeSum: 0, processingTimeCount: 0 }),
      ).averageProcessingTime,
    ).toBeNull()
  })

  it('averages records whose processing time is zero', () => {
    expect(
      TreatmentRecordReadMapper.toApiStatistics(
        treatmentFigures({ processingTimeSum: 0, processingTimeCount: 2 }),
      ).averageProcessingTime,
    ).toBe(0)
  })
})

describe('GetTreatmentStatisticsUseCase', () => {
  const get = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    query: unknown = { salonId: SALON_ID },
  ) => new GetTreatmentStatisticsUseCase(dependencies).execute(actor, query)

  it.each<[string, Actor]>([
    ['an administrator', actors.admin],
    ['an owner', actors.ofSalon('owner')],
    ['a manager', actors.ofSalon('manager')],
    ['a staff member', actors.ofSalon('staff')],
  ])(
    'counts the records of the salon for %s, over every time when no period is named',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      expect(await get(dependencies, actor)).toEqual(
        Result.success(
          TreatmentRecordReadMapper.toApiStatistics(treatmentFigures()),
        ),
      )
      expect(
        dependencies.treatmentRecordRepository.findFigures,
      ).toHaveBeenCalledWith({
        salonId: SALON_ID,
        startDate: null,
        endDate: null,
      })
    },
  )

  it('passes the period in the spelling of toISOString', async () => {
    const dependencies = treatmentRecordDependencies()

    await get(dependencies, actors.ofSalon('manager'), {
      salonId: SALON_ID,
      startDate: '2026-11-01T00:00:00Z',
      endDate: '2026-11-30T23:59:59.9Z',
    })

    expect(
      dependencies.treatmentRecordRepository.findFigures,
    ).toHaveBeenCalledWith({
      salonId: SALON_ID,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.900Z',
    })
  })

  it.each<[string, Actor]>([
    ['a customer', actors.customer],
    ['a customer account without a profile', actors.customerWithoutProfile],
    ['an account of no scope', actors.withoutScope],
  ])('refuses %s before the query is read', async (_who, actor) => {
    const dependencies = treatmentRecordDependencies()

    expect(await get(dependencies, actor, { salonId: 'salon-1' })).toEqual(
      forbidden,
    )
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a query that breaks a rule before anything is counted', async () => {
    const dependencies = treatmentRecordDependencies()

    const result = await get(dependencies, actors.admin, {
      salonId: SALON_ID,
      startDate: 'yesterday',
    })

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid treatment statistics' },
    })
    expect(rulesOf(result)).toEqual(['startDate:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it.each<[string, Actor]>([
    ['an owner', actors.ofSalon('owner')],
    ['a staff member', actors.ofSalon('staff')],
  ])(
    'refuses %s who names another salon before it is looked up',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      expect(
        await get(dependencies, actor, { salonId: OTHER_SALON_ID }),
      ).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('counts another salon for an administrator, and refuses a salon that is not there as the salon named', async () => {
    const dependencies = treatmentRecordDependencies({
      findFigures: vi.fn(async () => Result.success(null)),
    })

    const result = await get(dependencies, actors.admin, {
      salonId: OTHER_SALON_ID,
    })

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation('Invalid treatment statistics', [
          {
            field: 'salonId',
            rule: 'not_found',
            message: 'Must name a salon',
          },
        ]),
      ),
    )
    expect(
      dependencies.treatmentRecordRepository.findFigures,
    ).toHaveBeenCalledWith({
      salonId: OTHER_SALON_ID,
      startDate: null,
      endDate: null,
    })
  })

  it('passes on what the database could not do', async () => {
    expect(
      await get(
        treatmentRecordDependencies({
          findFigures: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })
})
