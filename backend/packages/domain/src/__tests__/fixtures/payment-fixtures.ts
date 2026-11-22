import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { PaymentUseCaseDependencies } from '../../business-logic/payment'
import type {
  ApiPaymentRefundRequest,
  ApiSaleProcessRequest,
} from '../../models/payment'
import type {
  ApiPaymentResponse,
  DbPaymentTransaction,
} from '../../models/sale'
import type {
  IPaymentRepository,
  PaymentRecording,
  PaymentRefunding,
} from '../../repositories/payment.repository'
import { PAYMENT_METHOD_ID } from './payment-method-fixtures'
import { apiPayment, dbPayment } from './sale-fixtures'

export const PAYMENT_NUMBER = 'PT-4H8N-2VWC'

/**
 * A request that satisfies every rule: the whole of the sale of the
 * fixtures, 12,650 yen, taken with a card.
 */
export const saleProcessRequest = (): ApiSaleProcessRequest => ({
  paymentMethodId: PAYMENT_METHOD_ID,
  amount: 12650,
  cardLastFour: '4242',
  cardBrand: 'visa',
})

/** A request that satisfies every rule: the shampoo is taken back. */
export const paymentRefundRequest = (): ApiPaymentRefundRequest => ({
  refundAmount: 5500,
  refundReason: '商品の返品',
})

/** What the refund above leaves of the payment of the fixtures, as stored. */
export const refundedPayment = (): DbPaymentTransaction =>
  dbPayment({
    status: 'partial_refund',
    refundedAt: '2026-11-22 09:00:00.75+09',
    refundAmount: 5500,
    refundReason: '商品の返品',
    updatedAt: '2026-11-22 00:00:00.75+00',
  })

/** The refunded payment above as the API presents it. */
export const apiRefundedPayment = (): ApiPaymentResponse =>
  apiPayment({
    status: 'partial_refund',
    refundedAt: '2026-11-22T00:00:00.750Z',
    refundAmount: 5500,
    refundReason: '商品の返品',
    updatedAt: '2026-11-22T00:00:00.750Z',
  })

/**
 * Everything the payment use cases need: a repository that records the
 * payment of the fixtures for every request and refunds it for every
 * request, and an issuer that always issues the same number; a test
 * overrides what it needs.
 */
export const paymentDependencies = (
  overrides: Partial<IPaymentRepository> = {},
  numbers: string[] = [],
): PaymentUseCaseDependencies => {
  const upcoming = [...numbers]

  return {
    paymentRepository: {
      record: vi.fn(async () =>
        Result.success<PaymentRecording>({
          type: 'recorded',
          payment: dbPayment(),
        }),
      ),
      refund: vi.fn(async () =>
        Result.success<PaymentRefunding>({
          type: 'refunded',
          payment: refundedPayment(),
        }),
      ),
      ...overrides,
    },
    paymentNumberIssuer: {
      issue: vi.fn(() => upcoming.shift() ?? PAYMENT_NUMBER),
    },
  }
}

const REPOSITORY_METHODS: (keyof IPaymentRepository)[] = ['record', 'refund']

/** The methods of the repository that were called, in the order of the calls. */
export const paymentRepositoryCalls = ({
  paymentRepository,
}: PaymentUseCaseDependencies): string[] =>
  REPOSITORY_METHODS.flatMap((name) =>
    vi
      .mocked(paymentRepository[name])
      .mock.invocationCallOrder.map((order) => ({ order, name })),
  )
    .toSorted((a, b) => a.order - b.order)
    .map(({ name }) => name)
