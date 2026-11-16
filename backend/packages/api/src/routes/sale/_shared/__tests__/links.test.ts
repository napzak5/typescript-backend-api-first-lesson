import { describe, expect, it } from 'vitest'
import {
  paymentOfSaleLinks,
  saleCalculationLinks,
  saleLinks,
  saleReceiptLinks,
} from '../links'

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

describe('saleReceiptLinks', () => {
  it('links a receipt to itself and to the sale it is made from', () => {
    expect(saleReceiptLinks(SALES, SALE_ID)).toEqual({
      self: `${SALES}/${SALE_ID}/receipt`,
      sale: `${SALES}/${SALE_ID}`,
    })
  })

  it('keeps the collection path as the request wrote it', () => {
    const collection = '/API/v1/Sales'

    expect(saleReceiptLinks(collection, SALE_ID)).toEqual({
      self: `${collection}/${SALE_ID}/receipt`,
      sale: `${collection}/${SALE_ID}`,
    })
  })

  it('has no link to the ledger: a receipt is of one sale', () => {
    expect(Object.keys(saleReceiptLinks(SALES, SALE_ID))).toEqual([
      'self',
      'sale',
    ])
  })
})

describe('saleCalculationLinks', () => {
  it('links a calculation to where it is asked for and to the ledger', () => {
    expect(saleCalculationLinks(SALES)).toEqual({
      self: `${SALES}/calculate`,
      list: SALES,
    })
  })

  it('keeps the collection path as the request wrote it', () => {
    const collection = '/API/v1/Sales'

    expect(saleCalculationLinks(collection)).toEqual({
      self: `${collection}/calculate`,
      list: collection,
    })
  })

  it('has no link of a sale: nothing is entered by a calculation', () => {
    expect(Object.keys(saleCalculationLinks(SALES))).toEqual(['self', 'list'])
  })
})
