import { describe, expect, it } from 'vitest'
import { customerPointsLinks } from '../links'

const POINTS = '/api/v1/points'
const CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d01'

describe('customerPointsLinks', () => {
  it('links the balance and the history of the customer under the points', () => {
    expect(customerPointsLinks(POINTS, CUSTOMER_ID)).toEqual({
      balance: `${POINTS}/customer/${CUSTOMER_ID}/balance`,
      transactions: `${POINTS}/customer/${CUSTOMER_ID}/transactions`,
    })
  })

  it('keeps the mount path as the request wrote it', () => {
    expect(customerPointsLinks('/API/v1/Points', CUSTOMER_ID)).toEqual({
      balance: `/API/v1/Points/customer/${CUSTOMER_ID}/balance`,
      transactions: `/API/v1/Points/customer/${CUSTOMER_ID}/transactions`,
    })
  })

  it('links under the root when the points are mounted there', () => {
    expect(customerPointsLinks('', CUSTOMER_ID)).toEqual({
      balance: `/customer/${CUSTOMER_ID}/balance`,
      transactions: `/customer/${CUSTOMER_ID}/transactions`,
    })
  })

  it('has no link of a point transaction: it is read in the history', () => {
    expect(Object.keys(customerPointsLinks(POINTS, CUSTOMER_ID))).toEqual([
      'balance',
      'transactions',
    ])
  })
})
