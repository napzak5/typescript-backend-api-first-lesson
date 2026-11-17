import { describe, expect, it } from 'vitest'
import { CustomerProfileReadMapper } from '../mappers/read/customer-profile.mapper'
import { CustomerProfileWriteMapper } from '../mappers/write/customer-profile.mapper'
import type { ApiCustomerProfileCreateRequest } from '../models/customer'
import {
  apiCustomerProfile,
  customerProfileCreateRequest,
  dbCustomer,
} from './customer-fixtures'

/** What a new entry holds that the customer did not state. */
const STAFF_SIDE_OF_A_NEW_ENTRY = {
  membershipTier: 'regular',
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  isActive: true,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
}

/** The properties of a profile request that may be null. */
const NULLABLE_PROPERTIES: (keyof ApiCustomerProfileCreateRequest)[] = [
  'firstNameKana',
  'lastNameKana',
  'alternativePhone',
  'postalCode',
  'prefecture',
  'city',
  'address',
  'building',
  'birthDate',
  'gender',
  'occupation',
  'preferences',
]

/** What the ledger holds of a customer and the customer is not shown. */
const NOT_SHOWN_TO_THE_CUSTOMER = [
  'cancellationCount',
  'customerStatus',
  'internalNotes',
  'isActive',
  'noShowCount',
  'notes',
  'referredBy',
  'tags',
  'userId',
]

const withoutProperties = (
  request: ApiCustomerProfileCreateRequest,
  properties: string[],
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(request).filter(([name]) => !properties.includes(name)),
  )

describe('CustomerProfileWriteMapper.fromCreateRequest', () => {
  it('makes the new entry of the request and of what the staff would start a customer with', () => {
    const { newEntry } = CustomerProfileWriteMapper.fromCreateRequest(
      customerProfileCreateRequest(),
    )

    expect(newEntry).toEqual({
      ...customerProfileCreateRequest(),
      ...STAFF_SIDE_OF_A_NEW_ENTRY,
    })
  })

  it('keeps null, false and the order of the preferred services in the new entry', () => {
    const request: ApiCustomerProfileCreateRequest = {
      ...customerProfileCreateRequest(),
      ...Object.fromEntries(
        NULLABLE_PROPERTIES.map((property) => [property, null]),
      ),
      allowMarketing: false,
      allowEmail: false,
    }

    const { newEntry } = CustomerProfileWriteMapper.fromCreateRequest(request)

    expect(newEntry).toEqual({ ...request, ...STAFF_SIDE_OF_A_NEW_ENTRY })
  })

  it('claims an entry with every property of a request that states them all, and with nothing of the staff side', () => {
    const { claim } = CustomerProfileWriteMapper.fromCreateRequest(
      customerProfileCreateRequest(),
    )

    expect(claim).toEqual(customerProfileCreateRequest())
  })

  it.each(NULLABLE_PROPERTIES)(
    'leaves %s of a claimed entry as it is when the request states null',
    (property) => {
      const { claim } = CustomerProfileWriteMapper.fromCreateRequest({
        ...customerProfileCreateRequest(),
        [property]: null,
      })

      expect(claim).toEqual(
        withoutProperties(customerProfileCreateRequest(), [property]),
      )
    },
  )

  it('claims an entry with the names, the phone number and the three consents alone when everything else is null', () => {
    const { claim } = CustomerProfileWriteMapper.fromCreateRequest({
      ...customerProfileCreateRequest(),
      ...Object.fromEntries(
        NULLABLE_PROPERTIES.map((property) => [property, null]),
      ),
      allowMarketing: false,
      allowSms: false,
      allowEmail: false,
    })

    expect(claim).toEqual({
      firstName: '花子',
      lastName: '山田',
      phoneNumber: '090-1234-5678',
      allowMarketing: false,
      allowSms: false,
      allowEmail: false,
    })
  })
})

describe('CustomerProfileWriteMapper.fromUpdateRequest', () => {
  it('changes only the properties that are present', () => {
    const changes = CustomerProfileWriteMapper.fromUpdateRequest({
      lastName: '佐藤',
      allowSms: true,
    })

    expect(changes).toEqual({ lastName: '佐藤', allowSms: true })
  })

  it('keeps null, which unsets a property', () => {
    const changes = CustomerProfileWriteMapper.fromUpdateRequest({
      birthDate: null,
      preferences: null,
    })

    expect(changes).toEqual({ birthDate: null, preferences: null })
  })
})

describe('CustomerProfileReadMapper.toApiProfile', () => {
  it('presents the row as the ledger does, with the timestamps in ISO 8601', () => {
    const result = CustomerProfileReadMapper.toApiProfile(dbCustomer())

    expect(result).toEqual({ type: 'success', data: apiCustomerProfile() })
  })

  it.each(NOT_SHOWN_TO_THE_CUSTOMER)(
    'does not show %s, whatever the row holds',
    (property) => {
      const result = CustomerProfileReadMapper.toApiProfile(
        dbCustomer({
          userId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c01',
          notes: 'Prefers a short fringe',
          internalNotes: 'Complained twice',
          tags: ['difficult'],
          isActive: false,
          customerStatus: 'blacklisted',
        }),
      )

      expect(
        result.type === 'success' ? Object.keys(result.data) : [],
      ).not.toContain(property)
    },
  )

  it('shows exactly the properties of a profile', () => {
    const result = CustomerProfileReadMapper.toApiProfile(dbCustomer())

    expect(
      result.type === 'success' ? Object.keys(result.data).sort() : [],
    ).toEqual(Object.keys(apiCustomerProfile()).sort())
  })

  it('keeps null for every value the row does not have', () => {
    const withoutOptionalValues = {
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
      referralCode: null,
      firstVisitDate: null,
      lastVisitDate: null,
      hairType: null,
      hairThickness: null,
      scalpCondition: null,
    }

    const result = CustomerProfileReadMapper.toApiProfile(
      dbCustomer(withoutOptionalValues),
    )

    expect(result).toEqual({
      type: 'success',
      data: apiCustomerProfile(withoutOptionalValues),
    })
  })

  it.each([
    ['an update time that cannot be read', { updatedAt: 'yesterday' }],
    ['a creation time that cannot be read', { createdAt: 'long ago' }],
    [
      'preferences that are not preferences',
      { preferences: { favourite: 'cut' } },
    ],
  ])('reports a row with %s as a database error', (_case, columns) => {
    const result = CustomerProfileReadMapper.toApiProfile(dbCustomer(columns))

    expect(result).toEqual({
      type: 'error',
      error: expect.objectContaining({ type: 'database' }),
    })
  })
})
