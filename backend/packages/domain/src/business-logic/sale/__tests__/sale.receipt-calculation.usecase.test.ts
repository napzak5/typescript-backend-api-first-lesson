import { Result } from '@beauty-salon-backend/utility'
import { textIn } from '@beauty-salon-shared/i18n'
import {
  entityMessages,
  saleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import {
  BOOKING_ID,
  CUT_ID,
} from '../../../__tests__/fixtures/booking-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiPayment,
  apiSale,
  calculationReferences,
  dbPayment,
  RECEIPT_TIME,
  saleRepositoryCalls as repositoryCalls,
  SALE_ID,
  SALE_NUMBER,
  saleCalculateRequest,
  saleDependencies,
  saleWithDetails,
  TREATMENT_ID,
} from '../../../__tests__/fixtures/sale-fixtures'
import type { Actor } from '../../../models/auth'
import type { SaleWithDetails } from '../../../models/sale'
import type { ISaleRepository } from '../../../repositories/sale.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CalculateSaleUseCase,
  type CalculationReferences,
  GetSaleReceiptUseCase,
  type SaleUseCaseDependencies,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

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

describe('GetSaleReceiptUseCase', () => {
  /** The sale of the fixtures, paid in full with one payment. */
  const paidSale = (): SaleWithDetails =>
    saleWithDetails({ paymentStatus: 'completed' }, undefined, [dbPayment()])

  const finding = (
    sale: SaleWithDetails | null = paidSale(),
  ): Partial<ISaleRepository> => ({
    findById: vi.fn(async () => Result.success(sale)),
  })

  const receipt = (
    dependencies: SaleUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = SALE_ID,
  ) => new GetSaleReceiptUseCase(dependencies).execute(actor, id)

  it('makes the receipt of a paid sale: the sale with its lines and payments, under its number, at the moment it is made', async () => {
    const dependencies = saleDependencies(finding())

    const result = await receipt(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        receiptNumber: SALE_NUMBER,
        sale: apiSale({ paymentStatus: 'completed', payments: [apiPayment()] }),
        issuedAt: '2026-11-20T04:00:00.000Z',
      },
    })
    expect(repositoryCalls(dependencies)).toEqual(['findById'])
  })

  it('makes the receipt again whenever it is asked for, at the moment of each', async () => {
    const dependencies = saleDependencies(finding())
    vi.mocked(dependencies.clock)
      .mockReturnValueOnce(RECEIPT_TIME)
      .mockReturnValueOnce(new Date('2026-11-21T09:30:00.000Z'))

    const first = await receipt(dependencies)
    const second = await receipt(dependencies)

    expect(first).toMatchObject({
      data: {
        receiptNumber: SALE_NUMBER,
        issuedAt: '2026-11-20T04:00:00.000Z',
      },
    })
    expect(second).toMatchObject({
      data: {
        receiptNumber: SALE_NUMBER,
        issuedAt: '2026-11-21T09:30:00.000Z',
      },
    })
    expect(repositoryCalls(dependencies)).toEqual(['findById', 'findById'])
  })

  it('looks an admin up the sale among those of every salon, and a member of a salon among those of that salon', async () => {
    const dependencies = saleDependencies(finding())

    await receipt(dependencies, actors.admin)
    await receipt(dependencies, actors.ofSalon('manager'))
    await receipt(dependencies, actors.ofSalon('staff', OTHER_SALON_ID))

    expect(vi.mocked(dependencies.saleRepository.findById).mock.calls).toEqual([
      [SALE_ID, { type: 'everySalon' }],
      [SALE_ID, { type: 'salon', salonId: SALON_ID }],
      [SALE_ID, { type: 'salon', salonId: OTHER_SALON_ID }],
    ])
  })

  it.each(keepers)('makes the receipt for %s', async (_case, actor) => {
    const result = await receipt(saleDependencies(finding()), actor)

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s without looking anything up, whatever the ID',
    async (_case, actor) => {
      const dependencies = saleDependencies(finding())

      expect(await receipt(dependencies, actor)).toEqual(forbidden)
      expect(await receipt(dependencies, actor, 'not-an-id')).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['a sale number', SALE_NUMBER],
    ['nothing', undefined],
  ])('refuses %s for the ID without looking anything up', async (_case, id) => {
    const dependencies = saleDependencies(finding())

    // Not through the helper: its default would stand in for an ID of undefined.
    const result = await new GetSaleReceiptUseCase(dependencies).execute(
      actors.admin,
      id,
    )

    expect(validationMessageOf(result)).toBe('Invalid sale ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('answers a sale that is not there, or not within the reach, as not found', async () => {
    const result = await receipt(saleDependencies(finding(null)))

    expect(result).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.sale, SALE_ID)),
    )
  })

  it('refuses a void sale', async () => {
    const result = await receipt(
      saleDependencies(
        finding(saleWithDetails({ isVoid: true }, undefined, [dbPayment()])),
      ),
    )

    expect(result).toEqual(
      Result.error(DomainErrors.conflict(saleMessages.voidHasNoReceipt)),
    )
  })

  it('refuses a sale that is not paid in full', async () => {
    const result = await receipt(
      saleDependencies(
        finding(
          saleWithDetails({ paymentStatus: 'processing' }, undefined, [
            dbPayment({ amount: 12649 }),
          ]),
        ),
      ),
    )

    expect(result).toEqual(
      Result.error(DomainErrors.conflict(saleMessages.notPaidInFull)),
    )
  })

  it('tells of the void of a sale that is not paid either', async () => {
    const result = await receipt(
      saleDependencies(finding(saleWithDetails({ isVoid: true }))),
    )

    expect(result).toEqual(
      Result.error(DomainErrors.conflict(saleMessages.voidHasNoReceipt)),
    )
  })

  it('asks the clock nothing for a sale that has no receipt', async () => {
    const dependencies = saleDependencies(finding(saleWithDetails()))

    await receipt(dependencies)

    expect(dependencies.clock).not.toHaveBeenCalled()
  })

  it('passes on a failure of the database', async () => {
    const result = await receipt(
      saleDependencies({ findById: vi.fn(async () => databaseDown) }),
    )

    expect(result).toEqual(databaseDown)
  })

  it('answers a stored sale that does not fit the response with an error of the database', async () => {
    const result = await receipt(
      saleDependencies(
        finding(
          saleWithDetails({ saleTime: 'noon' }, undefined, [dbPayment()]),
        ),
      ),
    )

    expect(result).toEqual({
      type: 'error',
      error: expect.objectContaining({ type: 'database' }),
    })
  })
})

describe('CalculateSaleUseCase', () => {
  const calculate = (
    dependencies: SaleUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    input: unknown = saleCalculateRequest(),
  ) => new CalculateSaleUseCase(dependencies).execute(actor, input)

  const referring = (
    references: Partial<CalculationReferences>,
  ): Partial<ISaleRepository> => ({
    findCalculationReferences: vi.fn(async () =>
      Result.success(calculationReferences(references)),
    ),
  })

  it('tells what the sale would come to, and which kinds of payment method take it', async () => {
    const dependencies = saleDependencies()

    const result = await calculate(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        salonId: SALON_ID,
        bookingId: BOOKING_ID,
        breakdown: {
          subtotal: 12310,
          discountAmount: 300,
          taxAmount: 1201,
          totalAmount: 13211,
        },
        recommendedMethods: ['cash', 'credit_card'],
      },
    })
    expect(repositoryCalls(dependencies)).toEqual(['findCalculationReferences'])
    expect(
      dependencies.saleRepository.findCalculationReferences,
    ).toHaveBeenCalledWith(saleCalculateRequest())
  })

  it.each(keepers)('calculates for %s', async (_case, actor) => {
    const result = await calculate(saleDependencies(), actor)

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s without reading the request',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      expect(await calculate(dependencies, actor)).toEqual(forbidden)
      expect(await calculate(dependencies, actor, {})).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(membersOfAnotherSalon)(
    'refuses %s once the request says which salon it is, without looking anything up',
    async (_case, actor) => {
      const dependencies = saleDependencies()

      expect(await calculate(dependencies, actor)).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('lets an admin calculate for any salon', async () => {
    const dependencies = saleDependencies()

    await calculate(dependencies, actors.admin, {
      ...saleCalculateRequest(),
      salonId: OTHER_SALON_ID,
    })

    expect(
      dependencies.saleRepository.findCalculationReferences,
    ).toHaveBeenCalledWith({
      ...saleCalculateRequest(),
      salonId: OTHER_SALON_ID,
    })
  })

  it('reads the request before it looks at the salon of a member of another salon', async () => {
    const dependencies = saleDependencies()

    const result = await calculate(
      dependencies,
      actors.ofSalon('owner', OTHER_SALON_ID),
      { ...saleCalculateRequest(), services: ['cut'] },
    )

    expect(validationMessageOf(result)).toBe('Invalid calculation')
    expect(rulesOf(result)).toEqual(['services.0:invalid_format'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a request that breaks the rules of its own, without looking anything up', async () => {
    const dependencies = saleDependencies()

    const result = await calculate(dependencies, actors.admin, {
      salonId: SALON_ID,
      discountCode: 'WELCOME10',
    })

    expect(validationMessageOf(result)).toBe('Invalid calculation')
    expect(rulesOf(result).toSorted()).toEqual([
      'bookingId:invalid_type',
      'discountCode:unrecognized_keys',
      'services:invalid_type',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a request that refers to what is not there', async () => {
    const result = await calculate(
      saleDependencies(referring({ booking: null, services: [] })),
      actors.ofSalon('staff'),
      { ...saleCalculateRequest(), services: [TREATMENT_ID, CUT_ID] },
    )

    expect(validationMessageOf(result)).toBe('Invalid calculation')
    expect(rulesOf(result)).toEqual([
      'bookingId:not_found',
      'services.0:not_found',
      'services.1:not_found',
    ])
  })

  it('refuses a request that comes to no line', async () => {
    const result = await calculate(
      saleDependencies(referring({ booking: { lines: [] } })),
      actors.ofSalon('staff'),
      { ...saleCalculateRequest(), services: [] },
    )

    expect(rulesOf(result)).toEqual(['services:too_small'])
  })

  it('passes on a failure of the database', async () => {
    const result = await calculate(
      saleDependencies({
        findCalculationReferences: vi.fn(async () => databaseDown),
      }),
    )

    expect(result).toEqual(databaseDown)
  })
})
