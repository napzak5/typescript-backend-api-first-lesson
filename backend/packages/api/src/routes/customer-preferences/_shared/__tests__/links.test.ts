import { describe, expect, it } from 'vitest'
import { customerPreferencesLinks } from '../links'

const CUSTOMER = '/api/v1/customers/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c01'
const PREFERENCES = `${CUSTOMER}/preferences`

describe('customerPreferencesLinks', () => {
  it('links the preferences to themselves and to the customer whose they are', () => {
    expect(customerPreferencesLinks(PREFERENCES)).toEqual({
      self: PREFERENCES,
      customer: CUSTOMER,
    })
  })

  it('links the own preferences to the own profile', () => {
    expect(
      customerPreferencesLinks('/api/v1/customers/me/preferences'),
    ).toEqual({
      self: '/api/v1/customers/me/preferences',
      customer: '/api/v1/customers/me',
    })
  })

  it('keeps the path as the request wrote it', () => {
    expect(customerPreferencesLinks(PREFERENCES.toUpperCase())).toEqual({
      self: PREFERENCES.toUpperCase(),
      customer: CUSTOMER.toUpperCase(),
    })
  })

  it('takes the customer from the last segment alone, whatever the routes are mounted below', () => {
    expect(customerPreferencesLinks('/v2/clients/42/preferences')).toEqual({
      self: '/v2/clients/42/preferences',
      customer: '/v2/clients/42',
    })
  })
})
