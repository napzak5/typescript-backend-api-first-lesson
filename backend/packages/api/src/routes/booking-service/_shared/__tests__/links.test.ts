import { describe, expect, it } from 'vitest'
import { bookingServiceLinks } from '../links'

const BOOKING_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2b01'
const LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d01'
const BOOKING = `/api/v1/bookings/${BOOKING_ID}`

describe('bookingServiceLinks', () => {
  it('links a service line to itself and to its booking', () => {
    expect(bookingServiceLinks(`${BOOKING}/services`, LINE_ID)).toEqual({
      self: `${BOOKING}/services/${LINE_ID}`,
      booking: BOOKING,
    })
  })

  it('keeps the path as the request wrote it and appends the ID it is given', () => {
    const asked = `/API/v1/Bookings/${BOOKING_ID.toUpperCase()}`

    expect(bookingServiceLinks(`${asked}/Services`, LINE_ID)).toEqual({
      self: `${asked}/Services/${LINE_ID}`,
      booking: asked,
    })
  })

  it('takes the booking from above the last part of the path, whatever is above that', () => {
    expect(bookingServiceLinks('/bookings/b/services', LINE_ID)).toEqual({
      self: `/bookings/b/services/${LINE_ID}`,
      booking: '/bookings/b',
    })
    expect(
      bookingServiceLinks('/services/v1/bookings/b/services', LINE_ID).booking,
    ).toBe('/services/v1/bookings/b')
  })

  it('has no link to a list: the lines of a booking are read with the booking', () => {
    expect(
      Object.keys(bookingServiceLinks(`${BOOKING}/services`, LINE_ID)),
    ).toEqual(['self', 'booking'])
  })
})
