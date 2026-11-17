import { describe, expect, it } from 'vitest'
import { ServiceReadMapper } from '../mappers/read/service.mapper'
import { ServiceWriteMapper } from '../mappers/write/service.mapper'
import { SALON_ID } from './fixtures'
import { CATEGORY_ID } from './service-category-fixtures'
import {
  dbService,
  dbServiceOption,
  OPTION_ID,
  OTHER_SERVICE_ID,
  SERVICE_ID,
  serviceCreateRequest,
  serviceOptionRequest,
  THIRD_SERVICE_ID,
} from './service-fixtures'

/** The properties of a ServiceResponse. */
const RESPONSE_PROPERTIES = [
  'allowOnlineBooking',
  'availability',
  'bookingRequirements',
  'categoryId',
  'createdAt',
  'description',
  'discountPrice',
  'duration',
  'id',
  'imageUrl',
  'imageUrls',
  'isActive',
  'isPackage',
  'maxBookingsPerDay',
  'name',
  'options',
  'packageServiceIds',
  'price',
  'pricingStrategy',
  'requiredStaffLevel',
  'requiresConsultation',
  'salonId',
  'serviceStatus',
  'shortDescription',
  'sortOrder',
  'tags',
  'taxIncluded',
  'updatedAt',
]

/** The properties of a ServiceOption. */
const OPTION_PROPERTIES = [
  'additionalPrice',
  'additionalTime',
  'description',
  'isActive',
  'isRequired',
  'maxQuantity',
  'name',
  'optionType',
  'sortOrder',
]

describe('ServiceWriteMapper.fromCreateRequest', () => {
  it('keeps every property of the service under its own name and hands the options on apart', () => {
    const request = serviceCreateRequest()
    const { options, ...service } = request

    const mapped = ServiceWriteMapper.fromCreateRequest(request)

    expect(mapped).toEqual({ service, options })
  })

  it('keeps null, false, zero, empty lists and the order of the lists as they are', () => {
    const unset = {
      categoryId: null,
      description: null,
      shortDescription: null,
      discountPrice: null,
      imageUrl: null,
      requiredStaffLevel: null,
      maxBookingsPerDay: null,
      price: 0,
      sortOrder: 0,
      taxIncluded: false,
      isActive: false,
      imageUrls: [],
      tags: [],
      bookingRequirements: [],
    }

    const mapped = ServiceWriteMapper.fromCreateRequest({
      ...serviceCreateRequest(),
      ...unset,
      isPackage: true,
      packageServiceIds: [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
    })

    expect(mapped.service).toMatchObject({
      ...unset,
      isPackage: true,
      packageServiceIds: [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
    })
  })

  it('hands no options on as none, and several in the order of the request', () => {
    const several = [
      { ...serviceOptionRequest(), name: 'Second', sortOrder: 2 },
      { ...serviceOptionRequest(), name: 'First', sortOrder: 1 },
    ]

    const withoutOptions = ServiceWriteMapper.fromCreateRequest({
      ...serviceCreateRequest(),
      options: [],
    })
    const withOptions = ServiceWriteMapper.fromCreateRequest({
      ...serviceCreateRequest(),
      options: several,
    })

    expect(withoutOptions.options).toEqual([])
    expect(withOptions.options).toEqual(several)
  })

  it('leaves the options out of the service', () => {
    const mapped = ServiceWriteMapper.fromCreateRequest(serviceCreateRequest())

    expect(mapped.service).not.toHaveProperty('options')
  })
})

describe('ServiceWriteMapper.fromUpdateRequest', () => {
  it('changes only the properties that are present, and keeps the options when the request has none', () => {
    const mapped = ServiceWriteMapper.fromUpdateRequest({
      name: 'Renamed',
      price: 7000,
    })

    expect(mapped).toEqual({
      changes: { name: 'Renamed', price: 7000 },
      options: { type: 'keep' },
    })
  })

  it('clears a nullable column when the property is null', () => {
    const mapped = ServiceWriteMapper.fromUpdateRequest({
      categoryId: null,
      discountPrice: null,
      requiredStaffLevel: null,
    })

    expect(mapped).toEqual({
      changes: {
        categoryId: null,
        discountPrice: null,
        requiredStaffLevel: null,
      },
      options: { type: 'keep' },
    })
  })

  it('replaces the options with those of the request', () => {
    const options = [
      serviceOptionRequest(),
      { ...serviceOptionRequest(), name: 'Head spa', sortOrder: 0 },
    ]

    const mapped = ServiceWriteMapper.fromUpdateRequest({
      isActive: false,
      options,
    })

    expect(mapped).toEqual({
      changes: { isActive: false },
      options: { type: 'replace', options },
    })
  })

  it('replaces the options with none when the request has an empty list', () => {
    const mapped = ServiceWriteMapper.fromUpdateRequest({ options: [] })

    expect(mapped).toEqual({
      changes: {},
      options: { type: 'replace', options: [] },
    })
  })

  it('changes every column when the request names every property', () => {
    const { options, ...changes } = serviceCreateRequest()

    const mapped = ServiceWriteMapper.fromUpdateRequest(serviceCreateRequest())

    expect(mapped).toEqual({ changes, options: { type: 'replace', options } })
  })
})

describe('ServiceReadMapper.toApiService', () => {
  it('returns every column under its own name, with the timestamps in ISO 8601 UTC, and the options', () => {
    const result = ServiceReadMapper.toApiService(
      dbService({
        description: 'A cut with a blow-dry',
        shortDescription: 'Cut and blow-dry',
        discountPrice: 5940,
        imageUrl: 'https://aoyama.example.com/images/cut.jpg',
        imageUrls: ['https://aoyama.example.com/images/cut-1.jpg'],
        requiredStaffLevel: 'stylist',
        maxBookingsPerDay: 8,
        bookingRequirements: ['advance_booking_required'],
        tags: ['popular'],
        pricingStrategy: 'variable',
        serviceStatus: 'coming_soon',
        availability: 'weekdays_only',
      }),
      [dbServiceOption({ description: 'A treatment after the cut' })],
    )

    expect(result).toEqual({
      type: 'success',
      data: {
        id: SERVICE_ID,
        salonId: SALON_ID,
        categoryId: CATEGORY_ID,
        name: 'カット＆ブロー',
        description: 'A cut with a blow-dry',
        shortDescription: 'Cut and blow-dry',
        duration: 60,
        price: 6600,
        discountPrice: 5940,
        taxIncluded: true,
        pricingStrategy: 'variable',
        imageUrl: 'https://aoyama.example.com/images/cut.jpg',
        imageUrls: ['https://aoyama.example.com/images/cut-1.jpg'],
        requiredStaffLevel: 'stylist',
        maxBookingsPerDay: 8,
        requiresConsultation: false,
        allowOnlineBooking: true,
        bookingRequirements: ['advance_booking_required'],
        isPackage: false,
        packageServiceIds: [],
        tags: ['popular'],
        sortOrder: 10,
        serviceStatus: 'coming_soon',
        availability: 'weekdays_only',
        isActive: true,
        options: [
          {
            name: 'トリートメント',
            description: 'A treatment after the cut',
            optionType: 'addon',
            additionalTime: 15,
            additionalPrice: 1100,
            maxQuantity: 1,
            isRequired: false,
            sortOrder: 1,
            isActive: true,
          },
        ],
        createdAt: '2026-11-14T09:00:00.123Z',
        updatedAt: '2026-11-14T09:30:00.000Z',
      },
    })
  })

  it('has exactly the properties of ServiceResponse, also for a deleted row', () => {
    const result = ServiceReadMapper.toApiService(
      dbService({ deletedAt: '2026-11-15 10:00:00+09' }),
      [dbServiceOption()],
    )

    expect(
      Object.keys(result.type === 'success' ? result.data : {}).toSorted(),
    ).toEqual(RESPONSE_PROPERTIES)
  })

  it('gives every option exactly the properties of ServiceOption: neither its ID, nor its service, nor its timestamps', () => {
    const result = ServiceReadMapper.toApiService(dbService(), [
      dbServiceOption(),
      dbServiceOption({ id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f02' }),
    ])

    const options = result.type === 'success' ? result.data.options : []
    expect(options).toHaveLength(2)
    for (const option of options) {
      expect(Object.keys(option).toSorted()).toEqual(OPTION_PROPERTIES)
    }
    expect(JSON.stringify(options)).not.toContain(OPTION_ID)
    expect(JSON.stringify(options)).not.toContain(SERVICE_ID)
  })

  it('returns the options in the order it is given them', () => {
    const result = ServiceReadMapper.toApiService(dbService(), [
      dbServiceOption({ name: 'First', sortOrder: 0 }),
      dbServiceOption({ name: 'Second', sortOrder: 0 }),
      dbServiceOption({ name: 'Third', sortOrder: 5 }),
    ])

    expect(result).toMatchObject({
      type: 'success',
      data: {
        options: [{ name: 'First' }, { name: 'Second' }, { name: 'Third' }],
      },
    })
  })

  it('returns no options as an empty list', () => {
    const result = ServiceReadMapper.toApiService(dbService(), [])

    expect(result).toMatchObject({ type: 'success', data: { options: [] } })
  })

  it('keeps null as null', () => {
    const unset = {
      categoryId: null,
      description: null,
      shortDescription: null,
      discountPrice: null,
      imageUrl: null,
      requiredStaffLevel: null,
      maxBookingsPerDay: null,
    }

    const result = ServiceReadMapper.toApiService(dbService(unset), [])

    expect(result).toMatchObject({ type: 'success', data: unset })
  })

  it('keeps false, zero, text and the members of a package as they are stored', () => {
    const stored = {
      name: '  Colour & Care  ',
      price: 0,
      discountPrice: 0,
      sortOrder: 0,
      taxIncluded: false,
      allowOnlineBooking: false,
      isActive: false,
      isPackage: true,
      packageServiceIds: [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
    }

    const result = ServiceReadMapper.toApiService(dbService(stored), [
      dbServiceOption({
        additionalTime: 0,
        additionalPrice: 0,
        sortOrder: 0,
        isActive: false,
      }),
    ])

    expect(result).toMatchObject({
      type: 'success',
      data: {
        ...stored,
        options: [
          {
            additionalTime: 0,
            additionalPrice: 0,
            sortOrder: 0,
            isActive: false,
          },
        ],
      },
    })
  })

  it.each([
    [
      'a timestamp with microseconds in another time zone',
      '2026-11-15 08:59:59.999999+09',
      '2026-11-14T23:59:59.999Z',
    ],
    [
      'a timestamp without a fraction',
      '2026-01-01 00:00:00+00',
      '2026-01-01T00:00:00.000Z',
    ],
  ])('writes %s in ISO 8601 UTC', (_case, stored, expected) => {
    const result = ServiceReadMapper.toApiService(
      dbService({ createdAt: stored, updatedAt: stored }),
      [],
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { createdAt: expected, updatedAt: expected },
    })
  })

  it.each([
    ['a creation time that is not a timestamp', { createdAt: 'yesterday' }],
    ['an update time that is not a timestamp', { updatedAt: '' }],
  ])(
    'reports %s as a database error that names the service, not as a bad request',
    (_case, stored) => {
      const result = ServiceReadMapper.toApiService(
        dbService({ id: OTHER_SERVICE_ID, ...stored }),
        [dbServiceOption()],
      )

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: expect.stringContaining(OTHER_SERVICE_ID),
        },
      })
    },
  )
})

describe('ServiceReadMapper.toApiServices', () => {
  it('maps every service with its own options, in order', () => {
    const result = ServiceReadMapper.toApiServices([
      {
        service: dbService({ id: OTHER_SERVICE_ID, name: 'カラー' }),
        options: [],
      },
      {
        service: dbService(),
        options: [dbServiceOption({ name: 'Head spa' })],
      },
    ])

    expect(result).toMatchObject({
      type: 'success',
      data: [
        {
          id: OTHER_SERVICE_ID,
          name: 'カラー',
          options: [],
          createdAt: '2026-11-14T09:00:00.123Z',
        },
        {
          id: SERVICE_ID,
          name: 'カット＆ブロー',
          options: [{ name: 'Head spa' }],
        },
      ],
    })
  })

  it('maps no service to an empty list', () => {
    expect(ServiceReadMapper.toApiServices([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('fails as a whole when one stored service is invalid, naming that service', () => {
    const result = ServiceReadMapper.toApiServices([
      { service: dbService(), options: [] },
      {
        service: dbService({ id: THIRD_SERVICE_ID, updatedAt: 'recently' }),
        options: [],
      },
    ])

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: expect.stringContaining(THIRD_SERVICE_ID),
      },
    })
  })
})
