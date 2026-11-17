import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { CustomerAllergyUseCaseDependencies } from '../business-logic/customer-allergy'
import type {
  ApiCustomerAllergyCreateRequest,
  DbCustomerAllergy,
} from '../models/customer-allergy'
import type {
  CustomerAllergyAddition,
  CustomerAllergyChange,
  CustomerAllergyListing,
  CustomerAllergyRemoval,
  ICustomerAllergyRepository,
} from '../repositories/customer-allergy.repository'
import { CUSTOMER_ID, NOW } from './auth-fixtures'

export const CUSTOMER_ALLERGY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6e01'
export const OTHER_CUSTOMER_ALLERGY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6e02'

/** A request that satisfies every rule, with every item written down. */
export const customerAllergyCreateRequest = (
  overrides: Partial<ApiCustomerAllergyCreateRequest> = {},
): ApiCustomerAllergyCreateRequest => ({
  allergyType: 'chemical',
  allergenName: 'パラフェニレンジアミン（PPD）',
  severityType: 'severe',
  symptoms: '頭皮に赤みとかゆみ',
  notes: 'ジアミンを含まないカラー剤を使う',
  confirmedDate: '2025-06-10',
  ...overrides,
})

/** A row of `customer_allergies` as the driver returns it: the allergy above. */
export const dbCustomerAllergy = (
  overrides: Partial<DbCustomerAllergy> = {},
): DbCustomerAllergy => {
  const request = customerAllergyCreateRequest()
  return {
    id: CUSTOMER_ALLERGY_ID,
    customerId: CUSTOMER_ID,
    allergyType: request.allergyType,
    allergenName: request.allergenName,
    severityType: request.severityType,
    symptoms: request.symptoms,
    notes: request.notes,
    confirmedDate: request.confirmedDate,
    createdAt: '2026-11-18 11:00:00.654321+09',
    updatedAt: '2026-11-18 11:15:00+09',
    ...overrides,
  }
}

/**
 * A repository of the customer with the one allergy above, in which every
 * write succeeds; a test overrides what it needs.
 */
const customerAllergyRepositoryWith = (
  overrides: Partial<ICustomerAllergyRepository> = {},
): ICustomerAllergyRepository => ({
  add: vi.fn(async () =>
    Result.success<CustomerAllergyAddition>({
      type: 'added',
      allergy: dbCustomerAllergy(),
    }),
  ),
  update: vi.fn(async () =>
    Result.success<CustomerAllergyChange>({
      type: 'changed',
      allergy: dbCustomerAllergy(),
    }),
  ),
  remove: vi.fn(async () =>
    Result.success<CustomerAllergyRemoval>({ type: 'removed' }),
  ),
  list: vi.fn(async () =>
    Result.success<CustomerAllergyListing>({
      type: 'listed',
      allergies: [dbCustomerAllergy()],
      total: 1,
      hasMore: false,
    }),
  ),
  ...overrides,
})

/** Everything the use cases of the allergies need: the repository above, and `NOW`. */
export const customerAllergyDependencies = (
  allergies: Partial<ICustomerAllergyRepository> = {},
): CustomerAllergyUseCaseDependencies => ({
  customerAllergyRepository: customerAllergyRepositoryWith(allergies),
  clock: () => NOW,
})
