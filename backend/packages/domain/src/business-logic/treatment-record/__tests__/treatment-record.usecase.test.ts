import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  treatmentRecordMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  STAFF_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  BOOKING_ID,
  CUT_ID,
} from '../../../__tests__/fixtures/booking-fixtures'
import {
  brokenRules,
  MADE_UP_HEADLINE,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import { PRODUCT_ID } from '../../../__tests__/fixtures/product-fixtures'
import {
  OTHER_TREATMENT_RECORD_ID,
  storedTreatmentRecord,
  TREATMENT_RECORD_ID,
  treatmentRecordCreateRequest,
  treatmentRecordDependencies,
} from '../../../__tests__/fixtures/treatment-record-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  TreatmentRecordChange,
  TreatmentRecordCreation,
  TreatmentRecordListing,
  TreatmentRecordRemoval,
} from '../../../repositories/treatment-record.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CreateTreatmentRecordUseCase,
  DeleteTreatmentRecordUseCase,
  GetTreatmentRecordUseCase,
  ListTreatmentRecordsUseCase,
  type TreatmentRecordUseCaseDependencies,
  UpdateTreatmentRecordUseCase,
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

const everySalon = { type: 'everySalon' }
const ownSalon = { type: 'salon', salonId: SALON_ID }

/** Everyone who writes and reads the records of the salon of the fixtures. */
const writers: [string, Actor, object][] = [
  ['an administrator', actors.admin, everySalon],
  ['an owner', actors.ofSalon('owner'), ownSalon],
  ['a manager', actors.ofSalon('manager'), ownSalon],
  ['a staff member', actors.ofSalon('staff'), ownSalon],
]

/** Actors who reach no records at all. */
const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

describe('CreateTreatmentRecordUseCase', () => {
  const create = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    input: unknown = treatmentRecordCreateRequest(),
  ) => new CreateTreatmentRecordUseCase(dependencies).execute(actor, input)

  const creating = (outcome: TreatmentRecordCreation) =>
    treatmentRecordDependencies({
      create: vi.fn(async () => Result.success(outcome)),
    })

  it.each(writers)(
    'writes the record within the reach of %s, the materials with two decimals, and answers it as the API shows it',
    async (_who, actor, reach) => {
      const dependencies = treatmentRecordDependencies()

      const result = await create(dependencies, actor)

      expect(result).toMatchObject({
        type: 'success',
        data: {
          id: TREATMENT_RECORD_ID,
          materials: [{ quantity: 80 }, { quantity: 12.25 }],
        },
      })
      expect(
        dependencies.treatmentRecordRepository.create,
      ).toHaveBeenCalledWith({
        reach,
        record: expect.objectContaining({
          bookingId: BOOKING_ID,
          customerId: CUSTOMER_ID,
          staffId: STAFF_ID,
        }),
        materials: [
          expect.objectContaining({ productId: PRODUCT_ID, quantity: '80.00' }),
          expect.objectContaining({ quantity: '12.25' }),
        ],
      })
    },
  )

  it.each(outsiders)(
    'refuses %s before the request is read',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      expect(await create(dependencies, actor, null)).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a request that breaks a rule of its own, before anything is looked for', async () => {
    const dependencies = treatmentRecordDependencies()

    const result = await create(
      dependencies,
      actors.admin,
      treatmentRecordCreateRequest({ services: [], customerSatisfaction: 9 }),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: treatmentRecordMessages.invalidTreatmentRecord,
      },
    })
    expect(rulesOf(result)).toEqual([
      'services:too_small',
      'customerSatisfaction:too_big',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a booking that is not there, or not within the reach, as the booking named', async () => {
    const result = await create(creating({ type: 'bookingNotFound' }))

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(
          treatmentRecordMessages.invalidTreatmentRecord,
          [
            {
              field: 'bookingId',
              rule: 'not_found',
              message: treatmentRecordMessages.aBookingOfASalon,
            },
          ],
        ),
      ),
    )
  })

  it('refuses what the repository found not to fit the booking, as it found it', async () => {
    const issues = [
      {
        field: 'services.0',
        rule: 'not_found',
        message: treatmentRecordMessages.aServiceOfSalonOfBooking,
      },
    ]

    expect(await create(creating({ type: 'refused', issues }))).toEqual(
      Result.error(
        DomainErrors.validation(
          treatmentRecordMessages.invalidTreatmentRecord,
          issues,
        ),
      ),
    )
  })

  it('refuses a booking whose treatment has not begun with a conflict that says its status', async () => {
    expect(
      await create(
        creating({ type: 'bookingNotTreated', status: 'confirmed' }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          treatmentRecordMessages.bookingNotTreated('confirmed'),
        ),
      ),
    )
  })

  it('refuses a booking that has a record already with a conflict', async () => {
    expect(await create(creating({ type: 'recordExists' }))).toEqual(
      Result.error(
        DomainErrors.conflict(treatmentRecordMessages.bookingHasRecord),
      ),
    )
  })

  it('passes on what the database could not do, and a stored row that does not match', async () => {
    const broken = storedTreatmentRecord({ createdAt: 'yesterday' })

    expect(
      await create(
        treatmentRecordDependencies({
          create: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
    expect(
      await create(creating({ type: 'created', record: broken })),
    ).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('GetTreatmentRecordUseCase', () => {
  const get = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = TREATMENT_RECORD_ID,
  ) => new GetTreatmentRecordUseCase(dependencies).execute(actor, id)

  it.each(writers)(
    'finds a record with its materials and photos within the reach of %s',
    async (_who, actor, reach) => {
      const dependencies = treatmentRecordDependencies()

      const result = await get(dependencies, actor)

      expect(result).toMatchObject({
        type: 'success',
        data: { id: TREATMENT_RECORD_ID, materials: [{}, {}], photos: [{}] },
      })
      expect(
        dependencies.treatmentRecordRepository.findById,
      ).toHaveBeenCalledWith(reach, TREATMENT_RECORD_ID)
    },
  )

  it.each(outsiders)(
    'refuses %s before the ID is looked at',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      expect(await get(dependencies, actor, 'not-an-id')).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID', async () => {
    const dependencies = treatmentRecordDependencies()

    const result = await get(dependencies, actors.admin, 'TR-1')

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: treatmentRecordMessages.invalidTreatmentRecordId,
      },
    })
    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find a record that is not there, or not within the reach', async () => {
    const dependencies = treatmentRecordDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    expect(await get(dependencies)).toEqual(
      Result.error(
        DomainErrors.notFound(
          entityMessages.treatmentRecord,
          TREATMENT_RECORD_ID,
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    const dependencies = treatmentRecordDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })
})

describe('ListTreatmentRecordsUseCase', () => {
  const list = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    query: Result<unknown, DomainError> = Result.success({}),
  ) => new ListTreatmentRecordsUseCase(dependencies).execute(actor, query)

  it('lists the records of every salon for an administrator, 20 to a page', async () => {
    const dependencies = treatmentRecordDependencies()

    const result = await list(dependencies)

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: TREATMENT_RECORD_ID }],
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
    expect(dependencies.treatmentRecordRepository.list).toHaveBeenCalledWith({
      reach: everySalon,
      limit: 20,
      after: null,
      salonId: null,
      customerId: null,
      staffId: null,
      startDate: null,
      endDate: null,
    })
  })

  it.each(writers.slice(1))(
    'lists the records of the salon for %s',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      await list(dependencies, actor)

      expect(dependencies.treatmentRecordRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({ reach: ownSalon }),
      )
    },
  )

  it('passes every filter, the moments to the millisecond, and points to the next page from the last record of the page', async () => {
    const dependencies = treatmentRecordDependencies({
      list: vi.fn(async () =>
        Result.success<TreatmentRecordListing>({
          type: 'listed',
          records: [
            storedTreatmentRecord({ id: OTHER_TREATMENT_RECORD_ID }),
            storedTreatmentRecord(),
          ],
          total: 3,
          hasMore: true,
        }),
      ),
    })

    const result = await list(
      dependencies,
      actors.ofSalon('staff'),
      Result.success({
        limit: 2,
        cursor: OTHER_TREATMENT_RECORD_ID,
        salonId: SALON_ID,
        customerId: CUSTOMER_ID,
        staffId: STAFF_ID,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T23:59:59.999Z',
      }),
    )

    expect(dependencies.treatmentRecordRepository.list).toHaveBeenCalledWith({
      reach: ownSalon,
      limit: 2,
      after: OTHER_TREATMENT_RECORD_ID,
      salonId: SALON_ID,
      customerId: CUSTOMER_ID,
      staffId: STAFF_ID,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    })
    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 3,
          limit: 2,
          hasMore: true,
          cursor: OTHER_TREATMENT_RECORD_ID,
          nextCursor: TREATMENT_RECORD_ID,
        },
      },
    })
  })

  it.each(outsiders)(
    'refuses %s before the query is looked at',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      const result = await list(
        dependencies,
        actor,
        Result.error(DomainErrors.validation(MADE_UP_HEADLINE, [])),
      )

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a member of a salon who names another salon, and lists an administrator the salon named', async () => {
    const dependencies = treatmentRecordDependencies()

    expect(
      await list(
        dependencies,
        actors.ofSalon('owner'),
        Result.success({ salonId: OTHER_SALON_ID }),
      ),
    ).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)

    await list(
      dependencies,
      actors.admin,
      Result.success({ salonId: OTHER_SALON_ID }),
    )
    expect(dependencies.treatmentRecordRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ reach: everySalon, salonId: OTHER_SALON_ID }),
    )
  })

  it('passes on a query the caller could not decode, and refuses one that breaks a rule', async () => {
    const undecoded = Result.error(
      DomainErrors.validation(MADE_UP_HEADLINE, [
        { field: 'limit', rule: 'invalid_type', message: MADE_UP_MESSAGE },
      ]),
    )
    const dependencies = treatmentRecordDependencies()

    expect(await list(dependencies, actors.admin, undecoded)).toEqual(undecoded)
    expect(
      rulesOf(
        await list(
          dependencies,
          actors.admin,
          Result.success({
            startDate: '2026-11-02T00:00:00Z',
            endDate: '2026-11-01T00:00:00Z',
          }),
        ),
      ),
    ).toEqual(['endDate:custom'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a cursor that names no record of the list', async () => {
    const dependencies = treatmentRecordDependencies({
      list: vi.fn(async () =>
        Result.success<TreatmentRecordListing>({ type: 'cursorNotFound' }),
      ),
    })

    const result = await list(
      dependencies,
      actors.admin,
      Result.success({ cursor: OTHER_TREATMENT_RECORD_ID }),
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(
          treatmentRecordMessages.invalidTreatmentRecordSearch,
          [
            {
              field: 'cursor',
              rule: 'not_found',
              message: treatmentRecordMessages.aTreatmentRecordOfList,
            },
          ],
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    const dependencies = treatmentRecordDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })
})

describe('UpdateTreatmentRecordUseCase', () => {
  const update = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    input: unknown = { resultNotes: '色が落ち着いた' },
    id: unknown = TREATMENT_RECORD_ID,
  ) => new UpdateTreatmentRecordUseCase(dependencies).execute(actor, id, input)

  const changing = (outcome: TreatmentRecordChange) =>
    treatmentRecordDependencies({
      update: vi.fn(async () => Result.success(outcome)),
    })

  it.each(writers)(
    'changes what the request names within the reach of %s, and keeps the materials it does not name',
    async (_who, actor, reach) => {
      const dependencies = treatmentRecordDependencies()

      const result = await update(dependencies, actor)

      expect(result).toMatchObject({
        type: 'success',
        data: { id: TREATMENT_RECORD_ID },
      })
      expect(
        dependencies.treatmentRecordRepository.update,
      ).toHaveBeenCalledWith(reach, TREATMENT_RECORD_ID, {
        changes: { resultNotes: '色が落ち着いた' },
        materials: null,
      })
    },
  )

  it('replaces the materials with those the request names', async () => {
    const dependencies = treatmentRecordDependencies()

    await update(dependencies, actors.admin, {
      services: [CUT_ID],
      materials: [
        {
          productId: PRODUCT_ID,
          quantity: 3,
          unit: 'g',
          lotNumber: null,
          notes: null,
        },
      ],
    })

    expect(dependencies.treatmentRecordRepository.update).toHaveBeenCalledWith(
      everySalon,
      TREATMENT_RECORD_ID,
      {
        changes: { services: [CUT_ID] },
        materials: [
          {
            productId: PRODUCT_ID,
            quantity: '3.00',
            unit: 'g',
            lotNumber: null,
            notes: null,
          },
        ],
      },
    )
  })

  it.each(outsiders)(
    'refuses %s before the ID and the request are looked at',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      expect(await update(dependencies, actor, null, 'not-an-id')).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID before the request, and a request that breaks a rule of its own', async () => {
    const dependencies = treatmentRecordDependencies()

    expect(
      rulesOf(await update(dependencies, actors.admin, {}, 'TR-1')),
    ).toEqual(['id:invalid_format'])
    expect(rulesOf(await update(dependencies, actors.admin, {}))).toEqual([
      ':custom',
    ])
    expect(
      rulesOf(
        await update(dependencies, actors.admin, { bookingId: BOOKING_ID }),
      ),
    ).toEqual(['bookingId:unrecognized_keys'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find a record that is not there, or not within the reach', async () => {
    expect(await update(changing({ type: 'notFound' }))).toEqual(
      Result.error(
        DomainErrors.notFound(
          entityMessages.treatmentRecord,
          TREATMENT_RECORD_ID,
        ),
      ),
    )
  })

  it('refuses what the repository found not to fit the booking, as it found it', async () => {
    const issues = [
      {
        field: 'materials.0.productId',
        rule: 'not_found',
        message: treatmentRecordMessages.aProductOfSalonOfBooking,
      },
    ]

    expect(await update(changing({ type: 'refused', issues }))).toEqual(
      Result.error(
        DomainErrors.validation(
          treatmentRecordMessages.invalidTreatmentRecord,
          issues,
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    expect(
      await update(
        treatmentRecordDependencies({
          update: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })
})

describe('DeleteTreatmentRecordUseCase', () => {
  const remove = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = TREATMENT_RECORD_ID,
  ) => new DeleteTreatmentRecordUseCase(dependencies).execute(actor, id)

  it.each<[string, Actor, object]>([
    ['an administrator', actors.admin, everySalon],
    ['an owner', actors.ofSalon('owner'), ownSalon],
    ['a manager', actors.ofSalon('manager'), ownSalon],
  ])(
    'removes a record within the reach of %s, and answers its ID',
    async (_who, actor, reach) => {
      const dependencies = treatmentRecordDependencies()

      expect(await remove(dependencies, actor)).toEqual(
        Result.success(TREATMENT_RECORD_ID),
      )
      expect(
        dependencies.treatmentRecordRepository.delete,
      ).toHaveBeenCalledWith(reach, TREATMENT_RECORD_ID)
    },
  )

  it.each<[string, Actor]>([
    [
      'a staff member, who writes records but does not remove them',
      actors.ofSalon('staff'),
    ],
    ...outsiders,
  ])('refuses %s before the ID is looked at', async (_who, actor) => {
    const dependencies = treatmentRecordDependencies()

    expect(await remove(dependencies, actor, 'not-an-id')).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses an ID that is no UUID', async () => {
    const dependencies = treatmentRecordDependencies()

    expect(rulesOf(await remove(dependencies, actors.admin, 'TR-1'))).toEqual([
      'id:invalid_format',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find a record that is not there, or not within the reach', async () => {
    const dependencies = treatmentRecordDependencies({
      delete: vi.fn(async () =>
        Result.success<TreatmentRecordRemoval>({ type: 'notFound' }),
      ),
    })

    expect(await remove(dependencies)).toEqual(
      Result.error(
        DomainErrors.notFound(
          entityMessages.treatmentRecord,
          TREATMENT_RECORD_ID,
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    expect(
      await remove(
        treatmentRecordDependencies({
          delete: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })
})
