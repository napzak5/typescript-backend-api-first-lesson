import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { PaymentMethodUseCaseDependencies } from '../../business-logic/payment-method'
import type {
  ApiPaymentMethodCreateRequest,
  DbPaymentMethod,
} from '../../models/payment-method'
import type {
  IPaymentMethodRepository,
  PaymentMethodRemoval,
  PaymentMethodUpdate,
} from '../../repositories/payment-method.repository'
import type { ISalonRepository } from '../../repositories/salon.repository'
import { SALON_ID, salonRepositoryWith } from './fixtures'

export const PAYMENT_METHOD_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'
export const OTHER_PAYMENT_METHOD_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e02'

/** A request that satisfies every rule: a card terminal with a fee and limits. */
export const paymentMethodCreateRequest =
  (): ApiPaymentMethodCreateRequest => ({
    method: 'credit_card',
    displayName: 'クレジットカード',
    description: 'Visa, Mastercard, JCB',
    processorName: 'Stripe',
    fee: 3.6,
    minimumAmount: 1000,
    maximumAmount: 500000,
    isOnlineEnabled: true,
    isOfflineEnabled: true,
    sortOrder: 2,
    isActive: true,
  })

/** A row of `payment_methods` as the driver returns it. */
export const dbPaymentMethod = (
  overrides: Partial<DbPaymentMethod> = {},
): DbPaymentMethod => ({
  id: PAYMENT_METHOD_ID,
  salonId: SALON_ID,
  method: 'credit_card',
  displayName: 'クレジットカード',
  description: null,
  processorName: 'Stripe',
  processorConfig: { terminal: 'kept out of every response' },
  fee: '3.60',
  minimumAmount: 1000,
  maximumAmount: null,
  isOnlineEnabled: false,
  isOfflineEnabled: true,
  sortOrder: 2,
  isActive: true,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

/**
 * A repository that holds the one payment method above, in which every
 * write succeeds; a test overrides what it needs.
 */
const paymentMethodRepositoryWith = (
  overrides: Partial<IPaymentMethodRepository> = {},
): IPaymentMethodRepository => ({
  create: vi.fn(async () => Result.success(dbPaymentMethod())),
  findById: vi.fn(async () => Result.success(dbPaymentMethod())),
  list: vi.fn(async () =>
    Result.success({
      paymentMethods: [dbPaymentMethod()],
      total: 1,
      hasMore: false,
    }),
  ),
  update: vi.fn(async () =>
    Result.success<PaymentMethodUpdate>({
      type: 'updated',
      paymentMethod: dbPaymentMethod(),
    }),
  ),
  delete: vi.fn(async () =>
    Result.success<PaymentMethodRemoval>({ type: 'deleted' }),
  ),
  ...overrides,
})

/**
 * Everything the payment method use cases need: the repository above and a
 * salon repository in which the salon exists.
 */
export const paymentMethodDependencies = (
  paymentMethods: Partial<IPaymentMethodRepository> = {},
  salons: Partial<ISalonRepository> = {},
): PaymentMethodUseCaseDependencies => ({
  paymentMethodRepository: paymentMethodRepositoryWith(paymentMethods),
  salonRepository: salonRepositoryWith(salons),
})
