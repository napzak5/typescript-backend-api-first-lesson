import { describe, expect, it } from 'vitest'
import { TreatmentRecordReadMapper } from '../mappers/read/treatment-record.mapper'
import { TreatmentRecordWriteMapper } from '../mappers/write/treatment-record.mapper'
import type { LedgerReach } from '../models/booking'
import { salonIdSchema } from '../models/salon'
import {
  type DbTreatmentPhoto,
  treatmentRecordIdSchema,
} from '../models/treatment-record'
import {
  treatmentRecordCreateRequestSchema,
  treatmentRecordSearchRequestSchema,
  treatmentRecordUpdateRequestSchema,
} from '../schemas/treatment-record.schema'
import { CUSTOMER_ID, STAFF_ID } from './auth-fixtures'
import { BOOKING_ID, COLOR_ID, CUT_ID } from './booking-fixtures'
import { SALON_ID } from './fixtures'
import { OTHER_PRODUCT_ID, PRODUCT_ID } from './product-fixtures'
import {
  dbTreatmentMaterials,
  dbTreatmentPhoto,
  dbTreatmentRecord,
  OTHER_TREATMENT_RECORD_ID,
  PHOTO_ID,
  storedTreatmentRecord,
  TREATMENT_RECORD_ID,
  treatmentRecordCreateRequest,
} from './treatment-record-fixtures'

describe('TreatmentRecordReadMapper', () => {
  it('names every column as it is, the materials in their order without their own IDs, the photos with theirs, the quantities as numbers and the times in ISO 8601', () => {
    expect(
      TreatmentRecordReadMapper.toApiTreatmentRecord(storedTreatmentRecord()),
    ).toEqual({
      type: 'success',
      data: {
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
        photos: [
          {
            id: PHOTO_ID,
            photoType: 'after',
            photoUrl: 'https://images.example.com/after.jpg',
            thumbnailUrl: null,
            angle: 'side',
            description: null,
            isPublic: false,
            customerConsent: true,
            sortOrder: 0,
          },
        ],
        createdAt: '2026-11-20T02:00:00.123Z',
        updatedAt: '2026-11-20T02:30:00.000Z',
      },
    })
  })

  it('keeps nulls as nulls', () => {
    const result = TreatmentRecordReadMapper.toApiTreatmentRecord({
      record: dbTreatmentRecord({
        consultationNotes: null,
        scalpCondition: null,
        hairCondition: null,
        colorFormula: null,
        processingTime: null,
        resultNotes: null,
        nextRecommendedDate: null,
        homeCareSuggestions: null,
        customerSatisfaction: null,
        staffEvaluation: null,
      }),
      materials: [],
      photos: [],
    })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        consultationNotes: null,
        scalpCondition: null,
        hairCondition: null,
        colorFormula: null,
        processingTime: null,
        resultNotes: null,
        nextRecommendedDate: null,
        homeCareSuggestions: null,
        customerSatisfaction: null,
        staffEvaluation: null,
        materials: [],
        photos: [],
      },
    })
  })

  it('shows the photos in the order they are read', () => {
    const before: DbTreatmentPhoto = {
      ...dbTreatmentPhoto(),
      id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d22',
      photoType: 'before',
      photoUrl: 'https://images.example.com/before.jpg',
      sortOrder: 1,
    }

    expect(
      TreatmentRecordReadMapper.toApiTreatmentRecord({
        ...storedTreatmentRecord(),
        photos: [dbTreatmentPhoto(), before],
      }),
    ).toMatchObject({
      type: 'success',
      data: {
        photos: [
          { photoType: 'after', sortOrder: 0 },
          { photoType: 'before', sortOrder: 1 },
        ],
      },
    })
  })

  it.each<[string, Parameters<typeof dbTreatmentRecord>[0]]>([
    ['services that are not a list', { services: { cut: true } }],
    ['techniques of numbers', { techniques: [1, 2] }],
    ['recommendations that are null', { nextRecommendedServices: null }],
    ['a time that is not one', { createdAt: 'yesterday' }],
  ])(
    'tells a stored row with %s apart as a database error',
    (_case, overrides) => {
      expect(
        TreatmentRecordReadMapper.toApiTreatmentRecord(
          storedTreatmentRecord(overrides),
        ),
      ).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored treatment record ${TREATMENT_RECORD_ID} does not match the API model`,
        },
      })
    },
  )

  it('tells a stored material whose quantity is no number apart as a database error', () => {
    const [first, second] = dbTreatmentMaterials()
    if (first === undefined || second === undefined) {
      throw new Error('The fixtures have two materials')
    }

    expect(
      TreatmentRecordReadMapper.toApiTreatmentRecord({
        ...storedTreatmentRecord(),
        materials: [first, { ...second, quantity: 'many' }],
      }),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored material ${second.id} of treatment record ${TREATMENT_RECORD_ID} does not match the API model`,
      },
    })
  })

  it('maps a list in its order, and stops at the first row that does not match', () => {
    const other = storedTreatmentRecord({ id: OTHER_TREATMENT_RECORD_ID })

    expect(
      TreatmentRecordReadMapper.toApiTreatmentRecords([
        other,
        storedTreatmentRecord(),
      ]),
    ).toMatchObject({
      type: 'success',
      data: [{ id: OTHER_TREATMENT_RECORD_ID }, { id: TREATMENT_RECORD_ID }],
    })
    expect(
      TreatmentRecordReadMapper.toApiTreatmentRecords([
        other,
        storedTreatmentRecord({ updatedAt: 'later' }),
      ]),
    ).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('TreatmentRecordWriteMapper', () => {
  it('writes every column of the record as the request names it, and the materials in its order with two decimals', () => {
    const request = treatmentRecordCreateRequestSchema.parse(
      treatmentRecordCreateRequest(),
    )

    expect(TreatmentRecordWriteMapper.fromCreateRequest(request)).toEqual({
      record: {
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
      },
      materials: [
        {
          productId: PRODUCT_ID,
          quantity: '80.00',
          unit: 'g',
          lotNumber: 'LOT-2026-11',
          notes: '根元',
        },
        {
          productId: OTHER_PRODUCT_ID,
          quantity: '12.25',
          unit: 'g',
          lotNumber: null,
          notes: null,
        },
      ],
    })
  })

  it('writes what an update names and nothing else, and keeps the materials when it names none', () => {
    const request = treatmentRecordUpdateRequestSchema.parse({
      resultNotes: null,
      techniques: [],
    })

    expect(TreatmentRecordWriteMapper.fromUpdateRequest(request)).toEqual({
      changes: { resultNotes: null, techniques: [] },
      materials: null,
    })
  })

  it('replaces the materials with those an update names, and with none', () => {
    const named = treatmentRecordUpdateRequestSchema.parse({
      materials: [
        {
          productId: PRODUCT_ID,
          quantity: 0.5,
          unit: 'g',
          lotNumber: 'LOT-1',
          notes: null,
        },
      ],
    })
    const none = treatmentRecordUpdateRequestSchema.parse({ materials: [] })

    expect(TreatmentRecordWriteMapper.fromUpdateRequest(named)).toEqual({
      changes: {},
      materials: [
        {
          productId: PRODUCT_ID,
          quantity: '0.50',
          unit: 'g',
          lotNumber: 'LOT-1',
          notes: null,
        },
      ],
    })
    expect(TreatmentRecordWriteMapper.fromUpdateRequest(none)).toEqual({
      changes: {},
      materials: [],
    })
  })
})

describe('TreatmentRecordReadMapper.toApiTreatmentRecordPage', () => {
  it('answers with the records of the list and where the list goes on', () => {
    const result = TreatmentRecordReadMapper.toApiTreatmentRecordPage(
      {
        type: 'listed',
        records: [
          storedTreatmentRecord(),
          storedTreatmentRecord({ id: OTHER_TREATMENT_RECORD_ID }),
        ],
        total: 7,
        hasMore: true,
      },
      { limit: 2, after: treatmentRecordIdSchema.parse(TREATMENT_RECORD_ID) },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: TREATMENT_RECORD_ID }, { id: OTHER_TREATMENT_RECORD_ID }],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: TREATMENT_RECORD_ID,
          nextCursor: OTHER_TREATMENT_RECORD_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored record is invalid', () => {
    const result = TreatmentRecordReadMapper.toApiTreatmentRecordPage(
      {
        type: 'listed',
        records: [storedTreatmentRecord({ updatedAt: 'later' })],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('TreatmentRecordWriteMapper.fromSearchRequest', () => {
  const everySalon: LedgerReach = { type: 'everySalon' }
  const ownSalon: LedgerReach = {
    type: 'salon',
    salonId: salonIdSchema.parse(SALON_ID),
  }

  it('asks for the first 20 records within the reach, by no filter, when the request names nothing', () => {
    expect(
      TreatmentRecordWriteMapper.fromSearchRequest({}, everySalon),
    ).toStrictEqual({
      reach: { type: 'everySalon' },
      limit: 20,
      after: null,
      salonId: null,
      customerId: null,
      staffId: null,
      startDate: null,
      endDate: null,
    })
  })

  it('takes the place and every filter the request names, as they are', () => {
    const request = treatmentRecordSearchRequestSchema.parse({
      limit: 5,
      cursor: TREATMENT_RECORD_ID,
      salonId: SALON_ID,
      customerId: CUSTOMER_ID,
      staffId: STAFF_ID,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    })

    expect(
      TreatmentRecordWriteMapper.fromSearchRequest(request, ownSalon),
    ).toStrictEqual({
      reach: { type: 'salon', salonId: SALON_ID },
      limit: 5,
      after: TREATMENT_RECORD_ID,
      salonId: SALON_ID,
      customerId: CUSTOMER_ID,
      staffId: STAFF_ID,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    })
  })
})

describe('TreatmentRecordWriteMapper.fromStatisticsGetRequest', () => {
  const salonId = salonIdSchema.parse(SALON_ID)

  it('leaves the period open where the request names no end of it', () => {
    expect(
      TreatmentRecordWriteMapper.fromStatisticsGetRequest({ salonId }),
    ).toStrictEqual({ salonId: SALON_ID, startDate: null, endDate: null })
  })

  it('takes the salon and the period the request names', () => {
    expect(
      TreatmentRecordWriteMapper.fromStatisticsGetRequest({
        salonId,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-30T23:59:59.999Z',
      }),
    ).toStrictEqual({
      salonId: SALON_ID,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    })
  })
})
