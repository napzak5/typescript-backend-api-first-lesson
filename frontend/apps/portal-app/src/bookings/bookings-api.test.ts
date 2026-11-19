import type {
  ModelsBookingCancelRequest,
  ModelsBookingRescheduleRequest,
  ModelsCustomerBookingCreateRequest,
  ModelsCustomerProfileCreateRequest,
} from '@beauty-salon-frontend/api-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  book,
  cancelOwnBooking,
  createOwnProfile,
  moveOwnBooking,
  readOwnBooking,
  readOwnBookings,
  readOwnProfile,
  readService,
  readSlots,
  whyUnread,
} from './bookings-api'

/*
 * The answers the real API gives are met in `bookings.integration.test.tsx`.
 * Here are the ones a test cannot bring about there (too many requests, an
 * error of the server, no answer, a status the contract does not name),
 * that every operation reads its answers alike, what each operation asks
 * for, and how the times of a day are read to their end.
 */

const SALON_ID = '0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90'
const SERVICE_ID = '1a3c5e7f-9b20-4d46-8e68-0a2c4e6f8b79'
const STAFF_ID = '6f81a3c4-e075-429b-93bd-5f7193acc0ce'
const BOOKING_ID = 'e7092b3c-68fd-4a13-9b35-d7f902245846'

type RefusedValue = { field: string; rule: string }

const answer = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':
        status < 300
          ? 'application/json; charset=utf-8'
          : 'application/problem+json; charset=utf-8',
    },
  })

const problem = (
  status: number,
  errors: RefusedValue[] | null = null,
): Response =>
  answer(status, {
    type: 'urn:beauty-salon:problem',
    title: 'Problem',
    status,
    detail: null,
    instance: null,
    code: '2001',
    errors:
      errors?.map((error) => ({
        ...error,
        message: 'Invalid',
        value: null,
        constraint: null,
      })) ?? null,
    correlationId: null,
    timestamp: '2026-11-19T00:00:00.000Z',
  })

/** One record, as the API wraps it. */
const record = (status: number, data: unknown): Response =>
  answer(status, { data, meta: null, links: null })

/** A page of a list: its items, and the cursor of the page after it. */
const page = (items: unknown[], nextCursor: string | null = null): Response =>
  answer(200, {
    data: items,
    meta: {
      total: items.length,
      limit: 100,
      hasMore: nextCursor !== null,
      cursor: null,
      nextCursor,
      prevCursor: null,
    },
    links: null,
  })

/** Lets the API answer every request with what `respond` makes of its address. */
const answering = (respond: (url: URL) => Response | Promise<Response>) => {
  const fetched = vi.fn<typeof fetch>(async (input) =>
    respond(new URL(String(input))),
  )
  vi.stubGlobal('fetch', fetched)

  return fetched
}

/** What was asked for: the method, and the path below `/api/v1` with its query. */
const asked = (fetched: ReturnType<typeof answering>): string[] =>
  fetched.mock.calls.map(([input, init]) => {
    const [, operation] = String(input).split('/api/v1')

    return `${init?.method ?? 'GET'} ${decodeURIComponent(operation ?? '')}`
  })

/** What was sent with the first request. */
const sent = (fetched: ReturnType<typeof answering>): unknown =>
  fetched.mock.calls.at(0)?.at(1)

const PROFILE: ModelsCustomerProfileCreateRequest = {
  lastName: '山田',
  firstName: '花子',
  phoneNumber: '090-5550-0199',
  lastNameKana: null,
  firstNameKana: null,
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  preferences: null,
  allowEmail: true,
  allowSms: false,
  allowMarketing: false,
}

const BOOKING: ModelsCustomerBookingCreateRequest = {
  salonId: SALON_ID,
  serviceId: SERVICE_ID,
  staffId: STAFF_ID,
  startTime: '2026-11-24T01:00:00.000Z',
  customerRequest: null,
}

const SLOTS = {
  salonId: SALON_ID,
  serviceId: SERVICE_ID,
  date: '2026-11-24',
  staffId: undefined,
  duration: undefined,
}

const CANCELLATION: ModelsBookingCancelRequest = {
  cancellationReason: '都合が悪くなりました',
}

const MOVE: ModelsBookingRescheduleRequest = {
  startTime: '2026-11-25T02:00:00.000Z',
  staffId: STAFF_ID,
}

const UPCOMING = { bookingDateFrom: '2026-11-19' }

/** Every operation of the booking screens, called as a screen calls it. */
const OPERATIONS: [string, () => Promise<{ type: string }>][] = [
  ['readOwnProfile', () => readOwnProfile()],
  ['createOwnProfile', () => createOwnProfile(PROFILE)],
  ['readService', () => readService(SALON_ID, SERVICE_ID)],
  ['readSlots', () => readSlots(SLOTS)],
  ['book', () => book(BOOKING)],
  ['readOwnBooking', () => readOwnBooking(BOOKING_ID)],
  ['readOwnBookings', () => readOwnBookings(UPCOMING, undefined)],
  ['cancelOwnBooking', () => cancelOwnBooking(BOOKING_ID, CANCELLATION)],
  ['moveOwnBooking', () => moveOwnBooking(BOOKING_ID, MOVE)],
]

const only = (...names: string[]) =>
  OPERATIONS.filter(([name]) => names.includes(name))

describe('the operations of the booking screens', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each(OPERATIONS)('%s', (_name, call) => {
    it('should say that there were too many requests when the API limits them', async () => {
      answering(() => problem(429))

      expect(await call()).toEqual({ type: 'tooManyRequests' })
    })

    it('should have failed when the API answers with an error of the server', async () => {
      answering(() => problem(500))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it('should have failed, and not reject, when there is no answer', async () => {
      answering(() => Promise.reject(new TypeError('Failed to fetch')))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it.each([
      ['a gateway that does not reach the API', 502],
      ['an API that is not there', 503],
      ['a gateway that waited too long', 504],
      ['a status of no meaning here', 418],
    ])(
      'should have failed, and not reject, when the answer is %s: a status the contract does not name',
      async (_case, status) => {
        answering(
          () =>
            new Response('<html><body>Bad Gateway</body></html>', {
              status,
              headers: { 'Content-Type': 'text/html' },
            }),
        )

        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  describe.each(
    only(
      'readOwnProfile',
      'createOwnProfile',
      'readSlots',
      'book',
      'readOwnBooking',
      'readOwnBookings',
      'cancelOwnBooking',
      'moveOwnBooking',
    ),
  )('%s', (_name, call) => {
    it.each([
      ['knows no session', 401],
      ['does not allow it', 403],
    ])(
      'should have failed when the API %s: the guard of the session says what stands in the way',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  describe.each(
    only('createOwnProfile', 'book', 'cancelOwnBooking', 'moveOwnBooking'),
  )('%s', (_name, call) => {
    it.each([
      ['a body that is too large', 413],
      ['a body of a type it does not read', 415],
    ])(
      'should have failed when the API answers with %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )

    it('should say that the API refused it when it answers with a conflict', async () => {
      answering(() => problem(409))

      expect(await call()).toEqual({ type: 'refused' })
    })
  })

  describe.each(only('cancelOwnBooking', 'moveOwnBooking'))(
    '%s',
    (_name, call) => {
      it('should say that there is no such booking when the API finds none', async () => {
        answering(() => problem(404))

        expect(await call()).toEqual({ type: 'notFound' })
      })
    },
  )

  describe('readOwnProfile', () => {
    it('should hand over the profile of the answer', async () => {
      const fetched = answering(() => record(200, { id: 'me' }))

      expect(await readOwnProfile()).toEqual({
        type: 'found',
        profile: { id: 'me' },
      })
      expect(asked(fetched)).toEqual(['GET /customers/me'])
    })

    it('should say that the account has no profile when the API finds none', async () => {
      answering(() => problem(404))

      expect(await readOwnProfile()).toEqual({ type: 'none' })
    })
  })

  describe('createOwnProfile', () => {
    it('should send the profile, and hand over the one the API made of it', async () => {
      const fetched = answering(() => record(201, { id: 'me' }))

      expect(await createOwnProfile(PROFILE)).toEqual({
        type: 'created',
        profile: { id: 'me' },
      })
      expect(asked(fetched)).toEqual(['POST /customers/me'])
      expect(sent(fetched)).toMatchObject({ body: JSON.stringify(PROFILE) })
    })

    it('should name the values that the API does not take, with the rules they broke', async () => {
      answering(() =>
        problem(400, [
          { field: 'phoneNumber', rule: 'invalid_format' },
          { field: 'lastName', rule: 'too_big' },
        ]),
      )

      expect(await createOwnProfile(PROFILE)).toEqual({
        type: 'invalid',
        values: [
          { field: 'phoneNumber', rule: 'invalid_format' },
          { field: 'lastName', rule: 'too_big' },
        ],
      })
    })

    it('should name no value when the API names none', async () => {
      answering(() => problem(400))

      expect(await createOwnProfile(PROFILE)).toEqual({
        type: 'invalid',
        values: [],
      })
    })
  })

  describe('readService', () => {
    it('should hand over the service of the answer', async () => {
      const fetched = answering(() => record(200, { id: SERVICE_ID }))

      expect(await readService(SALON_ID, SERVICE_ID)).toEqual({
        type: 'found',
        service: { id: SERVICE_ID },
      })
      expect(asked(fetched)).toEqual([
        `GET /salons/${SALON_ID}/services/${SERVICE_ID}`,
      ])
    })

    it('should say that there is no such service when the API finds none', async () => {
      answering(() => problem(404))

      expect(await readService(SALON_ID, SERVICE_ID)).toEqual({
        type: 'notFound',
      })
    })

    it('should have failed when the API does not take the request', async () => {
      answering(() => problem(400))

      expect(await readService(SALON_ID, SERVICE_ID)).toEqual({
        type: 'failed',
      })
    })

    it.each([
      ['a salon', 'beauty-studio-tokyo', SERVICE_ID],
      ['a service', SALON_ID, 'ladies-cut'],
      ['a service', SALON_ID, ''],
      ['a salon', `${SALON_ID}/services`, SERVICE_ID],
    ])(
      'should not ask the API for %s whose ID is none',
      async (_case, salonId, serviceId) => {
        const fetched = answering(() => problem(500))

        expect(await readService(salonId, serviceId)).toEqual({
          type: 'notFound',
        })
        expect(fetched).not.toHaveBeenCalled()
      },
    )
  })

  describe('readSlots', () => {
    it('should ask for the times of the service on the day, with anybody, in the largest pages', async () => {
      const fetched = answering(() => page([{ staffId: 'a' }]))

      expect(await readSlots(SLOTS)).toEqual({
        type: 'found',
        slots: [{ staffId: 'a' }],
      })
      expect(asked(fetched)).toEqual([
        `GET /salons/${SALON_ID}/available-slots?serviceId=${SERVICE_ID}&date=2026-11-24&limit=100`,
      ])
    })

    it('should ask for times of the length it is given: a booking that is moved keeps its length', async () => {
      const fetched = answering(() => page([]))

      await readSlots({ ...SLOTS, staffId: STAFF_ID, duration: 90 })

      expect(asked(fetched)).toEqual([
        `GET /salons/${SALON_ID}/available-slots?staffId=${STAFF_ID}&duration=90&serviceId=${SERVICE_ID}&date=2026-11-24&limit=100`,
      ])
    })

    it('should ask for the times of one member of the staff when they are asked for', async () => {
      const fetched = answering(() => page([]))

      await readSlots({ ...SLOTS, staffId: STAFF_ID })

      expect(asked(fetched)).toEqual([
        `GET /salons/${SALON_ID}/available-slots?staffId=${STAFF_ID}&serviceId=${SERVICE_ID}&date=2026-11-24&limit=100`,
      ])
    })

    it('should read the times to their end, a page after the other', async () => {
      const fetched = answering(({ searchParams }) => {
        const cursor = searchParams.get('cursor')

        return cursor === null
          ? page([{ staffId: 'a' }, { staffId: 'b' }], 'second')
          : cursor === 'second'
            ? page([{ staffId: 'c' }], 'third')
            : page([{ staffId: 'd' }])
      })

      expect(await readSlots(SLOTS)).toEqual({
        type: 'found',
        slots: ['a', 'b', 'c', 'd'].map((staffId) => ({ staffId })),
      })
      expect(asked(fetched)).toEqual([
        `GET /salons/${SALON_ID}/available-slots?serviceId=${SERVICE_ID}&date=2026-11-24&limit=100`,
        `GET /salons/${SALON_ID}/available-slots?cursor=second&serviceId=${SERVICE_ID}&date=2026-11-24&limit=100`,
        `GET /salons/${SALON_ID}/available-slots?cursor=third&serviceId=${SERVICE_ID}&date=2026-11-24&limit=100`,
      ])
    })

    it('should have no times, and not half of them, when a later page is not read', async () => {
      answering(({ searchParams }) =>
        searchParams.has('cursor')
          ? problem(500)
          : page([{ staffId: 'a' }], 'second'),
      )

      expect(await readSlots(SLOTS)).toEqual({ type: 'failed' })
    })

    it('should say that there are no times for a day without one', async () => {
      answering(() => page([]))

      expect(await readSlots(SLOTS)).toEqual({ type: 'found', slots: [] })
    })

    it.each([
      ['does not take what was asked for', 400],
      ['does not find the salon', 404],
      ['cannot read the time zone of the salon', 409],
    ])(
      'should have failed when the API %s: the screen asked for what it had read',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await readSlots(SLOTS)).toEqual({ type: 'failed' })
      },
    )
  })

  describe('book', () => {
    it('should send the booking, and hand over the one the API made of it', async () => {
      const fetched = answering(() => record(201, { id: BOOKING_ID }))

      expect(await book(BOOKING)).toEqual({
        type: 'booked',
        booking: { id: BOOKING_ID },
      })
      expect(asked(fetched)).toEqual(['POST /customers/me/bookings'])
      expect(sent(fetched)).toMatchObject({ body: JSON.stringify(BOOKING) })
    })

    it('should say that the account has no profile when the API finds no customer', async () => {
      answering(() => problem(404))

      expect(await book(BOOKING)).toEqual({ type: 'noProfile' })
    })

    it('should say that what was chosen is not taken, without the values, when the API does not take the request', async () => {
      answering(() => problem(400, [{ field: 'staffId', rule: 'not_found' }]))

      expect(await book(BOOKING)).toEqual({ type: 'invalid' })
    })
  })

  describe('readOwnBooking', () => {
    it('should hand over the booking of the answer', async () => {
      const fetched = answering(() => record(200, { id: BOOKING_ID }))

      expect(await readOwnBooking(BOOKING_ID)).toEqual({
        type: 'found',
        booking: { id: BOOKING_ID },
      })
      expect(asked(fetched)).toEqual([
        `GET /customers/me/bookings/${BOOKING_ID}`,
      ])
    })

    it('should say that there is no such booking when the API finds none: that of somebody else is not told apart', async () => {
      answering(() => problem(404))

      expect(await readOwnBooking(BOOKING_ID)).toEqual({ type: 'notFound' })
    })

    it('should have failed when the API does not take the request', async () => {
      answering(() => problem(400))

      expect(await readOwnBooking(BOOKING_ID)).toEqual({ type: 'failed' })
    })

    it.each(['my-booking', '', 'e7092b3c', `${BOOKING_ID}/cancel`])(
      'should not ask the API for %j, which is no ID',
      async (id) => {
        const fetched = answering(() => problem(500))

        expect(await readOwnBooking(id)).toEqual({ type: 'notFound' })
        expect(fetched).not.toHaveBeenCalled()
      },
    )
  })
})

describe('the operations of the screens of the bookings of a customer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('readOwnBookings', () => {
    it('should ask for the visits from a day on, twenty at a time, and hand over the page of the answer', async () => {
      const fetched = answering(() => page([{ id: BOOKING_ID }], 'second'))

      expect(await readOwnBookings(UPCOMING, undefined)).toEqual({
        type: 'found',
        items: [{ id: BOOKING_ID }],
        total: 1,
        nextCursor: 'second',
      })
      expect(asked(fetched)).toEqual([
        'GET /customers/me/bookings?bookingDateFrom=2026-11-19&limit=20',
      ])
    })

    it('should ask for the visits until a day, from where the page before ended', async () => {
      const fetched = answering(() => page([]))

      await readOwnBookings({ bookingDateTo: '2026-11-18' }, 'second')

      expect(asked(fetched)).toEqual([
        'GET /customers/me/bookings?cursor=second&bookingDateTo=2026-11-18&limit=20',
      ])
    })

    it('should have no booking, and not fail, for an account without a profile: nobody has booked for it', async () => {
      answering(() => problem(404))

      expect(await readOwnBookings(UPCOMING, undefined)).toEqual({
        type: 'found',
        items: [],
        total: 0,
        nextCursor: null,
      })
    })

    it('should have failed when the API does not take what was asked for', async () => {
      answering(() => problem(400))

      expect(await readOwnBookings(UPCOMING, undefined)).toEqual({
        type: 'failed',
      })
    })
  })

  describe('cancelOwnBooking', () => {
    it('should send the reason, and hand over the booking as the API cancelled it', async () => {
      const fetched = answering(() =>
        record(200, { id: BOOKING_ID, status: 'cancelled' }),
      )

      expect(await cancelOwnBooking(BOOKING_ID, CANCELLATION)).toEqual({
        type: 'cancelled',
        booking: { id: BOOKING_ID, status: 'cancelled' },
      })
      expect(asked(fetched)).toEqual([
        `POST /customers/me/bookings/${BOOKING_ID}/cancel`,
      ])
      expect(sent(fetched)).toMatchObject({
        body: JSON.stringify(CANCELLATION),
      })
    })

    it('should send that there is no reason when none was given', async () => {
      const fetched = answering(() => record(200, { id: BOOKING_ID }))

      await cancelOwnBooking(BOOKING_ID, { cancellationReason: null })

      expect(sent(fetched)).toMatchObject({
        body: '{"cancellationReason":null}',
      })
    })

    it('should have failed when the API does not take the request: the dialog sends what the API takes', async () => {
      answering(() => problem(400))

      expect(await cancelOwnBooking(BOOKING_ID, CANCELLATION)).toEqual({
        type: 'failed',
      })
    })
  })

  describe('moveOwnBooking', () => {
    it('should send the time and the member of the staff, and hand over the booking as the API moved it', async () => {
      const fetched = answering(() =>
        record(200, { id: BOOKING_ID, status: 'pending' }),
      )

      expect(await moveOwnBooking(BOOKING_ID, MOVE)).toEqual({
        type: 'moved',
        booking: { id: BOOKING_ID, status: 'pending' },
      })
      expect(asked(fetched)).toEqual([
        `POST /customers/me/bookings/${BOOKING_ID}/reschedule`,
      ])
      expect(sent(fetched)).toMatchObject({ body: JSON.stringify(MOVE) })
    })

    it('should say that what was chosen is not taken when the API does not take the request', async () => {
      answering(() => problem(400, [{ field: 'staffId', rule: 'not_found' }]))

      expect(await moveOwnBooking(BOOKING_ID, MOVE)).toEqual({
        type: 'invalid',
      })
    })
  })
})

describe('whyUnread', () => {
  it('should be too many requests when one of the things that were read says so', () => {
    expect(
      whyUnread([
        { type: 'found' },
        { type: 'failed' },
        { type: 'tooManyRequests' },
      ]),
    ).toEqual({ type: 'tooManyRequests' })
  })

  it.each([
    ['one of them failed', [{ type: 'found' }, { type: 'failed' }]],
    ['one of them names nothing', [{ type: 'notFound' }, { type: 'found' }]],
    ['one of them is still being read', [undefined, { type: 'failed' }]],
    ['there is nothing to go by', []],
  ])('should be a failure when %s', (_case, reads) => {
    expect(whyUnread(reads)).toEqual({ type: 'failed' })
  })
})
