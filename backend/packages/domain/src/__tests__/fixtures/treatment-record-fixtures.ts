import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { TreatmentRecordUseCaseDependencies } from '../../business-logic/treatment-record'
import {
  type ApiTreatmentPhotoCreateRequest,
  type ApiTreatmentRecordCreateRequest,
  type DbTreatmentMaterial,
  type DbTreatmentPhoto,
  type DbTreatmentRecord,
  type TreatmentFigures,
  type TreatmentRecordWithDetails,
  treatmentRecordIdSchema,
} from '../../models/treatment-record'
import type {
  ITreatmentRecordRepository,
  TreatmentPhotoAddition,
  TreatmentPhotoRemoval,
  TreatmentRecordChange,
  TreatmentRecordCreation,
  TreatmentRecordListing,
  TreatmentRecordRemoval,
} from '../../repositories/treatment-record.repository'
import { CUSTOMER_ID, STAFF_ID } from './auth-fixtures'
import { BOOKING_ID, COLOR_ID, CUT_ID } from './booking-fixtures'
import { OTHER_PRODUCT_ID, PRODUCT_ID } from './product-fixtures'

export const TREATMENT_RECORD_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d01'
export const OTHER_TREATMENT_RECORD_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d02'
const MATERIAL_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d11'
const OTHER_MATERIAL_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d12'
export const PHOTO_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d21'

/**
 * A request that satisfies every rule: a colour and a cut, with 80 grams
 * of a colour cream of a lot and 12.25 grams of a treatment, and
 * everything else written down.
 */
export const treatmentRecordCreateRequest = (
  overrides: Partial<ApiTreatmentRecordCreateRequest> = {},
): ApiTreatmentRecordCreateRequest => ({
  bookingId: BOOKING_ID,
  customerId: CUSTOMER_ID,
  staffId: STAFF_ID,
  services: [COLOR_ID, CUT_ID],
  techniques: ['リタッチ', 'グラデーションカット'],
  consultationNotes: '根元の白髪が気になる',
  scalpCondition: '乾燥ぎみ',
  hairCondition: '毛先にダメージ',
  colorFormula: '7N:7Ash = 1:1、6%',
  processingTime: 95,
  resultNotes: '色むらなし',
  nextRecommendedDate: '2026-12-18',
  nextRecommendedServices: [COLOR_ID],
  homeCareSuggestions: 'カラー用シャンプー',
  customerSatisfaction: 5,
  staffEvaluation: '次回はトーンを一段落とす',
  materials: [
    {
      productId: PRODUCT_ID,
      quantity: 80,
      unit: 'g',
      lotNumber: 'LOT-2026-11',
      notes: '根元',
    },
    {
      productId: OTHER_PRODUCT_ID,
      quantity: 12.25,
      unit: 'g',
      lotNumber: null,
      notes: null,
    },
  ],
  ...overrides,
})

/** A row of `treatment_records` as the driver returns it: the record above. */
export const dbTreatmentRecord = (
  overrides: Partial<DbTreatmentRecord> = {},
): DbTreatmentRecord => ({
  id: TREATMENT_RECORD_ID,
  bookingId: BOOKING_ID,
  customerId: CUSTOMER_ID,
  staffId: STAFF_ID,
  services: [COLOR_ID, CUT_ID],
  techniques: ['リタッチ', 'グラデーションカット'],
  consultationNotes: '根元の白髪が気になる',
  scalpCondition: '乾燥ぎみ',
  hairCondition: '毛先にダメージ',
  colorFormula: '7N:7Ash = 1:1、6%',
  processingTime: 95,
  resultNotes: '色むらなし',
  nextRecommendedDate: '2026-12-18',
  nextRecommendedServices: [COLOR_ID],
  homeCareSuggestions: 'カラー用シャンプー',
  customerSatisfaction: 5,
  staffEvaluation: '次回はトーンを一段落とす',
  createdAt: '2026-11-20 11:00:00.123456+09',
  updatedAt: '2026-11-20 02:30:00+00',
  ...overrides,
})

/** The rows of `treatment_materials` of the record above, in its order. */
export const dbTreatmentMaterials = (): DbTreatmentMaterial[] => [
  {
    id: MATERIAL_ID,
    treatmentRecordId: TREATMENT_RECORD_ID,
    productId: PRODUCT_ID,
    quantity: '80.00',
    unit: 'g',
    lotNumber: 'LOT-2026-11',
    notes: '根元',
    sortOrder: 0,
    createdAt: '2026-11-20 11:00:00.123456+09',
  },
  {
    id: OTHER_MATERIAL_ID,
    treatmentRecordId: TREATMENT_RECORD_ID,
    productId: OTHER_PRODUCT_ID,
    quantity: '12.25',
    unit: 'g',
    lotNumber: null,
    notes: null,
    sortOrder: 1,
    createdAt: '2026-11-20 11:00:00.123456+09',
  },
]

/** A photo of the record above, after the treatment. */
export const dbTreatmentPhoto = (): DbTreatmentPhoto => ({
  id: PHOTO_ID,
  treatmentRecordId: TREATMENT_RECORD_ID,
  photoType: 'after',
  photoUrl: 'https://images.example.com/after.jpg',
  thumbnailUrl: null,
  angle: 'side',
  description: null,
  isPublic: false,
  customerConsent: true,
  sortOrder: 0,
  createdAt: '2026-11-20 11:05:00+09',
})

/** A photo of an addition that satisfies every rule: public, with consent. */
export const treatmentPhotoCreateRequest = (
  overrides: Partial<ApiTreatmentPhotoCreateRequest> = {},
): ApiTreatmentPhotoCreateRequest => ({
  photoType: 'after',
  photoUrl: 'https://images.example.com/after.jpg',
  thumbnailUrl: 'https://images.example.com/after-small.jpg',
  angle: 'side',
  description: '毛先まで色が入った',
  isPublic: true,
  customerConsent: true,
  sortOrder: 0,
  ...overrides,
})

/** An addition of the photos given, each of its own address and place. */
export const treatmentPhotoBulkCreateRequest = (
  ...photos: Record<string, unknown>[]
) => ({
  photos: photos.map((photo, index) => ({
    ...treatmentPhotoCreateRequest({
      photoUrl: `https://images.example.com/${index}.jpg`,
      sortOrder: index,
    }),
    ...photo,
  })),
})

/**
 * What the records of a period come to: three records, two of which
 * state a processing time.
 */
export const treatmentFigures = (
  overrides: Partial<TreatmentFigures> = {},
): TreatmentFigures => ({
  total: 3,
  processingTimeSum: 195,
  processingTimeCount: 2,
  byCategory: [
    { category: 'cut', count: 3 },
    { category: 'color', count: 1 },
  ],
  topServices: [
    { serviceId: CUT_ID, count: 3 },
    { serviceId: COLOR_ID, count: 1 },
  ],
  ...overrides,
})

/** The record above with its materials and its photo. */
export const storedTreatmentRecord = (
  overrides: Partial<DbTreatmentRecord> = {},
): TreatmentRecordWithDetails => ({
  record: dbTreatmentRecord(overrides),
  materials: dbTreatmentMaterials(),
  photos: [dbTreatmentPhoto()],
})

/**
 * A repository that holds the one record above, in which every write
 * succeeds; a test overrides what it needs.
 */
const treatmentRecordRepositoryWith = (
  overrides: Partial<ITreatmentRecordRepository> = {},
): ITreatmentRecordRepository => ({
  create: vi.fn(async () =>
    Result.success<TreatmentRecordCreation>({
      type: 'created',
      record: storedTreatmentRecord(),
    }),
  ),
  findById: vi.fn(async () => Result.success(storedTreatmentRecord())),
  list: vi.fn(async () =>
    Result.success<TreatmentRecordListing>({
      type: 'listed',
      records: [storedTreatmentRecord()],
      total: 1,
      hasMore: false,
    }),
  ),
  update: vi.fn(async () =>
    Result.success<TreatmentRecordChange>({
      type: 'changed',
      record: storedTreatmentRecord(),
    }),
  ),
  delete: vi.fn(async () =>
    Result.success<TreatmentRecordRemoval>({ type: 'removed' }),
  ),
  addPhotos: vi.fn(async () =>
    Result.success<TreatmentPhotoAddition>({
      type: 'added',
      recordId: treatmentRecordIdSchema.parse(TREATMENT_RECORD_ID),
      photos: [dbTreatmentPhoto()],
    }),
  ),
  removePhoto: vi.fn(async () =>
    Result.success<TreatmentPhotoRemoval>({ type: 'removed' }),
  ),
  findFigures: vi.fn(async () => Result.success(treatmentFigures())),
  ...overrides,
})

/** Everything the treatment record use cases need: the repository above. */
export const treatmentRecordDependencies = (
  records: Partial<ITreatmentRecordRepository> = {},
): TreatmentRecordUseCaseDependencies => ({
  treatmentRecordRepository: treatmentRecordRepositoryWith(records),
})
