import { Result } from '@beauty-salon-backend/utility'
import { paymentMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiRefundedPayment,
  PAYMENT_NUMBER,
  paymentDependencies,
  paymentRefundRequest,
  refundedPayment,
  paymentRepositoryCalls as repositoryCalls,
  saleProcessRequest,
} from '../../../__tests__/fixtures/payment-fixtures'
import { PAYMENT_METHOD_ID } from '../../../__tests__/fixtures/payment-method-fixtures'
import {
  apiPayment,
  dbPayment,
  PAYMENT_ID,
  SALE_ID,
  SALE_NUMBER,
} from '../../../__tests__/fixtures/sale-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  IPaymentRepository,
  PaymentRecording,
  PaymentRefunding,
} from '../../../repositories/payment.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import {
  type PaymentUseCaseDependencies,
  RecordPaymentUseCase,
  RefundPaymentUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({
    type: 'database',
    message: `Stored payment ${PAYMENT_ID} does not match the API model`,
  }),
}

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** The message of a failed validation; null for anything else. */
const validationMessageOf = (
  result: Result<unknown, DomainError>,
): string | null =>
  result.type === 'error' && result.error.type === 'validation'
    ? toldIn(result.error.message, 'en')
    : null

/** A payment whose time cannot be turned into a response. */
const corruptPayment = dbPayment({ createdAt: 'then' })

/** Those the ledger is closed to. */
const notKeepers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

const everySalon = { type: 'everySalon' }
const ownSalon = { type: 'salon', salonId: SALON_ID }
const otherSalon = { type: 'salon', salonId: OTHER_SALON_ID }

describe('RecordPaymentUseCase', () => {
  const origin = { transactionNumber: PAYMENT_NUMBER }

  const record = (
    dependencies: PaymentUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = SALE_ID,
    input: unknown = saleProcessRequest(),
  ) => new RecordPaymentUseCase(dependencies).execute(actor, id, input)

  /** A repository that answers the calls with these outcomes, the last one for all that follow. */
  const recording = (
    ...outcomes: PaymentRecording[]
  ): Partial<IPaymentRepository> => {
    const upcoming = [...outcomes]
    const last = outcomes.at(-1)

    return {
      record: vi.fn(async () =>
        Result.success<PaymentRecording>(
          upcoming.shift() ?? last ?? { type: 'notFound' },
        ),
      ),
    }
  }

  const recorded: PaymentRecording = { type: 'recorded', payment: dbPayment() }
  const taken: PaymentRecording = { type: 'transactionNumberTaken' }

  it('records the payment and returns it as it is stored', async () => {
    const dependencies = paymentDependencies()

    const result = await record(dependencies)

    expect(result).toEqual({ type: 'success', data: apiPayment() })
    expect(repositoryCalls(dependencies)).toEqual(['record'])
  })

  it('hands the request on with the number of the payment', async () => {
    const dependencies = paymentDependencies()

    await record(dependencies, actors.admin)

    expect(dependencies.paymentRepository.record).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
      saleProcessRequest(),
      origin,
    )
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
    ['the staff', actors.ofSalon('staff')],
  ])(
    'looks for the sale %s of a salon takes a payment for among those of that salon',
    async (_case, actor) => {
      const dependencies = paymentDependencies()

      await record(dependencies, actor)

      expect(dependencies.paymentRepository.record).toHaveBeenCalledWith(
        SALE_ID,
        ownSalon,
        saleProcessRequest(),
        origin,
      )
    },
  )

  it.each([
    ['the owner', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['the manager', actors.ofSalon('manager', OTHER_SALON_ID)],
    ['the staff', actors.ofSalon('staff', OTHER_SALON_ID)],
  ])(
    'looks for the sale %s of another salon takes a payment for among those of their own salon',
    async (_case, actor) => {
      const dependencies = paymentDependencies()

      await record(dependencies, actor)

      expect(dependencies.paymentRepository.record).toHaveBeenCalledWith(
        SALE_ID,
        otherSalon,
        saleProcessRequest(),
        origin,
      )
    },
  )

  it.each(notKeepers)(
    'refuses %s without reading the request, whatever the ID',
    async (_case, actor) => {
      const dependencies = paymentDependencies()

      expect(await record(dependencies, actor)).toEqual(forbidden)
      expect(await record(dependencies, actor, 'not-an-id', null)).toEqual(
        forbidden,
      )
      expect(repositoryCalls(dependencies)).toEqual([])
      expect(dependencies.paymentNumberIssuer.issue).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['a sale number', SALE_NUMBER],
    ['nothing', undefined],
  ])('refuses %s for the ID without looking anything up', async (_case, id) => {
    const dependencies = paymentDependencies()

    const result = await new RecordPaymentUseCase(dependencies).execute(
      actors.admin,
      id,
      saleProcessRequest(),
    )

    expect(validationMessageOf(result)).toBe('Invalid sale ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(rulesOf(result)[0]).toMatch(/^id:/)
    expect(repositoryCalls(dependencies)).toEqual([])
    expect(dependencies.paymentNumberIssuer.issue).not.toHaveBeenCalled()
  })

  it('says what is wrong with the ID before it reads the request', async () => {
    const result = await record(
      paymentDependencies(),
      actors.admin,
      'not-an-id',
      {},
    )

    expect(validationMessageOf(result)).toBe('Invalid sale ID')
  })

  it.each<[string, unknown, string[]]>([
    [
      'a request without the amount',
      {
        paymentMethodId: PAYMENT_METHOD_ID,
        cardLastFour: null,
        cardBrand: null,
      },
      ['amount:invalid_type'],
    ],
    [
      'an amount of nothing',
      { ...saleProcessRequest(), amount: 0 },
      ['amount:too_small'],
    ],
    [
      'a payment method that is no ID',
      { ...saleProcessRequest(), paymentMethodId: 'cash' },
      ['paymentMethodId:invalid_format'],
    ],
    [
      'three digits of a card',
      { ...saleProcessRequest(), cardLastFour: '424' },
      ['cardLastFour:invalid_format'],
    ],
    [
      'a brand that says nothing',
      { ...saleProcessRequest(), cardBrand: ' ' },
      ['cardBrand:invalid_format'],
    ],
    [
      'a request that states the status of the payment',
      { ...saleProcessRequest(), status: 'failed' },
      ['status:unrecognized_keys'],
    ],
    ['null for the request', null, [':invalid_type']],
    ['a list for the request', [], [':invalid_type']],
  ])('refuses %s without looking anything up', async (_case, input, rules) => {
    const dependencies = paymentDependencies()

    const result = await record(dependencies, actors.admin, SALE_ID, input)

    expect(validationMessageOf(result)).toBe('Invalid payment')
    expect(rulesOf(result)).toEqual(rules)
    expect(repositoryCalls(dependencies)).toEqual([])
    expect(dependencies.paymentNumberIssuer.issue).not.toHaveBeenCalled()
  })

  it('looks the sale and the payment method up by their IDs in lower case', async () => {
    const dependencies = paymentDependencies()

    await record(dependencies, actors.admin, SALE_ID.toUpperCase(), {
      ...saleProcessRequest(),
      paymentMethodId: PAYMENT_METHOD_ID.toUpperCase(),
    })

    expect(dependencies.paymentRepository.record).toHaveBeenCalledWith(
      SALE_ID,
      everySalon,
      saleProcessRequest(),
      origin,
    )
  })

  it('reports a sale the actor does not reach as one that does not exist', async () => {
    expect(
      await record(paymentDependencies(recording({ type: 'notFound' }))),
    ).toEqual(Result.error(DomainErrors.notFound('Sale', SALE_ID)))
  })

  it('names the sale that is not there by the ID in lower case', async () => {
    expect(
      await record(
        paymentDependencies(recording({ type: 'notFound' })),
        actors.admin,
        SALE_ID.toUpperCase(),
      ),
    ).toEqual(Result.error(DomainErrors.notFound('Sale', SALE_ID)))
  })

  it.each<[string, PaymentRecording, string]>([
    [
      'a void sale',
      { type: 'void' },
      'The sale is void; a void sale takes no payment',
    ],
    [
      'a sale of which a payment was refunded',
      { type: 'refundMade' },
      'A payment of the sale was refunded; a sale with a refund takes no further payment',
    ],
    [
      'a sale that is paid',
      { type: 'nothingLeft' },
      'Nothing is left to pay of the sale',
    ],
  ])('reports %s as a conflict', async (_case, outcome, message) => {
    expect(await record(paymentDependencies(recording(outcome)))).toEqual({
      type: 'error',
      error: { type: 'conflict', message },
    })
  })

  it('reports what the sale and the payment method do not take as a broken rule', async () => {
    const issues = [
      {
        field: 'paymentMethodId',
        rule: 'not_found',
        message: paymentMessages.anActivePaymentMethodOfSalonOfSale,
      },
      {
        field: 'amount',
        rule: 'too_big',
        message: paymentMessages.notMoreThanLeftToPay(100),
      },
    ]

    expect(
      await record(paymentDependencies(recording({ type: 'invalid', issues }))),
    ).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: paymentMessages.invalidPayment,
        issues,
      },
    })
  })

  it('does not try again after a refusal that another number would not change', async () => {
    const refusals: PaymentRecording[] = [
      { type: 'notFound' },
      { type: 'void' },
      { type: 'refundMade' },
      { type: 'nothingLeft' },
      { type: 'invalid', issues: [] },
    ]

    for (const refusal of refusals) {
      const dependencies = paymentDependencies(recording(refusal))

      await record(dependencies)

      expect(repositoryCalls(dependencies)).toEqual(['record'])
      expect(dependencies.paymentNumberIssuer.issue).toHaveBeenCalledTimes(1)
    }
  })

  it('tries another number when a payment has the one that was issued', async () => {
    const dependencies = paymentDependencies(recording(taken, recorded), [
      'PT-0000-0001',
      'PT-0000-0002',
    ])

    const result = await record(dependencies)

    expect(result).toEqual({ type: 'success', data: apiPayment() })
    expect(
      vi
        .mocked(dependencies.paymentRepository.record)
        .mock.calls.map(([, , , { transactionNumber }]) => transactionNumber),
    ).toEqual(['PT-0000-0001', 'PT-0000-0002'])
  })

  it('tries a third number', async () => {
    const dependencies = paymentDependencies(recording(taken, taken, recorded))

    const result = await record(dependencies)

    expect(result.type).toBe('success')
    expect(repositoryCalls(dependencies)).toEqual([
      'record',
      'record',
      'record',
    ])
    expect(dependencies.paymentNumberIssuer.issue).toHaveBeenCalledTimes(3)
  })

  it('gives up after three numbers that were all taken', async () => {
    const dependencies = paymentDependencies(recording(taken))

    const result = await record(dependencies)

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'No payment number that is free was found in 3 attempts',
        cause: null,
      },
    })
    expect(repositoryCalls(dependencies)).toEqual([
      'record',
      'record',
      'record',
    ])
  })

  it('reports a failure of the database and does not try again', async () => {
    const dependencies = paymentDependencies({
      record: vi.fn(async () => databaseDown),
    })

    expect(await record(dependencies)).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['record'])
  })

  it('reports a stored payment that cannot be presented as a fault of the database', async () => {
    const dependencies = paymentDependencies(
      recording({ type: 'recorded', payment: corruptPayment }),
    )

    expect(await record(dependencies)).toEqual(storedRowIsCorrupt)
    expect(repositoryCalls(dependencies)).toEqual(['record'])
  })

  it('never refunds', async () => {
    const dependencies = paymentDependencies()

    await record(dependencies)

    expect(dependencies.paymentRepository.refund).not.toHaveBeenCalled()
  })
})

describe('RefundPaymentUseCase', () => {
  const refund = (
    dependencies: PaymentUseCaseDependencies,
    actor: Actor = actors.ofSalon('manager'),
    id: unknown = PAYMENT_ID,
    input: unknown = paymentRefundRequest(),
  ) => new RefundPaymentUseCase(dependencies).execute(actor, id, input)

  const refunding = (
    outcome: PaymentRefunding,
  ): Partial<IPaymentRepository> => ({
    refund: vi.fn(async () => Result.success(outcome)),
  })

  it('refunds the payment and returns it as it is afterwards', async () => {
    const dependencies = paymentDependencies()

    const result = await refund(dependencies)

    expect(result).toEqual({ type: 'success', data: apiRefundedPayment() })
    expect(repositoryCalls(dependencies)).toEqual(['refund'])
  })

  it('lets an admin refund a payment of a sale of any salon', async () => {
    const dependencies = paymentDependencies()

    await refund(dependencies, actors.admin)

    expect(dependencies.paymentRepository.refund).toHaveBeenCalledWith(
      PAYMENT_ID,
      everySalon,
      paymentRefundRequest(),
    )
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
  ])(
    'looks for the payment %s of a salon refunds among those of the sales of that salon',
    async (_case, actor) => {
      const dependencies = paymentDependencies()

      await refund(dependencies, actor)

      expect(dependencies.paymentRepository.refund).toHaveBeenCalledWith(
        PAYMENT_ID,
        ownSalon,
        paymentRefundRequest(),
      )
    },
  )

  it.each([
    ['the owner', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['the manager', actors.ofSalon('manager', OTHER_SALON_ID)],
  ])(
    'looks for the payment %s of another salon refunds among those of the sales of their own salon',
    async (_case, actor) => {
      const dependencies = paymentDependencies()

      await refund(dependencies, actor)

      expect(dependencies.paymentRepository.refund).toHaveBeenCalledWith(
        PAYMENT_ID,
        otherSalon,
        paymentRefundRequest(),
      )
    },
  )

  it.each([
    ['the staff of the salon, who take a payment', actors.ofSalon('staff')],
    ['the staff of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
    ...notKeepers,
  ])(
    'refuses %s without reading the request, whatever the ID',
    async (_case, actor) => {
      const dependencies = paymentDependencies()

      expect(await refund(dependencies, actor)).toEqual(forbidden)
      expect(await refund(dependencies, actor, 'not-an-id', null)).toEqual(
        forbidden,
      )
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('hands null on for a refund of which no reason is kept', async () => {
    const dependencies = paymentDependencies()

    await refund(dependencies, actors.admin, PAYMENT_ID, {
      refundAmount: 12650,
      refundReason: null,
    })

    expect(dependencies.paymentRepository.refund).toHaveBeenCalledWith(
      PAYMENT_ID,
      everySalon,
      { refundAmount: 12650, refundReason: null },
    )
  })

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['a payment number', PAYMENT_NUMBER],
    ['nothing', undefined],
  ])('refuses %s for the ID without looking anything up', async (_case, id) => {
    const dependencies = paymentDependencies()

    const result = await new RefundPaymentUseCase(dependencies).execute(
      actors.admin,
      id,
      paymentRefundRequest(),
    )

    expect(validationMessageOf(result)).toBe('Invalid payment ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(rulesOf(result)[0]).toMatch(/^id:/)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('says what is wrong with the ID before it reads the request', async () => {
    const result = await refund(
      paymentDependencies(),
      actors.admin,
      'not-an-id',
      {},
    )

    expect(validationMessageOf(result)).toBe('Invalid payment ID')
  })

  it.each<[string, unknown, string[]]>([
    [
      'a request without the amount',
      { refundReason: null },
      ['refundAmount:invalid_type'],
    ],
    [
      'a request without the reason',
      { refundAmount: 5500 },
      ['refundReason:invalid_type'],
    ],
    [
      'a refund of nothing',
      { refundAmount: 0, refundReason: null },
      ['refundAmount:too_small'],
    ],
    [
      'a reason that says nothing',
      { refundAmount: 5500, refundReason: ' ' },
      ['refundReason:invalid_format'],
    ],
    [
      'a request that states the status of the payment',
      { ...paymentRefundRequest(), status: 'refunded' },
      ['status:unrecognized_keys'],
    ],
    ['null for the request', null, [':invalid_type']],
    ['a list for the request', [], [':invalid_type']],
  ])('refuses %s without looking anything up', async (_case, input, rules) => {
    const dependencies = paymentDependencies()

    const result = await refund(dependencies, actors.admin, PAYMENT_ID, input)

    expect(validationMessageOf(result)).toBe('Invalid refund')
    expect(rulesOf(result)).toEqual(rules)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a payment the actor does not reach as one that does not exist', async () => {
    expect(
      await refund(paymentDependencies(refunding({ type: 'notFound' }))),
    ).toEqual(Result.error(DomainErrors.notFound('Payment', PAYMENT_ID)))
  })

  it('looks the payment up, and names the one that is not there, by the ID in lower case', async () => {
    const dependencies = paymentDependencies(refunding({ type: 'notFound' }))

    const result = await refund(
      dependencies,
      actors.admin,
      PAYMENT_ID.toUpperCase(),
    )

    expect(dependencies.paymentRepository.refund).toHaveBeenCalledWith(
      PAYMENT_ID,
      everySalon,
      paymentRefundRequest(),
    )
    expect(result).toEqual(
      Result.error(DomainErrors.notFound('Payment', PAYMENT_ID)),
    )
  })

  it('reports a payment that is not completed as a conflict', async () => {
    expect(
      await refund(paymentDependencies(refunding({ type: 'notCompleted' }))),
    ).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'Only a payment that is completed is refunded; a payment is refunded once',
      },
    })
  })

  it('reports more than the payment received as a broken rule', async () => {
    const issues = [
      {
        field: 'refundAmount',
        rule: 'too_big',
        message: paymentMessages.notMoreThanAmountOfPayment(5000),
      },
    ]

    expect(
      await refund(paymentDependencies(refunding({ type: 'invalid', issues }))),
    ).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: paymentMessages.invalidRefund,
        issues,
      },
    })
  })

  it('reports a failure of the database', async () => {
    const dependencies = paymentDependencies({
      refund: vi.fn(async () => databaseDown),
    })

    expect(await refund(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored payment that cannot be presented as a fault of the database', async () => {
    expect(
      await refund(
        paymentDependencies(
          refunding({ type: 'refunded', payment: corruptPayment }),
        ),
      ),
    ).toEqual(storedRowIsCorrupt)
  })

  it('returns the payment the repository refunded, not the one it was asked for', async () => {
    const stored = { ...refundedPayment(), refundReason: null }

    expect(
      await refund(
        paymentDependencies(refunding({ type: 'refunded', payment: stored })),
      ),
    ).toEqual({
      type: 'success',
      data: { ...apiRefundedPayment(), refundReason: null },
    })
  })

  it('never records a payment and issues no number', async () => {
    const dependencies = paymentDependencies()

    await refund(dependencies)

    expect(dependencies.paymentRepository.record).not.toHaveBeenCalled()
    expect(dependencies.paymentNumberIssuer.issue).not.toHaveBeenCalled()
  })
})
