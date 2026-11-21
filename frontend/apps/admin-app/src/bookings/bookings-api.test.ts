import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LineRemovalAttempt } from './booking-moves'
import {
  addBookingLine,
  attemptAddition,
  attemptLineRemoval,
  attemptMove,
  cancelBooking,
  checkLine,
  checkSlot,
  completeBooking,
  confirmBooking,
  createBooking,
  deleteBooking,
  deleteBookingLine,
  readBooking,
  readBookingLine,
  readDayBookings,
  recordNoShow,
  rescheduleBooking,
  startBooking,
  updateBooking,
} from './bookings-api'
import { aBooking, salon, services } from './components/examples'

/*
 * The answers the real API gives are met in the screen tests
 * (`bookings.integration.test.tsx`). Here are the ones a test cannot bring
 * about there (too many requests, an error of the server, no answer, a
 * status the contract does not name, a body the API did not read), and
 * what every operation sends.
 */

const booking = aBooking()

const LINE_ID = booking.services[0]?.id ?? ''

const LINE = {
  serviceId: services[0]?.id ?? '',
  staffId: booking.staffId,
  startTime: '2026-11-20T02:00:00.000Z',
  notes: null,
}

const MOVE = { staffId: booking.staffId, startTime: '2026-11-20T03:00:00.000Z' }

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

const CREATION = {
  salonId: salon.id,
  customerId: booking.customerId,
  staffId: booking.staffId,
  services: [
    {
      serviceId: services[0]?.id ?? '',
      staffId: null,
      startTime: '2026-11-20T01:00:00.000Z',
      notes: null,
    },
  ],
  source: 'phone',
  depositAmount: null,
  customerRequest: null,
  internalNotes: null,
}

const SLOT = {
  staffId: booking.staffId,
  serviceId: services[0]?.id ?? '',
  startTime: '2026-11-20T01:00:00.000Z',
}

/** The calls that send a body, and name the values the API refused */
const WRITES: [string, () => Promise<{ type: string }>][] = [
  ['createBooking', () => createBooking(CREATION)],
  [
    'updateBooking',
    () => updateBooking(booking.id, { internalNotes: '次回はカラーも' }),
  ],
  ['rescheduleBooking', () => rescheduleBooking(booking.id, MOVE)],
  ['addBookingLine', () => addBookingLine(booking.id, LINE)],
]

const CHANGES: [string, () => Promise<{ type: string }>][] = [
  ...WRITES,
  ['deleteBooking', () => deleteBooking(booking.id)],
  ['deleteBookingLine', () => deleteBookingLine(booking.id, LINE_ID)],
  ['checkSlot', () => checkSlot(salon.id, SLOT)],
]

const READS: [string, () => Promise<{ type: string }>][] = [
  [
    'readDayBookings',
    () => readDayBookings(salon.id, { date: '2026-11-20' }, undefined),
  ],
  ['readBooking', () => readBooking(booking.id)],
  ['readBookingLine', () => readBookingLine(booking.id, LINE_ID)],
]

describe('the functions that call the API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each([...READS, ...OPERATIONS, ...CHANGES])('%s', (_name, call) => {
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

  describe.each([
    ...OPERATIONS,
    ...WRITES,
    ['checkSlot', () => checkSlot(salon.id, SLOT)],
  ])('%s', (_name, call) => {
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

  it.each<[string, string, string]>([
    ['the booking', 'not-an-id', LINE_ID],
    ['the line', booking.id, 'new'],
  ])(
    'should not ask for a line when the address holds no ID of %s',
    async (_part, bookingId, lineId) => {
      // Arrange
      const fetched = answering(() => problem(500))

      // Act
      const read = await readBookingLine(bookingId, lineId)

      // Assert
      expect(read).toEqual({ type: 'notFound' })
      expect(fetched).not.toHaveBeenCalled()
    },
  )

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

  describe.each(WRITES)('%s', (_name, call) => {
    it('should name the values that the API does not take, with the rules they broke', async () => {
      // Arrange
      answering(() =>
        problem(400, [
          { field: 'services.0.serviceId', rule: 'not_found' },
          { field: 'depositAmount', rule: 'too_small' },
        ]),
      )

      // Act
      const outcome = await call()

      // Assert
      expect(outcome).toEqual({
        type: 'invalid',
        values: [
          { field: 'services.0.serviceId', rule: 'not_found' },
          { field: 'depositAmount', rule: 'too_small' },
        ],
      })
    })

    it('should name no value when the API names none', async () => {
      // Arrange
      answering(() => problem(400))

      // Act
      const outcome = await call()

      // Assert
      expect(outcome).toEqual({ type: 'invalid', values: [] })
    })
  })

  it('createBooking should send the booking to the ledger, and hand over the booking the API made', async () => {
    // Arrange
    const fetched = answering(() =>
      json(201, {
        data: booking,
        meta: { correlationId: null, timestamp: '2026-11-20T00:00:00.000Z' },
        links: { self: `/api/v1/bookings/${booking.id}` },
      }),
    )

    // Act
    const outcome = await createBooking(CREATION)

    // Assert
    expect(outcome).toEqual({ type: 'created', booking })
    const [input, init] = fetched.mock.calls[0] ?? []
    expect(String(input)).toBe('http://localhost:3000/api/v1/bookings')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(CREATION)
  })

  it('createBooking should say that a member is taken, without telling it from the other conflict', async () => {
    // Arrange
    answering(() => problem(409))

    // Act
    const outcome = await createBooking(CREATION)

    // Assert
    expect(outcome).toEqual({ type: 'conflict' })
  })

  it('updateBooking should send the properties it is given and no other', async () => {
    // Arrange
    const fetched = answering(() => problem(404))

    // Act
    const outcome = await updateBooking(booking.id, {
      customerRequest: null,
      source: 'walk_in',
    })

    // Assert
    expect(outcome).toEqual({ type: 'notFound' })
    const [input, init] = fetched.mock.calls[0] ?? []
    expect(String(input)).toBe(
      `http://localhost:3000/api/v1/bookings/${booking.id}`,
    )
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({
      customerRequest: null,
      source: 'walk_in',
    })
  })

  it.each([
    [204, { type: 'deleted' }],
    [409, { type: 'referred' }],
    [404, { type: 'notFound' }],
    [403, { type: 'forbidden' }],
    [400, { type: 'failed' }],
  ])('deleteBooking should tell an answer of %i', async (status, removal) => {
    // Arrange
    const fetched = answering(() =>
      status === 204 ? new Response(null, { status }) : problem(status),
    )

    // Act
    const outcome = await deleteBooking(booking.id)

    // Assert
    expect(outcome).toEqual(removal)
    expect(fetched.mock.calls[0]?.[1]?.method).toBe('DELETE')
  })

  it.each([403, 404, 400])(
    'checkSlot should have failed on an answer of %i, which the form does not lead to',
    async (status) => {
      // Arrange
      answering(() => problem(status))

      // Act
      const outcome = await checkSlot(salon.id, SLOT)

      // Assert
      expect(outcome).toEqual({ type: 'failed' })
    },
  )

  describe('checkLine', () => {
    const taken = aBooking({
      id: 'e3b16f9c-8a0e-4cf1-8ad0-ce9a5b8c0de7',
      bookingNumber: 'BK-TAKEN-0001',
    })
    const GONE = 'f4c27a0d-9b1f-4d02-9be1-df0b6c9d1ef8'

    /** The API, that finds the member taken by a booking it has and one it removed meanwhile. */
    const theApi = (
      reading: (id: string) => Response = (id) =>
        id === taken.id
          ? json(200, {
              data: taken,
              meta: {
                correlationId: null,
                timestamp: '2026-11-20T00:00:00.000Z',
              },
              links: { self: `/api/v1/bookings/${id}` },
            })
          : problem(404),
      isAvailable = false,
    ) =>
      answering((request) => {
        const { pathname } = new URL(request.url)
        if (pathname.endsWith('/available-slots/check')) {
          return json(200, {
            data: { isAvailable, conflicts: [taken.id, GONE] },
            meta: {
              correlationId: null,
              timestamp: '2026-11-20T00:00:00.000Z',
            },
            links: { self: pathname },
          })
        }

        return reading(pathname.split('/').at(-1) ?? '')
      })

    it('should ask nothing about a line without a member', async () => {
      // Arrange
      const fetched = theApi()

      // Act
      const check = await checkLine(salon.id, {
        ...SLOT,
        staffId: null,
        notes: null,
      })

      // Assert
      expect(check).toEqual({ type: 'unassigned' })
      expect(fetched).not.toHaveBeenCalled()
    })

    it('should check the member of the line, and read each booking that overlaps it, leaving out one that is gone', async () => {
      // Arrange
      const fetched = theApi()

      // Act
      const check = await checkLine(salon.id, { ...SLOT, notes: '前髪' })

      // Assert
      expect(check).toEqual({ type: 'taken', overlapping: [taken] })
      const [input, init] = fetched.mock.calls[0] ?? []
      expect(String(input)).toBe(
        `http://localhost:3000/api/v1/salons/${salon.id}/available-slots/check`,
      )
      expect(JSON.parse(String(init?.body))).toEqual(SLOT)
    })

    it('should say that the member is free beside the bookings that overlap', async () => {
      // Arrange
      theApi(undefined, true)

      // Act
      const check = await checkLine(salon.id, { ...SLOT, notes: null })

      // Assert
      expect(check).toEqual({ type: 'free', overlapping: [taken] })
    })

    it.each(UNREAD)(
      'should say why the line could not be checked when a booking that overlaps it could not be read: %s',
      async (_case, answer, type) => {
        // Arrange
        answering(async (request) => {
          const { pathname } = new URL(request.url)

          return pathname.endsWith('/available-slots/check')
            ? json(200, {
                data: { isAvailable: false, conflicts: [taken.id] },
                meta: {
                  correlationId: null,
                  timestamp: '2026-11-20T00:00:00.000Z',
                },
                links: { self: pathname },
              })
            : answer()
        })

        // Act
        const check = await checkLine(salon.id, { ...SLOT, notes: null })

        // Assert
        expect(check).toEqual({ type })
      },
    )
  })
})

/** An answer of the API with the envelope of a resource. */
const resource = (status: number, data: unknown, self: string): Response =>
  json(status, {
    data,
    meta: { correlationId: null, timestamp: '2026-11-20T00:00:00.000Z' },
    links: { self },
  })

describe('the attempts that find out why the API refused', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const other = aBooking({
    id: 'c1f94d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
    bookingNumber: 'BK-9QWE-3RTY',
  })

  /**
   * The API, that refuses every change with 409, holds `now` as the
   * booking, and answers the check of a member with `checked`.
   */
  const refusing = (
    now: ReturnType<typeof aBooking>,
    checked: () => Response | Promise<Response>,
  ) =>
    answering((request) => {
      const { pathname } = new URL(request.url)
      if (pathname.endsWith('/available-slots/check')) {
        return checked()
      }
      if (request.method === 'GET') {
        const id = pathname.split('/').at(-1)

        return id === now.id
          ? resource(200, now, pathname)
          : resource(200, other, pathname)
      }

      return problem(409)
    })

  const conflicting = (ids: string[], isAvailable: boolean) => () =>
    resource(
      200,
      { isAvailable, conflicts: ids },
      `/api/v1/salons/${salon.id}/available-slots/check`,
    )

  it('should leave the booking itself out of what overlaps a line, and find the member free when only it does', async () => {
    // Arrange
    refusing(booking, conflicting([booking.id], false))

    // Act
    const check = await checkLine(salon.id, LINE, booking.id)

    // Assert
    expect(check).toEqual({ type: 'free', overlapping: [] })
  })

  it('attemptMove should say what was found out about every line when a member is taken where it would be', async () => {
    // Arrange
    refusing(booking, conflicting([booking.id, other.id], false))

    // Act
    const attempt = await attemptMove(salon.id, booking.id, MOVE)

    // Assert
    expect(attempt).toEqual({
      type: 'taken',
      checks: [{ type: 'taken', overlapping: [other] }],
    })
  })

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['every member is free', conflicting([booking.id], false), 'failed'],
    ['a member could not be checked', () => problem(429), 'tooManyRequests'],
    ['the check did not come through', () => problem(500), 'failed'],
  ])(
    'attemptMove should not say a member is taken when %s',
    async (_case, checked, type) => {
      // Arrange
      refusing(booking, checked)

      // Act
      const attempt = await attemptMove(salon.id, booking.id, MOVE)

      // Assert
      expect(attempt).toEqual({ type })
    },
  )

  it('attemptMove should hand over the booking as it is now when it is no longer moved', async () => {
    // Arrange
    const begun = aBooking({ status: 'in_progress' })
    const fetched = refusing(begun, conflicting([], true))

    // Act
    const attempt = await attemptMove(salon.id, booking.id, MOVE)

    // Assert
    expect(attempt).toEqual({ type: 'unmovable', booking: begun })
    expect(
      fetched.mock.calls.filter(([input]) =>
        String(input).endsWith('/available-slots/check'),
      ),
    ).toEqual([])
  })

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['its member is free', conflicting([booking.id], false), 'tooMuch'],
    ['its member could not be checked', () => problem(429), 'tooManyRequests'],
    ['the check did not come through', () => problem(500), 'failed'],
  ])(
    'attemptAddition should say why the line was refused when %s',
    async (_case, checked, type) => {
      // Arrange
      refusing(booking, checked)

      // Act
      const attempt = await attemptAddition(salon.id, booking.id, LINE)

      // Assert
      expect(attempt).toEqual({ type })
    },
  )

  it('attemptAddition should say what overlaps the line when its member is taken', async () => {
    // Arrange
    refusing(booking, conflicting([other.id], false))

    // Act
    const attempt = await attemptAddition(salon.id, booking.id, LINE)

    // Assert
    expect(attempt).toEqual({
      type: 'taken',
      check: { type: 'taken', overlapping: [other] },
    })
  })

  const twoLines = aBooking({
    services: [
      ...booking.services,
      ...booking.services.map((line) => ({
        ...line,
        id: 'f4c27a0d-9b1f-4d02-9a1e-df0b6c9dbef8',
        sortOrder: 1,
      })),
    ],
  })
  const finished = aBooking({ status: 'completed' })

  it.each<[string, ReturnType<typeof aBooking>, LineRemovalAttempt]>([
    ['a line that the booking can do without', twoLines, { type: 'unsummed' }],
    ['the last line', booking, { type: 'refused', booking }],
    [
      'a line of a finished booking',
      finished,
      { type: 'refused', booking: finished },
    ],
  ])(
    'attemptLineRemoval should tell why %s stays',
    async (_case, now, expected) => {
      // Arrange
      refusing(now, conflicting([], true))

      // Act
      const attempt = await attemptLineRemoval(booking.id, LINE_ID)

      // Assert
      expect(attempt).toEqual(expected)
    },
  )
})
