import type { DbCustomerVersion } from '../../models/customer-version'
import { CUSTOMER_ID, USER_ID } from './auth-fixtures'
import { REFERRER_ID } from './customer-fixtures'

/** The ID of a version of the customer of the fixtures: the first, the second and so on. */
export const VERSION_ID = (n: number): string =>
  `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f8a0${n}`

/** A version of the customer of the fixtures, as the driver returns it. */
export const dbCustomerVersion = (
  overrides: Partial<DbCustomerVersion> = {},
): DbCustomerVersion => ({
  id: VERSION_ID(1),
  customerId: CUSTOMER_ID,
  version: 1,
  operation: 'create',
  changedBy: USER_ID,
  changedAt: '2026-11-14 18:00:00.123456+09',
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
  preferences: { preferredServices: ['cut'], notes: null },
  notes: null,
  internalNotes: null,
  tags: ['regular'],
  referredBy: REFERRER_ID,
  referralCode: 'HANAKO2026',
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  isActive: true,
  hairType: 'wavy',
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
  ...overrides,
})
