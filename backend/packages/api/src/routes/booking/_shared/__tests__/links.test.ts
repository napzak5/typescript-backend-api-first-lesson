import { describe, expect, it } from 'vitest'
import { bookingLinks } from '../links'

const BOOKINGS = '/api/v1/bookings'
const BOOKING_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2b01'

describe('bookingLinks', () => {
  it('links a booking to itself and to the ledger', () => {
    expect(bookingLinks(BOOKINGS, BOOKING_ID)).toEqual({
      self: `${BOOKINGS}/${BOOKING_ID}`,
      list: BOOKINGS,
    })
  })

  it('keeps the collection path as the request wrote it and appends the ID it is given', () => {
    const collection = '/API/v1/Bookings'

    expect(bookingLinks(collection, BOOKING_ID)).toEqual({
      self: `${collection}/${BOOKING_ID}`,
      list: collection,
    })
  })

  it('has no other link: what else is done with a booking is not offered yet', () => {
    expect(Object.keys(bookingLinks(BOOKINGS, BOOKING_ID))).toEqual([
      'self',
      'list',
    ])
  })
})
