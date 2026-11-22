import { describe, expect, it } from 'vitest'
import { CustomerPreferencesReadMapper } from '../mappers/read/customer-preferences.mapper'
import { CustomerPreferencesWriteMapper } from '../mappers/write/customer-preferences.mapper'
import { customerIdSchema } from '../models/customer'
import type { DbCustomerPreferencesChanges } from '../models/customer-preferences'
import { CUSTOMER_ID } from './auth-fixtures'
import {
  apiCustomerPreferences,
  customerPreferencesUpdateRequest,
  dbCustomerPreferences,
  emptyCustomerPreferences,
} from './customer-preferences-fixtures'

/** The properties of a CustomerPreferencesResponse. */
const RESPONSE_PROPERTIES = [
  'avoidStaffIds',
  'communicationStyle',
  'preferredStaffId',
  'preferredTimeSlots',
  'specialRequests',
  'stylePreferences',
]

const customerId = customerIdSchema.parse(CUSTOMER_ID)

const toApi = (overrides: DbCustomerPreferencesChanges = {}) =>
  CustomerPreferencesReadMapper.toApiPreferences(
    customerId,
    dbCustomerPreferences(overrides),
  )

const storedRowIsCorrupt = {
  type: 'error',
  error: {
    type: 'database',
    message: `Stored preferences of customer ${CUSTOMER_ID} do not match the API model`,
    cause: expect.objectContaining({ type: 'validation' }),
  },
}

describe('CustomerPreferencesReadMapper.toApiPreferences', () => {
  it('returns the columns as they are stored, under their own names', () => {
    expect(toApi()).toEqual({ type: 'success', data: apiCustomerPreferences() })
  })

  it('has the properties of the response and no other', () => {
    const result = toApi()

    expect(
      result.type === 'success' ? Object.keys(result.data).toSorted() : [],
    ).toEqual(RESPONSE_PROPERTIES)
  })

  it('returns the preferences of a customer without a row: empty lists, and null for the rest', () => {
    expect(
      CustomerPreferencesReadMapper.toApiPreferences(
        customerId,
        emptyCustomerPreferences(),
      ),
    ).toEqual({
      type: 'success',
      data: {
        preferredStaffId: null,
        preferredTimeSlots: [],
        avoidStaffIds: [],
        stylePreferences: null,
        communicationStyle: null,
        specialRequests: null,
      },
    })
  })

  it('keeps null as null and an empty list as an empty list', () => {
    const stylePreferences = {
      preferredLength: null,
      preferredColors: [],
      avoidStyles: [],
      inspirationImages: [],
    }

    expect(toApi({ stylePreferences, specialRequests: null })).toEqual({
      type: 'success',
      data: apiCustomerPreferences({ stylePreferences, specialRequests: null }),
    })
  })

  it('returns stored values that a request could not state, as long as they have the shape', () => {
    const stored = {
      preferredTimeSlots: [
        { startTime: '12:00', endTime: '10:00' },
        { startTime: '09:00', endTime: '13:00' },
      ],
      stylePreferences: {
        preferredLength: ' ',
        preferredColors: ['a', 'a'],
        avoidStyles: [''],
        inspirationImages: ['short.jpg'],
      },
      communicationStyle: ' ',
    }

    expect(toApi(stored)).toEqual({
      type: 'success',
      data: apiCustomerPreferences(stored),
    })
  })

  it.each<[string, DbCustomerPreferencesChanges]>([
    ['time slots that are not a list', { preferredTimeSlots: {} }],
    ['time slots that are null', { preferredTimeSlots: null }],
    [
      'a time slot without an end',
      { preferredTimeSlots: [{ startTime: '10:00' }] },
    ],
    [
      'a time slot with seconds',
      { preferredTimeSlots: [{ startTime: '10:00:00', endTime: '12:00:00' }] },
    ],
    [
      'a time slot with another property',
      {
        preferredTimeSlots: [{ startTime: '10:00', endTime: '12:00', day: 1 }],
      },
    ],
    ['a style preference that is the empty object', { stylePreferences: {} }],
    ['a style preference that is a list', { stylePreferences: [] }],
    [
      'a style preference with a list that is null',
      {
        stylePreferences: {
          preferredLength: null,
          preferredColors: null,
          avoidStyles: [],
          inspirationImages: [],
        },
      },
    ],
    [
      'a style preference with another property',
      {
        stylePreferences: {
          preferredLength: null,
          preferredColors: [],
          avoidStyles: [],
          inspirationImages: [],
          note: 'x',
        },
      },
    ],
  ])('answers with a database error for %s', (_case, stored) => {
    expect(toApi(stored)).toEqual(storedRowIsCorrupt)
  })
})

describe('CustomerPreferencesWriteMapper.fromUpdateRequest', () => {
  it('changes every column the request names, as it is', () => {
    expect(
      CustomerPreferencesWriteMapper.fromUpdateRequest(
        customerPreferencesUpdateRequest(),
      ),
    ).toStrictEqual(customerPreferencesUpdateRequest())
  })

  it('changes only the properties that are present, and clears with null or an empty list', () => {
    expect(
      CustomerPreferencesWriteMapper.fromUpdateRequest({
        preferredStaffId: null,
        avoidStaffIds: [],
      }),
    ).toStrictEqual({ preferredStaffId: null, avoidStaffIds: [] })
  })
})
