import { addMinutes } from 'date-fns'
import { describe, expect, it } from 'vitest'
import {
  bookingNumberFrom,
  isOccupiedBeyondCapacity,
  occupancyWindowOf,
  RELEASING_STATUSES,
} from '../business-logic/booking'
import {
  bookingReachOf,
  isWithin,
} from '../business-logic/booking/_shared/authorization'
import type { Actor } from '../models/auth'
import type { BookingReach } from '../models/booking'
import { salonIdSchema } from '../models/salon'
import { actors } from './auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from './fixtures'

type Staff = Parameters<typeof isOccupiedBeyondCapacity>[0]

/** A staff member who keeps no time free and takes one booking at a time. */
const staff = (overrides: Partial<Staff> = {}): Staff => ({
  bufferTimeBefore: 0,
  bufferTimeAfter: 0,
  maxConcurrentBookings: 1,
  ...overrides,
})

/** A staff member who keeps ten minutes free before a service and fifteen after it. */
const withBuffers = (maxConcurrentBookings = 1): Staff =>
  staff({ bufferTimeBefore: 10, bufferTimeAfter: 15, maxConcurrentBookings })

/** A time of 20 November 2026, `HH:MM` in UTC. */
const at = (time: string): Date => new Date(`2026-11-20T${time}:00.000Z`)

const span = (from: string, until: string) => ({
  startTime: at(from),
  endTime: at(until),
})

/** A service line of another booking. */
const taken = (bookingId: string, from: string, until: string) => ({
  bookingId,
  ...span(from, until),
})

/** The service that is wanted in most cases: from ten to eleven. */
const wanted = [span('10:00', '11:00')]

describe('isOccupiedBeyondCapacity', () => {
  it('finds a staff member without bookings free', () => {
    expect(isOccupiedBeyondCapacity(staff(), wanted, [])).toBe(false)
  })

  it('finds a staff member free for a booking that wants no time of theirs', () => {
    expect(
      isOccupiedBeyondCapacity(staff(), [], [taken('a', '10:00', '11:00')]),
    ).toBe(false)
  })

  it.each([
    ['ends when the wanted one begins', '09:00', '10:00'],
    ['begins when the wanted one ends', '11:00', '12:00'],
    ['is over long before', '06:00', '07:00'],
    ['begins long after', '15:00', '16:00'],
  ])(
    'finds the staff member free when the other service %s',
    (_case, from, until) => {
      expect(
        isOccupiedBeyondCapacity(staff(), wanted, [taken('a', from, until)]),
      ).toBe(false)
    },
  )

  it.each([
    ['ends a minute into the wanted one', '09:00', '10:01'],
    ['begins a minute before the wanted one ends', '10:59', '12:00'],
    ['is within the wanted one', '10:15', '10:45'],
    ['is around the wanted one', '09:00', '12:00'],
    ['is at the same time', '10:00', '11:00'],
    ['begins with the wanted one', '10:00', '10:05'],
    ['ends with the wanted one', '10:55', '11:00'],
  ])(
    'finds the staff member occupied when the other service %s',
    (_case, from, until) => {
      expect(
        isOccupiedBeyondCapacity(staff(), wanted, [taken('a', from, until)]),
      ).toBe(true)
    },
  )

  describe('with time kept free before and after a service', () => {
    it.each([
      // The other is kept free until 09:50, where the wanted one begins to be.
      ['ends 25 minutes before the wanted one begins', '09:00', '09:35', false],
      ['ends 24 minutes before the wanted one begins', '09:00', '09:36', true],
      // The wanted one is kept free until 11:15, where the other begins to be.
      ['begins 25 minutes after the wanted one ends', '11:25', '12:00', false],
      ['begins 24 minutes after the wanted one ends', '11:24', '12:00', true],
      ['ends when the wanted one begins', '09:00', '10:00', true],
      ['begins when the wanted one ends', '11:00', '12:00', true],
    ])('a service that %s', (_case, from, until, occupied) => {
      expect(
        isOccupiedBeyondCapacity(withBuffers(), wanted, [
          taken('a', from, until),
        ]),
      ).toBe(occupied)
    })

    it('keeps the time before free only before, and the time after only after', () => {
      const before = staff({ bufferTimeBefore: 30 })
      const after = staff({ bufferTimeAfter: 30 })

      // The other ends 20 minutes before the wanted one begins.
      const earlier = [taken('a', '09:00', '09:40')]
      // The other begins 20 minutes after the wanted one ends.
      const later = [taken('a', '11:20', '12:00')]

      // Free before the wanted one: 09:30 to 10:00, into which the other reaches.
      expect(isOccupiedBeyondCapacity(before, wanted, earlier)).toBe(true)
      // Free before the other: 10:50 to 11:20, into which the wanted one reaches.
      expect(isOccupiedBeyondCapacity(before, wanted, later)).toBe(true)
      // Free after the other: 09:40 to 10:10.
      expect(isOccupiedBeyondCapacity(after, wanted, earlier)).toBe(true)
      // Free after the wanted one: 11:00 to 11:30.
      expect(isOccupiedBeyondCapacity(after, wanted, later)).toBe(true)
    })

    it('needs the sum of the two times between two services', () => {
      const both = staff({ bufferTimeBefore: 20, bufferTimeAfter: 20 })

      expect(
        isOccupiedBeyondCapacity(both, wanted, [taken('a', '09:00', '09:21')]),
      ).toBe(true)
      expect(
        isOccupiedBeyondCapacity(both, wanted, [taken('a', '09:00', '09:20')]),
      ).toBe(false)
    })
  })

  describe('for a staff member who takes two bookings at once', () => {
    const two = staff({ maxConcurrentBookings: 2 })

    it('finds them free next to one other booking', () => {
      expect(
        isOccupiedBeyondCapacity(two, wanted, [taken('a', '10:00', '11:00')]),
      ).toBe(false)
    })

    it('finds them occupied next to two other bookings at the same moment', () => {
      expect(
        isOccupiedBeyondCapacity(two, wanted, [
          taken('a', '10:00', '11:00'),
          taken('b', '10:30', '11:30'),
        ]),
      ).toBe(true)
    })

    it('counts the service lines of one booking once', () => {
      expect(
        isOccupiedBeyondCapacity(two, wanted, [
          taken('a', '10:00', '11:00'),
          taken('a', '10:30', '11:30'),
          taken('a', '09:30', '10:30'),
        ]),
      ).toBe(false)
    })

    it('finds them free next to two bookings that are never there at once', () => {
      expect(
        isOccupiedBeyondCapacity(two, wanted, [
          taken('a', '10:00', '10:20'),
          taken('b', '10:20', '11:00'),
        ]),
      ).toBe(false)
    })

    it('finds them free when the two others meet only outside the wanted time', () => {
      expect(
        isOccupiedBeyondCapacity(two, wanted, [
          taken('a', '09:00', '10:10'),
          taken('b', '09:00', '09:50'),
        ]),
      ).toBe(false)
      expect(
        isOccupiedBeyondCapacity(two, wanted, [
          taken('a', '10:50', '12:00'),
          taken('b', '11:00', '12:00'),
        ]),
      ).toBe(false)
    })

    it('finds them occupied when the two others meet only in the middle of the wanted time', () => {
      expect(
        isOccupiedBeyondCapacity(two, wanted, [
          taken('a', '09:30', '10:40'),
          taken('b', '10:30', '11:30'),
        ]),
      ).toBe(true)
    })

    it('finds them occupied when the two others meet in the last minute of the wanted time', () => {
      expect(
        isOccupiedBeyondCapacity(two, wanted, [
          taken('a', '09:00', '11:30'),
          taken('b', '10:59', '11:30'),
        ]),
      ).toBe(true)
    })

    it('widens every service by the time kept free before it counts', () => {
      // Without that time the two others are never there at once.
      const others = [
        taken('a', '10:00', '10:20'),
        taken('b', '10:30', '11:00'),
      ]

      expect(isOccupiedBeyondCapacity(two, wanted, others)).toBe(false)
      expect(isOccupiedBeyondCapacity(withBuffers(2), wanted, others)).toBe(
        true,
      )
    })
  })

  it('counts up to the number of bookings the staff member takes at once', () => {
    const three = staff({ maxConcurrentBookings: 3 })

    expect(
      isOccupiedBeyondCapacity(three, wanted, [
        taken('a', '10:00', '10:20'),
        taken('b', '10:10', '10:30'),
        taken('c', '10:15', '10:40'),
      ]),
    ).toBe(true)
    expect(
      isOccupiedBeyondCapacity(three, wanted, [
        taken('a', '10:00', '10:20'),
        taken('b', '10:10', '10:30'),
        taken('c', '10:20', '10:40'),
      ]),
    ).toBe(false)
  })

  describe('for a booking with several services of the staff member', () => {
    const several = [span('10:00', '11:00'), span('13:00', '14:00')]

    it('finds them occupied when any of the services meets another booking', () => {
      expect(
        isOccupiedBeyondCapacity(staff(), several, [
          taken('a', '13:30', '13:45'),
        ]),
      ).toBe(true)
      expect(
        isOccupiedBeyondCapacity(staff(), several, [
          taken('a', '09:30', '10:15'),
        ]),
      ).toBe(true)
    })

    it('finds them free for another booking between the services', () => {
      expect(
        isOccupiedBeyondCapacity(staff(), several, [
          taken('a', '11:00', '13:00'),
        ]),
      ).toBe(false)
    })

    it('does not count the services of the booking against each other', () => {
      const overlapping = [span('10:00', '11:00'), span('10:30', '11:30')]

      expect(isOccupiedBeyondCapacity(staff(), overlapping, [])).toBe(false)
    })
  })
})

describe('occupancyWindowOf', () => {
  it('is nothing for a booking that wants no time', () => {
    expect(occupancyWindowOf(withBuffers(), [])).toBeNull()
  })

  it('is the wanted time for a staff member who keeps no time free', () => {
    expect(occupancyWindowOf(staff(), wanted)).toEqual({
      from: at('10:00'),
      until: at('11:00'),
    })
  })

  it('is wider by both times kept free on both sides', () => {
    expect(occupancyWindowOf(withBuffers(), wanted)).toEqual({
      from: at('09:35'),
      until: at('11:25'),
    })
  })

  it('reaches from the earliest to the latest of several services', () => {
    expect(
      occupancyWindowOf(withBuffers(), [
        span('13:00', '14:00'),
        span('10:00', '11:00'),
        span('11:30', '11:45'),
      ]),
    ).toEqual({ from: at('09:35'), until: at('14:25') })
  })

  it('ends with the service that ends last, which need not begin last', () => {
    expect(
      occupancyWindowOf(staff(), [
        span('10:00', '14:00'),
        span('11:00', '12:00'),
      ]),
    ).toEqual({ from: at('10:00'), until: at('14:00') })
  })

  it.each([
    ['no time kept free', staff()],
    ['time kept free before and after', withBuffers()],
    ['time kept free before', staff({ bufferTimeBefore: 20 })],
    ['time kept free after', staff({ bufferTimeAfter: 20 })],
  ])('leaves out no service that stands in the way: %s', (_case, capacity) => {
    const several = [span('10:00', '11:00'), span('12:00', '12:30')]
    const window = occupancyWindowOf(capacity, several)
    const starts = Array.from({ length: 72 }, (_unused, index) =>
      addMinutes(at('08:00'), index * 5),
    )
    const outside = starts
      .flatMap((startTime) =>
        [5, 20, 45, 120].map((minutes) => ({
          bookingId: 'a',
          startTime,
          endTime: addMinutes(startTime, minutes),
        })),
      )
      .filter(
        ({ startTime, endTime }) =>
          window === null ||
          !(endTime > window.from && startTime < window.until),
      )

    expect(outside.length).toBeGreaterThan(0)
    expect(
      outside.filter((other) =>
        isOccupiedBeyondCapacity(capacity, several, [other]),
      ),
    ).toEqual([])
  })

  it.each([
    ['ends just inside it', '09:00', '09:36'],
    ['begins just inside it', '11:24', '12:00'],
  ])(
    'is no wider than it has to be: a service that %s stands in the way',
    (_case, from, until) => {
      expect(
        isOccupiedBeyondCapacity(withBuffers(), wanted, [
          taken('a', from, until),
        ]),
      ).toBe(true)
    },
  )
})

describe('RELEASING_STATUSES', () => {
  it('names the statuses in which a booking occupies nobody', () => {
    expect(RELEASING_STATUSES).toEqual(['cancelled', 'no_show'])
  })
})

describe('bookingNumberFrom', () => {
  /** Picks these symbols one after the other. */
  const picking = (picks: number[]) => {
    const upcoming = [...picks]
    return () => upcoming.shift() ?? 0
  }

  it('writes two groups of four symbols after BK', () => {
    expect(bookingNumberFrom(() => 0)).toBe('BK-0000-0000')
    expect(bookingNumberFrom(picking([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(
      'BK-1234-5678',
    )
  })

  it('asks eight times for one of 32 symbols', () => {
    const asked: number[] = []

    bookingNumberFrom((count) => {
      asked.push(count)
      return 0
    })

    expect(asked).toEqual([32, 32, 32, 32, 32, 32, 32, 32])
  })

  it('uses the digits and the capital letters without I, L, O and U', () => {
    const symbols = Array.from({ length: 32 }, (_unused, index) =>
      bookingNumberFrom(() => index).charAt(3),
    ).join('')

    expect(symbols).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ')
  })

  it('writes the symbols in the order they were picked', () => {
    expect(bookingNumberFrom(picking([31, 30, 29, 28, 10, 11, 12, 13]))).toBe(
      'BK-ZYXW-ABCD',
    )
  })

  it('is a number the booking number column holds', () => {
    expect(bookingNumberFrom(() => 31)).toMatch(
      /^BK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
    )
    expect(bookingNumberFrom(() => 31).length).toBeLessThanOrEqual(50)
  })
})

describe('bookingReachOf', () => {
  it('lets an admin reach the bookings of every salon', () => {
    expect(bookingReachOf(actors.admin)).toEqual({ type: 'everySalon' })
  })

  const roles: ('owner' | 'manager' | 'staff')[] = ['owner', 'manager', 'staff']

  it.each(roles)(
    'lets the %s of a salon reach the bookings of that salon',
    (role) => {
      expect(bookingReachOf(actors.ofSalon(role))).toEqual({
        type: 'salon',
        salonId: SALON_ID,
      })
      expect(bookingReachOf(actors.ofSalon(role, OTHER_SALON_ID))).toEqual({
        type: 'salon',
        salonId: OTHER_SALON_ID,
      })
    },
  )

  const reachingNone: [string, Actor][] = [
    ['a customer', actors.customer],
    ['a customer without a profile', actors.customerWithoutProfile],
    ['an account of a salon that reaches no salon', actors.withoutScope],
  ]

  it.each(reachingNone)('lets %s reach none', (_case, actor) => {
    expect(bookingReachOf(actor)).toBeNull()
  })
})

describe('isWithin', () => {
  const salon = salonIdSchema.parse(SALON_ID)
  const otherSalon = salonIdSchema.parse(OTHER_SALON_ID)
  const everySalon: BookingReach = { type: 'everySalon' }
  const oneSalon: BookingReach = { type: 'salon', salonId: salon }

  it('finds every salon within the reach of an admin', () => {
    expect(isWithin(everySalon, salon)).toBe(true)
    expect(isWithin(everySalon, otherSalon)).toBe(true)
  })

  it('finds only their salon within the reach of a member of a salon', () => {
    expect(isWithin(oneSalon, salon)).toBe(true)
    expect(isWithin(oneSalon, otherSalon)).toBe(false)
  })
})
