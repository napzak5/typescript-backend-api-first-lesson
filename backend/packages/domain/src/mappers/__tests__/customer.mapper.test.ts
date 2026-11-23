import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import {
  apiCustomer,
  customerCreateRequest,
  dbCustomer,
  OTHER_CUSTOMER_ID,
  REFERRER_ID,
} from '../../__tests__/fixtures/customer-fixtures'
import { RULES_BROKEN_BY_STORED } from '../../__tests__/fixtures/fixtures'
import {
  type ApiCustomerCreateRequest,
  type ApiCustomerResponse,
  customerIdSchema,
} from '../../models/customer'
import { CustomerReadMapper } from '../read/customer.mapper'
import { CustomerWriteMapper } from '../write/customer.mapper'

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

      expect(result).toEqual({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored customer ${OTHER_CUSTOMER_ID} does not match the API model`,
          cause: RULES_BROKEN_BY_STORED,
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

describe('CustomerReadMapper.toApiCustomerPage', () => {
  it('answers with the customers of the list and where the list goes on', () => {
    const result = CustomerReadMapper.toApiCustomerPage(
      {
        customers: [dbCustomer(), dbCustomer({ id: OTHER_CUSTOMER_ID })],
        total: 5,
        hasMore: true,
      },
      { limit: 2, after: customerIdSchema.parse(REFERRER_ID) },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: CUSTOMER_ID }, { id: OTHER_CUSTOMER_ID }],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: REFERRER_ID,
          nextCursor: OTHER_CUSTOMER_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('ends the list with a page that has no next cursor', () => {
    const result = CustomerReadMapper.toApiCustomerPage(
      { customers: [dbCustomer()], total: 1, hasMore: false },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { cursor: null, nextCursor: null, hasMore: false } },
    })
  })

  it('fails as a whole when one stored customer is invalid', () => {
    const result = CustomerReadMapper.toApiCustomerPage(
      {
        customers: [dbCustomer({ updatedAt: 'recently' })],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('the answers of CustomerReadMapper to a request for several customers', () => {
  const both = [dbCustomer({ id: OTHER_CUSTOMER_ID }), dbCustomer()]

  it('names the customers that were added, in the order they were written', () => {
    expect(CustomerReadMapper.toApiBulkCreate(both)).toStrictEqual({
      created: [OTHER_CUSTOMER_ID, CUSTOMER_ID],
    })
  })

  it('names the customers that were changed, in the order they were written', () => {
    expect(CustomerReadMapper.toApiBulkUpdate(both)).toStrictEqual({
      updated: [OTHER_CUSTOMER_ID, CUSTOMER_ID],
    })
  })

  it('names the customers that were deleted, in the order of the request', () => {
    expect(
      CustomerReadMapper.toApiBulkDelete([
        customerIdSchema.parse(OTHER_CUSTOMER_ID),
        customerIdSchema.parse(CUSTOMER_ID),
      ]),
    ).toStrictEqual({ deleted: [OTHER_CUSTOMER_ID, CUSTOMER_ID] })
  })
})

describe('CustomerWriteMapper.fromSearchRequest', () => {
  it('asks for the first 20 customers, by no filter, when the request names nothing', () => {
    expect(CustomerWriteMapper.fromSearchRequest({})).toStrictEqual({
      limit: 20,
      after: null,
      search: null,
      phoneDigits: null,
      tags: [],
      registeredFrom: null,
      registeredTo: null,
      customerStatus: null,
      membershipTier: null,
    })
  })

  it('takes the place and every filter the request names, as they are', () => {
    expect(
      CustomerWriteMapper.fromSearchRequest({
        limit: 3,
        cursor: customerIdSchema.parse(OTHER_CUSTOMER_ID),
        search: '山田',
        tags: ['regular', 'vip'],
        registeredFrom: '2026-01-01T00:00:00.000Z',
        registeredTo: '2026-12-31T23:59:59.999Z',
        customerStatus: 'active',
        membershipTier: 'gold',
      }),
    ).toStrictEqual({
      limit: 3,
      after: OTHER_CUSTOMER_ID,
      search: '山田',
      phoneDigits: null,
      tags: ['regular', 'vip'],
      registeredFrom: '2026-01-01T00:00:00.000Z',
      registeredTo: '2026-12-31T23:59:59.999Z',
      customerStatus: 'active',
      membershipTier: 'gold',
    })
  })

  it('compares a keyword that is written like a phone number with the digits of the phone numbers too', () => {
    expect(
      CustomerWriteMapper.fromSearchRequest({ search: '090-1234 5678' }),
    ).toMatchObject({ search: '090-1234 5678', phoneDigits: '09012345678' })
  })
})

describe('CustomerWriteMapper.fromExportRequest', () => {
  it('filters by nothing when the request names nothing, and has no page', () => {
    expect(CustomerWriteMapper.fromExportRequest({})).toStrictEqual({
      search: null,
      phoneDigits: null,
      tags: [],
      registeredFrom: null,
      registeredTo: null,
      customerStatus: null,
      membershipTier: null,
    })
  })

  it('takes every filter of the list', () => {
    expect(
      CustomerWriteMapper.fromExportRequest({
        search: '(03) 1234',
        tags: ['vip'],
        registeredFrom: '2026-01-01T00:00:00.000Z',
        registeredTo: '2026-06-30T00:00:00.000Z',
        customerStatus: 'inactive',
        membershipTier: 'regular',
      }),
    ).toStrictEqual({
      search: '(03) 1234',
      phoneDigits: '031234',
      tags: ['vip'],
      registeredFrom: '2026-01-01T00:00:00.000Z',
      registeredTo: '2026-06-30T00:00:00.000Z',
      customerStatus: 'inactive',
      membershipTier: 'regular',
    })
  })
})

describe('the requests of CustomerWriteMapper for several customers', () => {
  const first = customerIdSchema.parse(OTHER_CUSTOMER_ID)
  const second = customerIdSchema.parse(CUSTOMER_ID)

  it('reads the customers in the order the request names them', () => {
    expect(
      CustomerWriteMapper.fromBatchGetRequest({ ids: [first, second] }),
    ).toStrictEqual([OTHER_CUSTOMER_ID, CUSTOMER_ID])
  })

  it('makes a row of every item to add, in the order of the request', () => {
    const other = { ...customerCreateRequest(), firstName: '太郎', tags: [] }

    expect(
      CustomerWriteMapper.fromBulkCreateRequest({
        items: [other, customerCreateRequest()],
      }),
    ).toStrictEqual([other, customerCreateRequest()])
  })

  it('makes the changes of every item to change, in the order of the request, and nothing an item does not name', () => {
    expect(
      CustomerWriteMapper.fromBulkUpdateRequest({
        items: [
          { id: first, updates: { firstName: '太郎' } },
          { id: second, updates: { notes: null, tags: [] } },
        ],
      }),
    ).toStrictEqual([
      { id: OTHER_CUSTOMER_ID, changes: { firstName: '太郎' } },
      { id: CUSTOMER_ID, changes: { notes: null, tags: [] } },
    ])
  })

  it('deletes the customers in the order the request names them', () => {
    expect(
      CustomerWriteMapper.fromBulkDeleteRequest({ ids: [first, second] }),
    ).toStrictEqual([OTHER_CUSTOMER_ID, CUSTOMER_ID])
  })

  it('merges the two customers the request names, by the resolution it names', () => {
    expect(
      CustomerWriteMapper.fromMergeRequest({
        primaryCustomerId: first,
        secondaryCustomerId: second,
        conflictResolution: 'keep_newest',
      }),
    ).toStrictEqual({
      primaryCustomerId: OTHER_CUSTOMER_ID,
      secondaryCustomerId: CUSTOMER_ID,
      conflictResolution: 'keep_newest',
    })
  })
})
