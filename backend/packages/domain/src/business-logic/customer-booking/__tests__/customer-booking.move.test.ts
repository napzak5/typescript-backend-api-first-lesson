import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { NOW, USER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  DATE,
  jst,
  STARTS_OF_DAY,
  serviceOfSlots,
  staffOfDay,
  weeklyHours,
} from '../../../__tests__/fixtures/available-slot-fixtures'
import {
  BOOKING_ID,
  CUT_ID,
} from '../../../__tests__/fixtures/booking-fixtures'
import { customerBookingReferences as references } from '../../../__tests__/fixtures/customer-booking-fixtures'
import { SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import { dbStaffSchedule } from '../../../__tests__/fixtures/staff-schedule-fixtures'
import { userIdSchema } from '../../../models/auth'
import type {
  CustomerBookingMoveWrite,
  DbBooking,
} from '../../../models/booking'
import { bookingRescheduleRequestSchema } from '../../../schemas/booking.schema'
import { planReschedule } from '../../booking'
import {
  type CustomerBookingToMove,
  type CustomerMove,
  type CustomerMovePlan,
  moveCustomerBooking,
  planCustomerMove,
} from '../_shared/move'
import type { CustomerBookingReferences } from '../_shared/plan'

type BookingStatus = DbBooking['status']

const LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d01'
const OTHER_LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d02'

/** The day after `DATE`, a Tuesday: the day of the booking that is moved. */
const BOOKED_DATE = '2026-11-17'

const MOVABLE: BookingStatus[] = ['draft', 'pending', 'confirmed']

/** A service line of the staff member of the fixtures, for the cut. */
const line = (
  from: string,
  until: string,
  overrides: Partial<CustomerBookingToMove['services'][number]> = {},
) => ({
  id: LINE_ID,
  serviceId: CUT_ID,
  staffId: STAFF_MEMBER_ID,
  startTime: jst(from, BOOKED_DATE),
  endTime: jst(until, BOOKED_DATE),
  ...overrides,
})

/**
 * The booking a customer moves: the cut with the staff member of the
 * fixtures, pending, at ten on the day after `DATE`.
 */
const booked = (
  overrides: Partial<CustomerBookingToMove> = {},
): CustomerBookingToMove => ({
  status: 'pending',
  staffId: STAFF_MEMBER_ID,
  startTime: jst('10:00', BOOKED_DATE),
  endTime: jst('11:00', BOOKED_DATE),
  services: [line('10:00', '11:00')],
  ...overrides,
})

/** What the customer sends: a time of a date in Tokyo, with a staff member. */
const to = (
  time: string,
  staffId: string = STAFF_MEMBER_ID,
  date: string = DATE,
) =>
  bookingRescheduleRequestSchema.parse({
    startTime: jst(time, date).toISOString(),
    staffId,
  })

const mover = (now: Date = NOW) => ({
  changedBy: userIdSchema.parse(USER_ID),
  now,
})

type Moved = Extract<CustomerMove, { type: 'moved' }>

/** A move that was made; fails the test when the booking stays. */
const movedOf = (move: CustomerMove): Moved => {
  if (move.type !== 'moved') {
    throw new Error(`Expected a move, got ${JSON.stringify(move)}`)
  }
  return move
}

/** The booking above moved to a time of `DATE`, with the staff member of the fixtures. */
const movedTo = (
  time = '14:00',
  overrides: Partial<CustomerBookingToMove> = {},
): Moved => movedOf(moveCustomerBooking(booked(overrides), to(time), NOW))

/** The plan of that move, with what it meets changed. */
const planTo = (
  time = '14:00',
  overrides: Partial<CustomerBookingReferences> = {},
  now: Date = NOW,
): CustomerMovePlan =>
  planCustomerMove(movedTo(time), mover(now), references(overrides))

/** What a plan writes; fails the test when nothing was planned. */
const writeOf = (plan: CustomerMovePlan): CustomerBookingMoveWrite => {
  if (plan.type !== 'planned') {
    throw new Error(`Expected a plan, got ${JSON.stringify(plan)}`)
  }
  return plan.write
}

type SalonOfSlot = NonNullable<CustomerBookingReferences['salon']>
type ServiceOfSlot = NonNullable<CustomerBookingReferences['service']>

const salonWith = (changes: Partial<SalonOfSlot>): SalonOfSlot => ({
  id: SALON_ID,
  isActive: true,
  timezone: 'Asia/Tokyo',
  businessHours: [weeklyHours()],
  taxRate: '10.00',
  ...changes,
})

const cutWith = (changes: Partial<ServiceOfSlot>): ServiceOfSlot => ({
  id: CUT_ID,
  price: 6600,
  discountPrice: null,
  taxIncluded: true,
  ...serviceOfSlots(),
  ...changes,
})

const time = (from: string, until: string, date: string = DATE) => ({
  startTime: jst(from, date),
  endTime: jst(until, date),
})

const notASlot = { type: 'notASlot' }

describe('moveCustomerBooking', () => {
  it('moves the booking and its line to the time of the request, and says what the slot is of', () => {
    expect(moveCustomerBooking(booked(), to('14:00'), NOW)).toStrictEqual({
      type: 'moved',
      booking: {
        staffId: STAFF_MEMBER_ID,
        startTime: jst('14:00'),
        endTime: jst('15:00'),
        services: [
          {
            id: LINE_ID,
            staffId: STAFF_MEMBER_ID,
            startTime: jst('14:00'),
            endTime: jst('15:00'),
          },
        ],
      },
      status: 'pending',
      serviceId: CUT_ID,
      duration: 60,
    })
  })

  it('gives the booking and its line to the staff member of the request', () => {
    const move = movedOf(
      moveCustomerBooking(booked(), to('14:00', OTHER_STAFF_MEMBER_ID), NOW),
    )

    expect(move.booking.staffId).toBe(OTHER_STAFF_MEMBER_ID)
    expect(move.booking.services.map(({ staffId }) => staffId)).toEqual([
      OTHER_STAFF_MEMBER_ID,
    ])
  })

  it('keeps the time the booking takes, whatever the service takes now', () => {
    const perm = booked({
      endTime: jst('11:30', BOOKED_DATE),
      services: [line('10:00', '11:30')],
    })

    const move = movedOf(moveCustomerBooking(perm, to('13:30'), NOW))

    expect(move.duration).toBe(90)
    expect(move.booking).toMatchObject({
      startTime: jst('13:30'),
      endTime: jst('15:00'),
      services: [{ startTime: jst('13:30'), endTime: jst('15:00') }],
    })
  })

  it.each(MOVABLE)('moves a booking that is %s, and says so', (status) => {
    expect(
      movedOf(moveCustomerBooking(booked({ status }), to('14:00'), NOW)).status,
    ).toBe(status)
  })

  it.each<BookingStatus>(['in_progress', 'completed', 'cancelled', 'no_show'])(
    'leaves a booking that is %s where it is',
    (status) => {
      expect(
        moveCustomerBooking(booked({ status }), to('14:00'), NOW),
      ).toStrictEqual({ type: 'statusDoesNotAllow', status, allowed: MOVABLE })
    },
  )

  describe('a booking that has begun', () => {
    const start = jst('10:00', BOOKED_DATE)
    const later = to('14:00', STAFF_MEMBER_ID, '2026-11-18')

    it('is moved until the moment before it begins', () => {
      expect(
        moveCustomerBooking(booked(), later, new Date(start.getTime() - 1))
          .type,
      ).toBe('moved')
    })

    it.each([
      ['at the moment it begins', start],
      ['a moment after it began', new Date(start.getTime() + 1)],
      ['after it has ended', jst('11:30', BOOKED_DATE)],
    ])('is not moved %s', (_case, now) => {
      expect(moveCustomerBooking(booked(), later, now)).toStrictEqual({
        type: 'alreadyBegun',
      })
    })
  })

  describe('a booking that is more than a slot says', () => {
    it.each<[string, CustomerBookingToMove['services']]>([
      [
        'has two service lines',
        [line('10:00', '10:30'), line('10:30', '11:00', { id: OTHER_LINE_ID })],
      ],
      ['has no service line', []],
      [
        'has a line of another staff member than the one in charge',
        [line('10:00', '11:00', { staffId: OTHER_STAFF_MEMBER_ID })],
      ],
      [
        'has a line of no staff member',
        [line('10:00', '11:00', { staffId: null })],
      ],
    ])('is not moved by its customer when it %s', (_case, services) => {
      expect(
        moveCustomerBooking(booked({ services }), to('14:00'), NOW),
      ).toStrictEqual({ type: 'notOneSlot' })
    })
  })

  describe('a request for the time and the staff member the booking has', () => {
    it('changes nothing', () => {
      expect(
        moveCustomerBooking(
          booked(),
          to('10:00', STAFF_MEMBER_ID, BOOKED_DATE),
          NOW,
        ),
      ).toStrictEqual({ type: 'unchanged' })
    })

    it.each([
      ['another staff member', to('10:00', OTHER_STAFF_MEMBER_ID, BOOKED_DATE)],
      ['another time', to('10:30', STAFF_MEMBER_ID, BOOKED_DATE)],
      ['the same time of another day', to('10:00', STAFF_MEMBER_ID, DATE)],
    ])('is a move when it names %s', (_case, request) => {
      expect(moveCustomerBooking(booked(), request, NOW).type).toBe('moved')
    })
  })

  describe('the order in which a booking is looked at', () => {
    const begun = jst('10:00', BOOKED_DATE)
    const twoLines = [
      line('10:00', '10:30'),
      line('10:30', '11:00', { id: OTHER_LINE_ID }),
    ]
    const same = to('10:00', STAFF_MEMBER_ID, BOOKED_DATE)

    it('looks at the status before the time', () => {
      expect(
        moveCustomerBooking(booked({ status: 'cancelled' }), same, begun).type,
      ).toBe('statusDoesNotAllow')
    })

    it('looks at the time before the lines', () => {
      expect(
        moveCustomerBooking(booked({ services: twoLines }), same, begun),
      ).toStrictEqual({ type: 'alreadyBegun' })
    })

    it('looks at the lines before it says that nothing changes', () => {
      expect(
        moveCustomerBooking(booked({ services: twoLines }), same, NOW),
      ).toStrictEqual({ type: 'notOneSlot' })
    })
  })
})

describe('planCustomerMove', () => {
  it('plans what a reschedule of the ledger writes, and the status the booking had', () => {
    const move = movedTo('14:00')

    const plan = planCustomerMove(move, mover(), references())

    const rescheduled = planReschedule(move.booking, {
      timezone: 'Asia/Tokyo',
      staff: [{ ...staffOfDay(), isDeleted: false }],
    })
    expect(rescheduled.type).toBe('planned')
    expect(plan).toStrictEqual({
      type: 'planned',
      write:
        rescheduled.type === 'planned'
          ? {
              booking: { ...rescheduled.write.booking, status: 'pending' },
              services: rescheduled.write.services,
              statusChange: null,
            }
          : null,
    })
  })

  it('plans the booking and its line at the slot, on the date of the salon', () => {
    expect(writeOf(planTo('14:00'))).toStrictEqual({
      booking: {
        staffId: STAFF_MEMBER_ID,
        bookingDate: DATE,
        startTime: '2026-11-16T05:00:00.000Z',
        endTime: '2026-11-16T06:00:00.000Z',
        status: 'pending',
      },
      services: [
        {
          id: LINE_ID,
          staffId: STAFF_MEMBER_ID,
          startTime: '2026-11-16T05:00:00.000Z',
          endTime: '2026-11-16T06:00:00.000Z',
        },
      ],
      statusChange: null,
    })
  })

  describe('the status once the booking is moved', () => {
    const planIn = (status: BookingStatus) =>
      writeOf(
        planCustomerMove(movedTo('14:00', { status }), mover(), references()),
      )

    it.each<BookingStatus>(['draft', 'pending'])(
      'leaves a booking that is %s what it is, and writes no history',
      (status) => {
        const write = planIn(status)

        expect(write.booking.status).toBe(status)
        expect(write.statusChange).toBeNull()
      },
    )

    it('makes a confirmed booking wait for the salon again, and writes who moved it into the history', () => {
      const write = planIn('confirmed')

      expect(write.booking.status).toBe('pending')
      expect(write.statusChange).toStrictEqual({
        fromStatus: 'confirmed',
        toStatus: 'pending',
        changedBy: USER_ID,
        reason: null,
        metadata: null,
      })
    })
  })

  describe('only an available slot', () => {
    it.each(STARTS_OF_DAY)('plans the move to the slot at %s', (start) => {
      expect(planTo(start).type).toBe('planned')
    })

    it.each([
      ['before the salon opens', '09:00'],
      ['between two slots', '10:15'],
      ['too late to end before the break', '11:30'],
      ['in the break', '12:00'],
      ['after the staff member has left', '18:00'],
    ])('refuses a time %s', (_case, start) => {
      expect(planTo(start)).toEqual(notASlot)
    })

    it('asks for the time the booking takes, not the time the service takes now', () => {
      const perm = {
        endTime: jst('11:30', BOOKED_DATE),
        services: [line('10:00', '11:30')],
      }
      const planOf = (start: string, overrides: typeof perm | undefined) =>
        planCustomerMove(movedTo(start, overrides), mover(), references())

      // The cut takes an hour now. The booking takes an hour and a half,
      // which has to end before the break.
      expect(planOf('10:30', perm).type).toBe('planned')
      expect(planOf('11:00', perm)).toEqual(notASlot)
      expect(planOf('11:00', undefined).type).toBe('planned')
      expect(writeOf(planOf('10:30', perm)).booking).toMatchObject({
        startTime: '2026-11-16T01:30:00.000Z',
        endTime: '2026-11-16T03:00:00.000Z',
      })
    })

    it('refuses a slot that has begun, by the moment the customer moves the booking at', () => {
      const start = jst('14:00')

      expect(planTo('14:00', {}, new Date(start.getTime() - 1)).type).toBe(
        'planned',
      )
      expect(planTo('14:00', {}, start)).toEqual(notASlot)
    })

    it.each<[string, Partial<CustomerBookingReferences>]>([
      [
        'the salon does not take bookings',
        { salon: salonWith({ isActive: false }) },
      ],
      [
        'the salon is closed on the day of the week',
        {
          salon: salonWith({
            businessHours: [weeklyHours({ isClosed: true })],
          }),
        },
      ],
      [
        'the calendar of the salon closes the date',
        { calendarDays: [{ date: DATE, openTime: null, closeTime: null }] },
      ],
      ['the service is not active', { service: cutWith({ isActive: false }) }],
      [
        'the service is not booked online any more',
        { service: cutWith({ allowOnlineBooking: false }) },
      ],
      [
        'the service is offered at weekends only',
        { service: cutWith({ availability: 'weekends_only' }) },
      ],
      [
        'the service has been booked as often as it is on a day',
        {
          service: cutWith({ maxBookingsPerDay: 1 }),
          serviceLineStarts: [jst('10:00')],
        },
      ],
      [
        'the staff member does not take bookings',
        { staff: staffOfDay({ canReceiveBookings: false }) },
      ],
      [
        'the staff member is below the level the service asks for',
        {
          staff: staffOfDay({ level: 'junior' }),
          service: cutWith({ requiredStaffLevel: 'senior' }),
        },
      ],
      [
        'the staff member has no schedule',
        { staff: staffOfDay({ schedules: [] }) },
      ],
      [
        'the staff member is occupied at the time',
        {
          staff: staffOfDay({
            taken: [{ bookingId: BOOKING_ID, ...time('14:30', '15:30') }],
          }),
        },
      ],
    ])('refuses the slot at two when %s', (_case, overrides) => {
      expect(planTo('14:00', overrides)).toEqual(notASlot)
    })

    it('takes the date in the time zone of the salon, which is not the one in UTC early in the morning', () => {
      // 08:30 in Tokyo on the 16th is 23:30 on the 15th in UTC.
      const overrides = {
        calendarDays: [
          { date: DATE, openTime: '08:00:00', closeTime: '12:00:00' },
        ],
        staff: staffOfDay({
          schedules: [dbStaffSchedule({ startTime: '08:00:00' })],
        }),
      }

      expect(writeOf(planTo('08:30', overrides)).booking).toMatchObject({
        bookingDate: DATE,
        startTime: '2026-11-15T23:30:00.000Z',
      })
    })
  })

  describe('the customer who moves the booking', () => {
    it.each<[string, CustomerBookingReferences['customer'], string]>([
      ['is active', { isActive: true, customerStatus: 'active' }, 'planned'],
      ['is a VIP', { isActive: true, customerStatus: 'vip' }, 'planned'],
      [
        'is inactive',
        { isActive: true, customerStatus: 'inactive' },
        'customerNotAccepted',
      ],
      [
        'is blacklisted',
        { isActive: true, customerStatus: 'blacklisted' },
        'customerNotAccepted',
      ],
      [
        'has a record that is not active',
        { isActive: false, customerStatus: 'active' },
        'customerNotAccepted',
      ],
    ])('a customer who %s: %s', (_case, customer, outcome) => {
      expect(planTo('14:00', { customer }).type).toBe(outcome)
    })

    it.each<[string, string, string, string]>([
      ['ends when the slot begins', '13:00', '14:00', 'planned'],
      ['begins when the slot ends', '15:00', '16:00', 'planned'],
      ['ends within the slot', '13:30', '14:30', 'customerOccupied'],
      ['begins within the slot', '14:30', '15:30', 'customerOccupied'],
      ['is at the time of the slot', '14:00', '15:00', 'customerOccupied'],
    ])(
      'another booking of the customer that %s: %s',
      (_case, from, until, outcome) => {
        expect(
          planTo('14:00', { customerTimes: [time(from, until)] }).type,
        ).toBe(outcome)
      },
    )

    it('measures the other bookings against the time the booking takes', () => {
      const perm = movedTo('13:30', {
        endTime: jst('11:30', BOOKED_DATE),
        services: [line('10:00', '11:30')],
      })
      const others = { customerTimes: [time('14:30', '15:30')] }

      expect(planCustomerMove(perm, mover(), references(others))).toEqual({
        type: 'customerOccupied',
      })
      expect(planTo('13:30', others).type).toBe('planned')
    })
  })

  describe('what the slot refers to', () => {
    it('answers a customer who is not there as an account without a profile', () => {
      expect(planTo('14:00', { customer: null })).toEqual({
        type: 'profileNotFound',
      })
    })

    it.each<[string, Partial<CustomerBookingReferences>]>([
      ['the salon', { salon: null }],
      ['the service', { service: null }],
    ])('finds no slot when %s is not there', (_case, overrides) => {
      expect(planTo('14:00', overrides)).toEqual(notASlot)
    })

    it('reports a staff member who is not one of the salon', () => {
      expect(planTo('14:00', { staff: null })).toStrictEqual({
        type: 'invalid',
        issues: [
          {
            field: 'staffId',
            rule: 'not_found',
            message: ruleMessages.aStaffMemberOfSalon,
          },
        ],
      })
    })
  })

  describe('the order in which a move is looked at', () => {
    const unknownZone = salonWith({ timezone: 'Mars/Olympus_Mons' })
    const unreadable = salonWith({ businessHours: [{ dayOfWeek: 'someday' }] })
    const refused: CustomerBookingReferences['customer'] = {
      isActive: true,
      customerStatus: 'blacklisted',
    }
    const occupied = { customerTimes: [time('14:00', '15:00')] }

    it('answers a customer who is not there before anything else', () => {
      expect(
        planTo('14:00', { customer: null, salon: null, staff: null }).type,
      ).toBe('profileNotFound')
    })

    it('looks for the salon and the service before the staff member', () => {
      expect(planTo('14:00', { service: null, staff: null })).toEqual(notASlot)
    })

    it('reports the staff member before it looks at the time zone', () => {
      expect(planTo('14:00', { salon: unknownZone, staff: null }).type).toBe(
        'invalid',
      )
    })

    it('answers a time zone the runtime does not know before it looks at the customer', () => {
      expect(
        planTo('14:00', { salon: unknownZone, customer: refused }),
      ).toEqual({ type: 'timeZoneUnknown' })
    })

    it('looks at the customer before the hours of the salon', () => {
      expect(planTo('14:00', { salon: unreadable, customer: refused })).toEqual(
        { type: 'customerNotAccepted' },
      )
    })

    it('answers stored hours that do not have the shape of the model with the error of the mapper, before it looks at the slot', () => {
      const plan = planTo('12:00', { salon: unreadable })

      expect(plan).toMatchObject({
        type: 'hoursUnreadable',
        error: {
          type: 'database',
          message: `Stored salon ${SALON_ID} does not match the API model`,
        },
      })
    })

    it('looks at the slot before the other bookings of the customer', () => {
      expect(planTo('12:00', occupied)).toEqual(notASlot)
      expect(planTo('14:00', occupied)).toEqual({ type: 'customerOccupied' })
    })
  })
})
