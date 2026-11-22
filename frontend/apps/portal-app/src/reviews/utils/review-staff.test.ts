import { describe, expect, it } from 'vitest'
import { staff } from '../../salons/components/examples'
import { reviewersOf } from './review-staff'

const [first, second, third] = staff.map(({ id }) => id)

const FIRST = first ?? ''
const SECOND = second ?? ''
const THIRD = third ?? ''

/** A booking with a member of the staff, whose services are done by these. */
const bookingWith = (staffId: string, ...ofServices: (string | null)[]) => ({
  staffId,
  services: ofServices.map((id) => ({
    id: 'f81a3c4d-790e-4b24-8c46-e80a13356957',
    serviceId: '1a3c5e7f-9b20-4d46-8e68-0a2c4e6f8b79',
    staffId: id,
    startTime: '2026-11-07T01:30:00.000Z',
    endTime: '2026-11-07T02:30:00.000Z',
    duration: 60,
    price: 5500,
    discountAmount: 0,
    finalPrice: 5500,
    taxIncluded: true,
    sortOrder: 0,
  })),
})

const idsOf = (members: readonly { id: string }[]): string[] =>
  members.map(({ id }) => id)

describe('reviewersOf', () => {
  it('should have three members of the staff to tell apart', () => {
    expect(new Set([FIRST, SECOND, THIRD, '']).size).toBe(4)
  })

  it('should offer the member the booking was with', () => {
    expect(idsOf(reviewersOf(bookingWith(SECOND), staff))).toEqual([SECOND])
  })

  it('should offer those who did a service after the member of the booking, in the order of the services', () => {
    expect(
      idsOf(reviewersOf(bookingWith(SECOND, THIRD, FIRST), staff)),
    ).toEqual([SECOND, THIRD, FIRST])
  })

  it('should offer each member once, whatever they did', () => {
    expect(
      idsOf(reviewersOf(bookingWith(FIRST, FIRST, SECOND, SECOND), staff)),
    ).toEqual([FIRST, SECOND])
  })

  it('should pass over a service that nobody is named for', () => {
    expect(idsOf(reviewersOf(bookingWith(FIRST, null, SECOND), staff))).toEqual(
      [FIRST, SECOND],
    )
  })

  it('should not offer a member the salon does not show, and keep the others', () => {
    const shown = staff.filter(({ id }) => id !== FIRST)

    expect(idsOf(reviewersOf(bookingWith(FIRST, SECOND), shown))).toEqual([
      SECOND,
    ])
  })

  it('should offer nobody when the salon shows none of them', () => {
    expect(reviewersOf(bookingWith(FIRST, SECOND), [])).toEqual([])
  })

  it('should hand over the members as the salon shows them', () => {
    expect(reviewersOf(bookingWith(FIRST), staff)).toEqual(
      staff.filter(({ id }) => id === FIRST),
    )
  })
})
