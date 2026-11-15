import { describe, expect, it } from 'vitest'
import { customerLinks, customerProfileLinks } from '../links'

const CUSTOMERS = '/api/v1/customers'
const CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d01'

describe('customerLinks', () => {
  it('links a customer to itself and to the ledger', () => {
    expect(customerLinks(CUSTOMERS, CUSTOMER_ID)).toEqual({
      self: `${CUSTOMERS}/${CUSTOMER_ID}`,
      list: CUSTOMERS,
    })
  })

  it('keeps the collection path as the request wrote it and appends the ID it is given', () => {
    const collection = '/API/v1/Customers'

    expect(customerLinks(collection, CUSTOMER_ID)).toEqual({
      self: `${collection}/${CUSTOMER_ID}`,
      list: collection,
    })
  })

  it('appends the ID as it is given, without changing its case', () => {
    const inUpperCase = CUSTOMER_ID.toUpperCase()

    expect(customerLinks(CUSTOMERS, inUpperCase).self).toBe(
      `${CUSTOMERS}/${inUpperCase}`,
    )
  })
})

describe('customerProfileLinks', () => {
  it('links the profile to itself: the one address every customer has for their own', () => {
    expect(customerProfileLinks(CUSTOMERS)).toEqual({
      self: `${CUSTOMERS}/me`,
    })
  })

  it('keeps the collection path as the request wrote it', () => {
    expect(customerProfileLinks('/API/v1/Customers')).toEqual({
      self: '/API/v1/Customers/me',
    })
  })
})
