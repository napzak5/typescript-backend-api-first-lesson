import { describe, expect, it } from 'vitest'
import { SalonReadMapper } from '../mappers/read/salon.mapper'
import { SalonWriteMapper } from '../mappers/write/salon.mapper'
import { salonIdSchema } from '../models/salon'
import { salonSearchRequestSchema } from '../schemas/salon.schema'
import {
  dbOpeningHours,
  dbSalon,
  OTHER_SALON_ID,
  SALON_ID,
  salonCreateRequest,
} from './fixtures'

describe('SalonWriteMapper.fromCreateRequest', () => {
  it('keeps every property under its own name and writes numbers of numeric columns as text', () => {
    const request = salonCreateRequest()
    const { openingHours, latitude, longitude, taxRate, ...unchanged } = request

    const mapped = SalonWriteMapper.fromCreateRequest(request)

    expect(mapped.salon).toEqual({
      ...unchanged,
      latitude: '35.6654',
      longitude: '139.7121',
      taxRate: '10',
    })
    expect(mapped.openingHours).toEqual(openingHours)
  })

  it('keeps null as null', () => {
    const mapped = SalonWriteMapper.fromCreateRequest({
      ...salonCreateRequest(),
      latitude: null,
      longitude: null,
      description: null,
      businessHours: null,
    })

    expect(mapped.salon).toMatchObject({
      latitude: null,
      longitude: null,
      description: null,
      businessHours: null,
    })
  })
})

describe('SalonWriteMapper.fromUpdateRequest', () => {
  it('changes only the properties that are present', () => {
    const mapped = SalonWriteMapper.fromUpdateRequest({
      name: 'Renamed',
      taxRate: 8,
    })

    expect(mapped).toEqual({
      changes: { name: 'Renamed', taxRate: '8' },
      openingHours: { type: 'keep' },
    })
  })

  it('clears a nullable column when the property is null', () => {
    const mapped = SalonWriteMapper.fromUpdateRequest({
      building: null,
      latitude: null,
      longitude: 139.7,
    })

    expect(mapped.changes).toEqual({
      building: null,
      latitude: null,
      longitude: '139.7',
    })
  })

  it('replaces the calendar when openingHours is present, even if empty', () => {
    const [firstDay] = salonCreateRequest().openingHours

    expect(
      SalonWriteMapper.fromUpdateRequest({ openingHours: [] }).openingHours,
    ).toEqual({ type: 'replace', openingHours: [] })
    expect(
      SalonWriteMapper.fromUpdateRequest({
        openingHours: firstDay === undefined ? [] : [firstDay],
      }),
    ).toEqual({
      changes: {},
      openingHours: { type: 'replace', openingHours: [firstDay] },
    })
  })
})

describe('SalonReadMapper.toApiSalon', () => {
  it('returns the columns under their own names, with numbers, ISO timestamps and the calendar', () => {
    const result = SalonReadMapper.toApiSalon(dbSalon(), [
      dbOpeningHours(),
      dbOpeningHours({
        date: '2026-11-23',
        openTime: null,
        closeTime: null,
        isHoliday: true,
        holidayName: '勤労感謝の日',
      }),
    ])

    expect(result).toEqual({
      type: 'success',
      data: {
        id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b',
        name: 'Hair Studio Aoyama',
        nameKana: null,
        description: null,
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
        websiteUrl: null,
        logoUrl: null,
        imageUrls: [],
        features: ['color'],
        amenities: [],
        businessHours: null,
        rating: 4.5,
        reviewCount: 12,
        timezone: 'Asia/Tokyo',
        currency: 'JPY',
        taxRate: 10,
        isActive: true,
        createdAt: '2026-11-14T09:00:00.123Z',
        updatedAt: '2026-11-14T09:30:00.000Z',
        openingHours: [
          {
            dayOfWeek: 'monday',
            date: '2026-11-16',
            openTime: '10:00:00',
            closeTime: '19:00:00',
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
      },
    })
  })

  it('does not expose the columns the API leaves out', () => {
    const result = SalonReadMapper.toApiSalon(
      dbSalon({ deletedAt: '2026-11-15 00:00:00+00' }),
      [],
    )

    expect(result.type).toBe('success')
    expect(
      Object.keys(result.type === 'success' ? result.data : {}),
    ).not.toEqual(expect.arrayContaining(['deletedAt']))
  })

  it('keeps a missing rating and location as null', () => {
    const result = SalonReadMapper.toApiSalon(
      dbSalon({ rating: null, latitude: null, longitude: null }),
      [],
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { rating: null, latitude: null, longitude: null },
    })
  })

  it('returns stored business hours that have the shape of the API model', () => {
    const businessHours = [
      {
        dayOfWeek: 'sunday',
        operatingSlots: [],
        breakSlots: null,
        isClosed: true,
        effectivePeriod: null,
      },
    ]

    const result = SalonReadMapper.toApiSalon(dbSalon({ businessHours }), [])

    expect(result).toMatchObject({ type: 'success', data: { businessHours } })
  })

  it.each([
    [
      'business hours that are not a list',
      { businessHours: { monday: '10-19' } },
    ],
    [
      'business hours whose days have a time zone of their own',
      {
        businessHours: [
          {
            dayOfWeek: 'sunday',
            operatingSlots: [],
            breakSlots: null,
            isClosed: true,
            effectivePeriod: null,
            timezone: 'Asia/Tokyo',
          },
        ],
      },
    ],
    ['a numeric column that is not a number', { taxRate: 'ten' }],
    ['a timestamp that is not a timestamp', { createdAt: 'yesterday' }],
  ])(
    'reports %s as a database error, not as a bad request',
    (_case, stored) => {
      const result = SalonReadMapper.toApiSalon(dbSalon(stored), [])

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message:
            'Stored salon 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b does not match the API model',
        },
      })
    },
  )
})

describe('SalonReadMapper.toBusinessHours', () => {
  const monday = {
    dayOfWeek: 'monday',
    operatingSlots: [{ startTime: '10:00', endTime: '19:00' }],
    breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
    isClosed: false,
    effectivePeriod: {
      startDate: '2026-11-01T00:00:00Z',
      endDate: '2026-12-01T00:00:00Z',
    },
  }

  it('returns the stored weekly hours that have the shape of the API model, as they are', () => {
    expect(
      SalonReadMapper.toBusinessHours(dbSalon({ businessHours: [monday] })),
    ).toStrictEqual({ type: 'success', data: [monday] })
  })

  it('returns null for a salon that has said no hours, and an empty list as it is', () => {
    expect(
      SalonReadMapper.toBusinessHours(dbSalon({ businessHours: null })),
    ).toStrictEqual({ type: 'success', data: null })
    expect(
      SalonReadMapper.toBusinessHours(dbSalon({ businessHours: [] })),
    ).toStrictEqual({ type: 'success', data: [] })
  })

  it('looks at the hours alone: the other columns of the salon are not read', () => {
    expect(
      SalonReadMapper.toBusinessHours({
        id: OTHER_SALON_ID,
        businessHours: [monday],
      }),
    ).toStrictEqual({ type: 'success', data: [monday] })
    expect(
      SalonReadMapper.toBusinessHours(
        dbSalon({ businessHours: [monday], taxRate: 'ten' }),
      ).type,
    ).toBe('success')
  })

  it.each([
    ['hours that are not a list', { monday: '10-19' }],
    ['an entry without its properties', [{ dayOfWeek: 'monday' }]],
    [
      'an entry with a time zone of its own',
      [{ ...monday, timezone: 'Asia/Tokyo' }],
    ],
    [
      'a time that is not a time of day',
      [{ ...monday, operatingSlots: [{ startTime: '10', endTime: '19' }] }],
    ],
    ['a day that is no day of the week', [{ ...monday, dayOfWeek: 'funday' }]],
  ])(
    'reports %s as a database error that names the salon',
    (_case, businessHours) => {
      expect(
        SalonReadMapper.toBusinessHours({ id: OTHER_SALON_ID, businessHours }),
      ).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored salon ${OTHER_SALON_ID} does not match the API model`,
        },
      })
    },
  )
})

describe('SalonReadMapper.toApiSalons', () => {
  it('maps every salon with its own calendar, in order', () => {
    const result = SalonReadMapper.toApiSalons([
      { salon: dbSalon(), openingHours: [dbOpeningHours()] },
      {
        salon: dbSalon({ id: OTHER_SALON_ID, name: 'Second' }),
        openingHours: [],
      },
    ])

    expect(result).toMatchObject({
      type: 'success',
      data: [
        { name: 'Hair Studio Aoyama', openingHours: [{ date: '2026-11-16' }] },
        { id: OTHER_SALON_ID, name: 'Second', openingHours: [] },
      ],
    })
  })

  it('fails as a whole when one stored salon is invalid', () => {
    const result = SalonReadMapper.toApiSalons([
      { salon: dbSalon(), openingHours: [] },
      {
        salon: dbSalon({ id: OTHER_SALON_ID, rating: 'great' }),
        openingHours: [],
      },
    ])

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored salon ${OTHER_SALON_ID} does not match the API model`,
      },
    })
  })
})

describe('SalonWriteMapper.fromSearchRequest', () => {
  it('asks for the first 20 salons, with no filter, when the request names nothing', () => {
    expect(SalonWriteMapper.fromSearchRequest({})).toEqual({
      limit: 20,
      after: null,
      keyword: null,
      prefecture: null,
      city: null,
      isActive: null,
      minRating: null,
      features: [],
    })
  })

  it('takes the place and every filter the request names, as they are', () => {
    const request = salonSearchRequestSchema.parse({
      limit: 5,
      cursor: OTHER_SALON_ID,
      keyword: 'Aoyama',
      prefecture: '東京都',
      city: '港区',
      isActive: false,
      minRating: 0,
      features: ['wifi', 'parking'],
    })

    expect(SalonWriteMapper.fromSearchRequest(request)).toEqual({
      limit: 5,
      after: OTHER_SALON_ID,
      keyword: 'Aoyama',
      prefecture: '東京都',
      city: '港区',
      isActive: false,
      minRating: 0,
      features: ['wifi', 'parking'],
    })
  })
})

describe('SalonReadMapper.toApiSalonPage', () => {
  it('answers with the salons of the list and where the list goes on', () => {
    const result = SalonReadMapper.toApiSalonPage(
      {
        salons: [
          { salon: dbSalon(), openingHours: [dbOpeningHours()] },
          { salon: dbSalon({ id: OTHER_SALON_ID }), openingHours: [] },
        ],
        total: 5,
        hasMore: true,
      },
      { limit: 2, after: salonIdSchema.parse(SALON_ID) },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [
          { id: SALON_ID, openingHours: [{ date: '2026-11-16' }] },
          { id: OTHER_SALON_ID, openingHours: [] },
        ],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: SALON_ID,
          nextCursor: OTHER_SALON_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored salon is invalid', () => {
    const result = SalonReadMapper.toApiSalonPage(
      {
        salons: [{ salon: dbSalon({ rating: 'great' }), openingHours: [] }],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})
