import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { CustomerUseCaseDependencies } from '../business-logic/customer'
import type {
  ApiCustomerCreateRequest,
  ApiCustomerProfileCreateRequest,
  ApiCustomerProfileResponse,
  ApiCustomerResponse,
  DbCustomer,
} from '../models/customer'
import type {
  CustomerBulkCreation,
  CustomerBulkDeletion,
  CustomerBulkUpdate,
  CustomerCreation,
  CustomerDeletion,
  CustomerProfileCreation,
  CustomerUpdate,
  ICustomerRepository,
} from '../repositories/customer.repository'
import { CUSTOMER_ID, NOW } from './auth-fixtures'

/** A customer who referred the customer of the fixtures. */
export const REFERRER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1c01'

/** Another customer of the ledger. */
export const OTHER_CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1c02'

/**
 * A request that satisfies every rule and sets every property that may be
 * unset: the customer was referred by `REFERRER_ID`.
 */
export const customerCreateRequest = (): ApiCustomerCreateRequest => ({
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  email: 'hanako.yamada@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: '03-1234-5678',
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: 'アオヤマビル 5F',
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: 'デザイナー',
  membershipTier: 'gold',
  preferences: { preferredServices: ['cut', 'color'], notes: '静かな席を希望' },
  notes: '前髪は短めが好み',
  internalNotes: 'カラー剤でかぶれたことがある',
  tags: ['regular', 'color'],
  referredBy: REFERRER_ID,
  referralCode: 'HANAKO2026',
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  isActive: true,
  hairType: 'wavy',
  hairThickness: 'medium',
  scalpCondition: 'sensitive',
  customerStatus: 'active',
})

/**
 * A request of a customer for their own profile that satisfies every rule
 * and sets every property that may be unset.
 */
export const customerProfileCreateRequest =
  (): ApiCustomerProfileCreateRequest => ({
    firstName: '花子',
    lastName: '山田',
    firstNameKana: 'ハナコ',
    lastNameKana: 'ヤマダ',
    phoneNumber: '090-1234-5678',
    alternativePhone: '03-1234-5678',
    postalCode: '107-0062',
    prefecture: '東京都',
    city: '港区',
    address: '南青山1-2-3',
    building: 'アオヤマビル 5F',
    birthDate: '1990-04-01',
    gender: 'female',
    occupation: 'デザイナー',
    preferences: {
      preferredServices: ['cut', 'color'],
      notes: '静かな席を希望',
    },
    allowMarketing: true,
    allowSms: false,
    allowEmail: true,
  })

/** A row of `customers` as the driver returns it: the customer `CUSTOMER_ID`. */
export const dbCustomer = (
  overrides: Partial<DbCustomer> = {},
): DbCustomer => ({
  id: CUSTOMER_ID,
  userId: null,
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: null,
  email: 'hanako.yamada@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: null,
  building: null,
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: null,
  membershipTier: 'gold',
  loyaltyPoints: 120,
  preferences: { preferredServices: ['cut'], notes: null },
  notes: null,
  internalNotes: 'カラー剤でかぶれたことがある',
  tags: ['regular'],
  referredBy: REFERRER_ID,
  referralCode: 'HANAKO2026',
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  firstVisitDate: '2026-01-10',
  lastVisitDate: '2026-11-01',
  visitCount: 7,
  noShowCount: 1,
  cancellationCount: 2,
  isActive: true,
  deletedAt: null,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  hairType: 'wavy',
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
  ...overrides,
})

/** The row of `dbCustomer()` as the API presents it. */
export const apiCustomer = (
  overrides: Partial<ApiCustomerResponse> = {},
): ApiCustomerResponse => ({
  id: CUSTOMER_ID,
  userId: null,
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: null,
  email: 'hanako.yamada@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: null,
  building: null,
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: null,
  membershipTier: 'gold',
  loyaltyPoints: 120,
  preferences: { preferredServices: ['cut'], notes: null },
  notes: null,
  internalNotes: 'カラー剤でかぶれたことがある',
  tags: ['regular'],
  referredBy: REFERRER_ID,
  referralCode: 'HANAKO2026',
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  firstVisitDate: '2026-01-10',
  lastVisitDate: '2026-11-01',
  visitCount: 7,
  noShowCount: 1,
  cancellationCount: 2,
  isActive: true,
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
  hairType: 'wavy',
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
  ...overrides,
})

/** The row of `dbCustomer()` as the customer sees it: their own profile. */
export const apiCustomerProfile = (
  overrides: Partial<ApiCustomerProfileResponse> = {},
): ApiCustomerProfileResponse => ({
  id: CUSTOMER_ID,
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: null,
  email: 'hanako.yamada@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: null,
  building: null,
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: null,
  membershipTier: 'gold',
  loyaltyPoints: 120,
  preferences: { preferredServices: ['cut'], notes: null },
  referralCode: 'HANAKO2026',
  firstVisitDate: '2026-01-10',
  lastVisitDate: '2026-11-01',
  visitCount: 7,
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
  hairType: 'wavy',
  hairThickness: null,
  scalpCondition: null,
  ...overrides,
})

/**
 * A repository that holds the one customer above, in which every write
 * succeeds; a test overrides what it needs.
 */
const customerRepositoryWith = (
  overrides: Partial<ICustomerRepository> = {},
): ICustomerRepository => ({
  create: vi.fn(async () =>
    Result.success<CustomerCreation>({
      type: 'created',
      customer: dbCustomer(),
    }),
  ),
  findById: vi.fn(async () => Result.success(dbCustomer())),
  list: vi.fn(async () =>
    Result.success({ customers: [dbCustomer()], total: 1, hasMore: false }),
  ),
  update: vi.fn(async () =>
    Result.success<CustomerUpdate>({
      type: 'updated',
      customer: dbCustomer(),
    }),
  ),
  delete: vi.fn(async () =>
    Result.success<CustomerDeletion>({ type: 'deleted' }),
  ),
  findByIds: vi.fn(async () => Result.success([dbCustomer()])),
  createMany: vi.fn(async () =>
    Result.success<CustomerBulkCreation>({
      type: 'created',
      customers: [dbCustomer()],
    }),
  ),
  updateMany: vi.fn(async () =>
    Result.success<CustomerBulkUpdate>({
      type: 'updated',
      customers: [dbCustomer()],
    }),
  ),
  deleteMany: vi.fn(async () =>
    Result.success<CustomerBulkDeletion>({ type: 'deleted' }),
  ),
  createProfile: vi.fn(async () =>
    Result.success<CustomerProfileCreation>({
      type: 'created',
      customer: dbCustomer(),
    }),
  ),
  ...overrides,
})

/**
 * Everything the customer use cases need: the repository above and a clock
 * at `NOW` unless another time is given.
 */
export const customerDependencies = (
  customers: Partial<ICustomerRepository> = {},
  now: Date = NOW,
): CustomerUseCaseDependencies => ({
  customerRepository: customerRepositoryWith(customers),
  clock: () => now,
})
