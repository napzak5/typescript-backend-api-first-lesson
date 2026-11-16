import { describe, expect, it } from 'vitest'
import { paymentLinks } from '../links'

const PAYMENTS = '/api/v1/payments'
const SALE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3a01'

describe('paymentLinks', () => {
  it('links a payment to its sale, which is served next to the payments', () => {
    expect(paymentLinks(PAYMENTS, SALE_ID)).toEqual({
      sale: `/api/v1/sales/${SALE_ID}`,
    })
  })

  it('keeps the part of the mount path above the payments as the request wrote it', () => {
    expect(paymentLinks('/API/v1/Payments', SALE_ID)).toEqual({
      sale: `/API/v1/sales/${SALE_ID}`,
    })
  })

  it('links to the sales at the root when the payments are mounted there', () => {
    expect(paymentLinks('/payments', SALE_ID)).toEqual({
      sale: `/sales/${SALE_ID}`,
    })
  })

  it('has no link of the payment itself: a payment is read with its sale', () => {
    expect(Object.keys(paymentLinks(PAYMENTS, SALE_ID))).toEqual(['sale'])
  })
})
