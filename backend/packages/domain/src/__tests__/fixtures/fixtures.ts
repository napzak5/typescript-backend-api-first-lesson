import { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { expect, vi } from 'vitest'
import type {
  ApiSalonCreateRequest,
  DbOpeningHours,
  DbSalon,
} from '../../models/salon'
import type {
  ISalonRepository,
  SalonDeletion,
} from '../../repositories/salon.repository'
import type { DomainError } from '../../shared'

/**
 * What a test says of a rule that it makes up: of an issue that the caller
 * of a use case found, and of which the use case writes nothing.
 */
export const MADE_UP_MESSAGE: LocalizedText = {
  en: 'Must be a number',
  ja: '数にしてください',
}

/**
 * The headline of a refusal that a test makes up: where the test is about
 * the rules a value breaks, or about what a use case does with a refusal
 * its caller hands over, and not about what the refusal is called.
 */
export const MADE_UP_HEADLINE: LocalizedText = {
  en: 'Invalid',
  ja: '正しくありません',
}

/**
 * The cause of a stored value that does not match (`parseStored`),
 * whichever properties break a rule: at least one, each with its name, its
 * rule and what is said of it. What the cause holds exactly is the subject
 * of `validation.test.ts`.
 */
export const RULES_BROKEN_BY_STORED = {
  issues: expect.arrayContaining([
    {
      field: expect.any(String),
      rule: expect.any(String),
      message: expect.any(String),
    },
  ]),
}

export const SALON_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
export const OTHER_SALON_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c'

/** A request that satisfies every rule. 2026-11-16 and 2026-11-23 are Mondays. */
export const salonCreateRequest = (): ApiSalonCreateRequest => ({
  name: 'Hair Studio Aoyama',
  nameKana: 'ヘアスタジオアオヤマ',
  description: 'A calm salon near Omotesando',
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: null,
  latitude: 35.6654,
  longitude: 139.7121,
  phoneNumber: '03-1234-5678',
  alternativePhone: null,
  email: 'aoyama@example.com',
  websiteUrl: 'https://aoyama.example.com',
  logoUrl: null,
  imageUrls: ['https://aoyama.example.com/front.jpg'],
  features: ['color', 'kids'],
  amenities: ['wifi'],
  businessHours: [
    {
      dayOfWeek: 'monday',
      operatingSlots: [{ startTime: '10:00', endTime: '19:00' }],
      breakSlots: null,
      isClosed: false,
      effectivePeriod: null,
    },
  ],
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: 10,
  isActive: true,
  openingHours: [
    {
      dayOfWeek: 'monday',
      date: '2026-11-16',
      openTime: '10:00',
      closeTime: '19:00',
      isHoliday: false,
      holidayName: null,
      notes: null,
    },
    {
      dayOfWeek: 'monday',
      date: '2026-11-23',
      openTime: null,
      closeTime: null,
      isHoliday: true,
      holidayName: '勤労感謝の日',
      notes: null,
    },
  ],
})

/** A row of `salons` as the driver returns it. */
export const dbSalon = (overrides: Partial<DbSalon> = {}): DbSalon => ({
  id: SALON_ID,
  name: 'Hair Studio Aoyama',
  nameKana: null,
  description: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: null,
  latitude: '35.66540000',
  longitude: '139.71210000',
  phoneNumber: '03-1234-5678',
  alternativePhone: null,
  email: 'aoyama@example.com',
  websiteUrl: null,
  logoUrl: null,
  imageUrls: [],
  features: ['color'],
  amenities: [],
  businessHours: null,
  rating: '4.50',
  reviewCount: 12,
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: '10.00',
  isActive: true,
  deletedAt: null,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

export const dbOpeningHours = (
  overrides: Partial<DbOpeningHours> = {},
): DbOpeningHours => ({
  id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0b00',
  salonId: SALON_ID,
  dayOfWeek: 'monday',
  date: '2026-11-16',
  openTime: '10:00:00',
  closeTime: '19:00:00',
  isHoliday: false,
  holidayName: null,
  notes: null,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 18:00:00.123456+09',
  ...overrides,
})

/** A salon repository that holds one salon; a test overrides what it needs. */
export const salonRepositoryWith = (
  overrides: Partial<ISalonRepository> = {},
): ISalonRepository => {
  const stored = { salon: dbSalon(), openingHours: [dbOpeningHours()] }

  return {
    create: vi.fn(async () => Result.success(stored)),
    findById: vi.fn(async () => Result.success(stored)),
    exists: vi.fn(async () => Result.success(true)),
    list: vi.fn(async () =>
      Result.success({ salons: [stored], total: 1, hasMore: false }),
    ),
    update: vi.fn(async () => Result.success(stored)),
    delete: vi.fn(async () =>
      Result.success<SalonDeletion>({ type: 'deleted' }),
    ),
    ...overrides,
  }
}

/** The broken rules of a validation error as `field:rule`; empty for anything else. */
export const brokenRules = (error: DomainError): string[] =>
  error.type === 'validation'
    ? error.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []

/**
 * What a refused request is told of each rule it broke, in every language
 * and in the order of the rules; empty for anything that is no validation
 * error.
 */
export const saidOfBrokenRules = (
  result: Result<unknown, DomainError>,
): LocalizedText[] =>
  result.type === 'error' && result.error.type === 'validation'
    ? result.error.issues.map(({ message }) => message)
    : []
