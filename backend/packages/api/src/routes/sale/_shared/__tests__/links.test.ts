import { describe, expect, it } from 'vitest'
import { paymentOfSaleLinks, saleLinks } from '../links'

const SALES = '/api/v1/sales'
const SALE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3a01'

describe('saleLinks', () => {
  it('links a sale to itself and to the ledger', () => {
    expect(saleLinks(SALES, SALE_ID)).toEqual({
      self: `${SALES}/${SALE_ID}`,
      list: SALES,
    })
  })

  it('keeps the collection path as the request wrote it and appends the ID it is given', () => {
    const collection = '/API/v1/Sales'

    expect(saleLinks(collection, SALE_ID)).toEqual({
      self: `${collection}/${SALE_ID}`,
      list: collection,
    })
  })

  it('has no other link: what can be done with a sale depends on its state, which the sale states', () => {
    expect(Object.keys(saleLinks(SALES, SALE_ID))).toEqual(['self', 'list'])
  })
})

describe('paymentOfSaleLinks', () => {
  it('links a payment that was recorded below a sale to that sale', () => {
    expect(paymentOfSaleLinks(SALES, SALE_ID)).toEqual({
      sale: `${SALES}/${SALE_ID}`,
    })
  })

  it('keeps the collection path as the request wrote it', () => {
    const collection = '/API/v1/Sales'

    expect(paymentOfSaleLinks(collection, SALE_ID)).toEqual({
      sale: `${collection}/${SALE_ID}`,
    })
  })

  it('has no link of the payment itself: a payment is read with its sale', () => {
    expect(Object.keys(paymentOfSaleLinks(SALES, SALE_ID))).toEqual(['sale'])
  })
})
