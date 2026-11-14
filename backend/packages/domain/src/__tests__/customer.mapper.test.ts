import { describe, expect, it } from 'vitest'
import { CustomerReadMapper } from '../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../mappers/write/customer.mapper'
import type {
  ApiCustomerCreateRequest,
  ApiCustomerResponse,
} from '../models/customer'
import { CUSTOMER_ID } from './auth-fixtures'
import {
  apiCustomer,
  customerCreateRequest,
  dbCustomer,
  OTHER_CUSTOMER_ID,
  REFERRER_ID,
} from './customer-fixtures'

/** The properties of a CustomerResponse. */
const RESPONSE_PROPERTIES = [
  'address',
  'allowEmail',
  'allowMarketing',
  'allowSms',
  'alternativePhone',
  'birthDate',
  'building',
  'cancellationCount',
  'city',
  'createdAt',
  'customerStatus',
  'email',
  'firstName',
  'firstNameKana',
  'firstVisitDate',
  'gender',
  'hairThickness',
  'hairType',
  'id',
  'internalNotes',
  'isActive',
  'lastName',
  'lastNameKana',
  'lastVisitDate',
  'lifetimeValue',
  'loyaltyPoints',
  'membershipTier',
  'noShowCount',
  'notes',
  'occupation',
  'phoneNumber',
  'postalCode',
  'prefecture',
  'preferences',
  'referralCode',
  'referredBy',
  'scalpCondition',
  'tags',
  'updatedAt',
  'userId',
  'visitCount',
]

/** A row whose every nullable column is null. */
const rowWithoutOptionalValues: Partial<ApiCustomerResponse> = {
  userId: null,
  firstNameKana: null,
  lastNameKana: null,
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  preferences: null,
  notes: null,
  internalNotes: null,
  referredBy: null,
  referralCode: null,
  firstVisitDate: null,
  lastVisitDate: null,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
}

describe('CustomerWriteMapper.fromCreateRequest', () => {
  it('keeps every property under its own name, which is the name of its column', () => {
    const request = customerCreateRequest()

    const row = CustomerWriteMapper.fromCreateRequest(request)

    expect(row).toEqual(customerCreateRequest())
  })

  it('keeps null, false, empty lists and the order of the lists as they are', () => {
    const request: ApiCustomerCreateRequest = {
      ...customerCreateRequest(),
      firstNameKana: null,
      lastNameKana: null,
      alternativePhone: null,
      postalCode: null,
      prefecture: null,
      city: null,
      address: null,
      building: null,
      birthDate: null,
      gender: null,
      occupation: null,
      preferences: { preferredServices: ['spa', 'cut'], notes: null },
      notes: null,
      internalNotes: null,
      tags: [],
      referredBy: null,
      referralCode: null,
      allowMarketing: false,
      allowEmail: false,
      isActive: false,
      hairType: null,
      hairThickness: null,
      scalpCondition: null,
    }

    const row = CustomerWriteMapper.fromCreateRequest(request)

    expect(row).toEqual(request)
  })
})

describe('CustomerWriteMapper.fromUpdateRequest', () => {
  it('changes only the properties that are present', () => {
    const changes = CustomerWriteMapper.fromUpdateRequest({
      lastName: '佐藤',
      tags: ['vip'],
    })

    expect(changes).toEqual({ lastName: '佐藤', tags: ['vip'] })
  })

  it('clears a nullable column when the property is null', () => {
    const changes = CustomerWriteMapper.fromUpdateRequest({
      referredBy: null,
      preferences: null,
      birthDate: null,
    })

    expect(changes).toEqual({
      referredBy: null,
      preferences: null,
      birthDate: null,
    })
  })

  it('replaces the tags with none when the request has an empty list', () => {
    expect(CustomerWriteMapper.fromUpdateRequest({ tags: [] })).toEqual({
      tags: [],
    })
  })

  it('changes every column when the request names every property', () => {
    expect(
      CustomerWriteMapper.fromUpdateRequest(customerCreateRequest()),
    ).toEqual(customerCreateRequest())
  })
})

describe('CustomerReadMapper.toApiCustomer', () => {
  it('returns every column under its own name, with the timestamps in ISO 8601 UTC', () => {
    const result = CustomerReadMapper.toApiCustomer(dbCustomer())

    expect(result).toEqual({
      type: 'success',
      data: {
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
        lifetimeValue: 48_000,
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
      },
    })
  })

  it('has exactly the properties of CustomerResponse, also for a deleted row', () => {
    const result = CustomerReadMapper.toApiCustomer(
      dbCustomer({ deletedAt: '2026-11-15 10:00:00+00' }),
    )

    expect(result.type).toBe('success')
    expect(
      Object.keys(result.type === 'success' ? result.data : {}).toSorted(),
    ).toEqual(RESPONSE_PROPERTIES)
  })

  it('keeps null as null', () => {
    const result = CustomerReadMapper.toApiCustomer(
      dbCustomer(rowWithoutOptionalValues),
    )

    expect(result).toEqual({
      type: 'success',
      data: apiCustomer(rowWithoutOptionalValues),
    })
  })

  it('keeps false, zero, empty lists and the order of the lists as they are stored', () => {
    const stored: Partial<ApiCustomerResponse> = {
      tags: ['vip', 'color', 'regular'],
      preferences: {
        preferredServices: ['spa', 'cut', 'color'],
        notes: '窓際',
      },
      allowMarketing: false,
      allowEmail: false,
      isActive: false,
      loyaltyPoints: 0,
      lifetimeValue: 0,
      visitCount: 0,
      noShowCount: 0,
      cancellationCount: 0,
    }

    const result = CustomerReadMapper.toApiCustomer(dbCustomer(stored))

    expect(result).toEqual({ type: 'success', data: apiCustomer(stored) })
  })

  it('keeps an inactive customer with the status vip as stored', () => {
    const stored: Partial<ApiCustomerResponse> = {
      isActive: false,
      customerStatus: 'vip',
    }

    const result = CustomerReadMapper.toApiCustomer(dbCustomer(stored))

    expect(result).toEqual({ type: 'success', data: apiCustomer(stored) })
  })

  it.each(['male', 'female', 'other', 'prefer_not_to_say'])(
    'returns the gender %s',
    (gender) => {
      const result = CustomerReadMapper.toApiCustomer(dbCustomer({ gender }))

      expect(result).toMatchObject({ type: 'success', data: { gender } })
    },
  )

  it('returns preferences without any preferred service', () => {
    const preferences = { preferredServices: [], notes: 'Quiet seat' }

    const result = CustomerReadMapper.toApiCustomer(dbCustomer({ preferences }))

    expect(result).toMatchObject({ type: 'success', data: { preferences } })
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
    const result = CustomerReadMapper.toApiCustomer(
      dbCustomer({ createdAt: stored, updatedAt: stored }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { createdAt: expected, updatedAt: expected },
    })
  })

  it.each<[string, Record<string, unknown>]>([
    ['a creation time that is not a timestamp', { createdAt: 'yesterday' }],
    ['an update time that is not a timestamp', { updatedAt: '' }],
    ['preferences that are an empty object', { preferences: {} }],
    [
      'preferences without notes',
      { preferences: { preferredServices: ['cut'] } },
    ],
    [
      'preferences with a property of their own',
      {
        preferences: { preferredServices: ['cut'], notes: null, colour: 'red' },
      },
    ],
    [
      'a preferred service that is no service category',
      { preferences: { preferredServices: ['nails'], notes: null } },
    ],
    [
      'preferred services that are not a list',
      { preferences: { preferredServices: 'cut', notes: null } },
    ],
    ['preferences that are a list', { preferences: ['cut'] }],
    ['a gender that is not one of the four', { gender: 'unknown' }],
    ['a gender in capitals', { gender: 'FEMALE' }],
  ])(
    'reports %s as a database error that names the customer, not as a bad request',
    (_case, stored) => {
      const result = CustomerReadMapper.toApiCustomer({
        ...dbCustomer({ id: OTHER_CUSTOMER_ID }),
        ...stored,
      })

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: expect.stringContaining(OTHER_CUSTOMER_ID),
        },
      })
    },
  )
})

describe('CustomerReadMapper.toApiCustomers', () => {
  it('maps every customer, in order', () => {
    const result = CustomerReadMapper.toApiCustomers([
      dbCustomer({ id: OTHER_CUSTOMER_ID, lastName: '佐藤' }),
      dbCustomer(),
    ])

    expect(result).toEqual({
      type: 'success',
      data: [
        apiCustomer({ id: OTHER_CUSTOMER_ID, lastName: '佐藤' }),
        apiCustomer(),
      ],
    })
  })

  it('maps no customer to an empty list', () => {
    expect(CustomerReadMapper.toApiCustomers([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('fails as a whole when one stored customer is invalid, naming that customer', () => {
    const result = CustomerReadMapper.toApiCustomers([
      dbCustomer(),
      dbCustomer({ id: OTHER_CUSTOMER_ID, updatedAt: 'recently' }),
    ])

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: expect.stringContaining(OTHER_CUSTOMER_ID),
      },
    })
  })
})
