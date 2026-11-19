import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  readBooking,
  readDayBookings,
  recordNoShow,
  startBooking,
} from './bookings-api'
import { aBooking, salon } from './components/examples'

/*
 * The answers the real API gives are met in the screen tests
 * (`bookings.integration.test.tsx`). Here are the ones a test cannot bring
 * about there (too many requests, an error of the server, no answer, a
 * status the contract does not name, a body the API did not read), and
 * what every operation sends.
 */

const booking = aBooking()

const OPERATIONS: [string, () => Promise<{ type: string }>][] = [
  ['confirmBooking', () => confirmBooking(booking.id)],
  ['startBooking', () => startBooking(booking.id)],
  [
    'completeBooking',
    () =>
      completeBooking(booking.id, {
        actualStartTime: null,
        actualEndTime: null,
      }),
  ],
  [
    'cancelBooking',
    () => cancelBooking(booking.id, { cancellationReason: null }),
  ],
  ['recordNoShow', () => recordNoShow(booking.id)],
]

const READS: [string, () => Promise<{ type: string }>][] = [
  [
    'readDayBookings',
    () => readDayBookings(salon.id, { date: '2026-11-20' }, undefined),
  ],
  ['readBooking', () => readBooking(booking.id)],
]

describe('the functions that call the API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each([...READS, ...OPERATIONS])('%s', (_name, call) => {
    it.each(UNREAD)(
      'should say why nothing came of %s',
      async (_case, answer, type) => {
        // Arrange
        answering(answer)

        // Act, Assert
        expect(await call()).toEqual({ type })
      },
    )
  })

  describe.each(OPERATIONS)('%s', (_name, call) => {
    it.each([413, 415])(
      'should fail on a body the API did not read (%i)',
      async (status) => {
        // Arrange
        answering(() => problem(status))

        // Act, Assert
        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  it('should ask for the bookings of one day, of the state and the member named, 50 at a time', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: [],
        meta: { total: 0, nextCursor: null },
        links: { self: '/api/v1/bookings' },
      }),
    )

    // Act
    await readDayBookings(
      salon.id,
      {
        date: '2026-11-20',
        status: 'confirmed',
        staffId: booking.staffId,
      },
      booking.id,
    )

    // Assert
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      salonId: salon.id,
      bookingDateFrom: '2026-11-20',
      bookingDateTo: '2026-11-20',
      status: 'confirmed',
      staffId: booking.staffId,
      cursor: booking.id,
      limit: '50',
    })
  })

  it('should not ask for a booking whose address holds no ID', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act
    const read = await readBooking('not-an-id')

    // Assert
    expect(read).toEqual({ type: 'notFound' })
    expect(fetched).not.toHaveBeenCalled()
  })

  it.each([
    [
      'completeBooking',
      () =>
        completeBooking(booking.id, {
          actualStartTime: null,
          actualEndTime: '2026-11-20T02:00:00.000Z',
        }),
      'complete',
      { actualStartTime: null, actualEndTime: '2026-11-20T02:00:00.000Z' },
    ],
    [
      'cancelBooking',
      () => cancelBooking(booking.id, { cancellationReason: '体調不良' }),
      'cancel',
      { cancellationReason: '体調不良' },
    ],
  ])(
    '%s should send its request to its operation',
    async (_name, call, operation, body) => {
      // Arrange
      const fetched = answering(() => problem(409))

      // Act
      const outcome = await call()

      // Assert
      expect(outcome).toEqual({ type: 'conflict' })
      expect(String(fetched.mock.calls[0]?.[0])).toBe(
        `http://localhost:3000/api/v1/bookings/${booking.id}/${operation}`,
      )
      expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual(body)
    },
  )
})
