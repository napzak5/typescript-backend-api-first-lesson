import { Result } from '@beauty-salon-backend/utility'
import { treatmentRecordMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  treatmentFigures,
  treatmentRecordDependencies,
} from '../../../__tests__/fixtures/treatment-record-fixtures'
import { TreatmentRecordReadMapper } from '../../../mappers/read/treatment-record.mapper'
import type { Actor } from '../../../models/auth'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  GetTreatmentStatisticsUseCase,
  type TreatmentRecordUseCaseDependencies,
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
  treatmentRecordRepository,
}: TreatmentRecordUseCaseDependencies): boolean =>
  Object.values(treatmentRecordRepository).every(
    (method) => vi.mocked(method).mock.calls.length === 0,
  )

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
      error: {
        type: 'validation',
        message: treatmentRecordMessages.invalidTreatmentStatistics,
      },
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
        DomainErrors.validation(
          treatmentRecordMessages.invalidTreatmentStatistics,
          [
            {
              field: 'salonId',
              rule: 'not_found',
              message: 'Must name a salon',
            },
          ],
        ),
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
