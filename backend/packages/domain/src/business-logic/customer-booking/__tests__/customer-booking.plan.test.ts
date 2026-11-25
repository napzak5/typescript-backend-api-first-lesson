import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  bookingMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_ID,
  NOW,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
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
  BOOKING_NUMBER,
  CUT_ID,
} from '../../../__tests__/fixtures/booking-fixtures'
import {
  customerBookingReferences as references,
  customerBookingRequest as request,
} from '../../../__tests__/fixtures/customer-booking-fixtures'
import { SALON_ID } from '../../../__tests__/fixtures/fixtures'
import { STAFF_MEMBER_ID } from '../../../__tests__/fixtures/staff-fixtures'
import { dbStaffSchedule } from '../../../__tests__/fixtures/staff-schedule-fixtures'
import { userIdSchema } from '../../../models/auth'
import type { BookingWrite } from '../../../models/booking'
import { customerIdSchema } from '../../../models/customer'
import { dayIn } from '../../available-slot/_shared/salon-time'
import { planBooking } from '../../booking'
import {
  type CustomerBookingPlan,
  type CustomerBookingReferences,
  candidateDatesOf,
  candidateTimeOf,
  ONLINE,
  planCustomerBooking,
  refusalOfSlot,
} from '../_shared/plan'

const origin = {
  bookingNumber: BOOKING_NUMBER,
  createdBy: userIdSchema.parse(USER_ID),
  client: { ipAddress: '203.0.113.7', userAgent: 'SalonApp/1.0' },
}

/** The customer of the fixtures books, two days before `DATE`. */
const booker = (now: Date = NOW) => ({
  customerId: customerIdSchema.parse(CUSTOMER_ID),
  now,
})

/** The plan for the cut at a time of `DATE`, with what it meets changed. */
const planAt = (
  time = '10:00',
  overrides: Partial<CustomerBookingReferences> = {},
  now: Date = NOW,
): CustomerBookingPlan =>
  planCustomerBooking(request(time), booker(now), references(overrides), origin)

/** What a plan writes; fails the test when nothing was planned. */
const writeOf = (plan: CustomerBookingPlan): BookingWrite => {
  if (plan.type !== 'planned') {
    throw new Error(`Expected a plan, got ${JSON.stringify(plan)}`)
  }
  return plan.write
}

type SalonOfRequest = NonNullable<CustomerBookingReferences['salon']>
type ServiceOfRequest = NonNullable<CustomerBookingReferences['service']>

/** The salon of the fixtures with something changed. */
const salonWith = (changes: Partial<SalonOfRequest>): SalonOfRequest => ({
  id: SALON_ID,
  isActive: true,
  timezone: 'Asia/Tokyo',
  businessHours: [weeklyHours()],
  taxRate: '10.00',
  ...changes,
})

/** The cut of the fixtures with something changed. */
const cutWith = (changes: Partial<ServiceOfRequest>): ServiceOfRequest => ({
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

describe('planCustomerBooking', () => {
  it('books what the customer made online', () => {
    expect(ONLINE).toBe('online')
  })

  it('plans the rows the salon would enter for the same visit, as made online and without what the salon notes', () => {
    const asked = request('10:00', { customerRequest: '前回と同じ長さで' })

    const plan = planCustomerBooking(asked, booker(), references(), origin)

    const entered = planBooking(
      {
        salonId: asked.salonId,
        customerId: customerIdSchema.parse(CUSTOMER_ID),
        staffId: asked.staffId,
        depositAmount: null,
        customerRequest: '前回と同じ長さで',
        internalNotes: null,
        source: 'online',
        services: [
          {
            serviceId: asked.serviceId,
            staffId: asked.staffId,
            startTime: asked.startTime,
            notes: null,
          },
        ],
      },
      {
        salon: { timezone: 'Asia/Tokyo', taxRate: '10.00' },
        customerExists: true,
        staff: [staffOfDay()],
        services: [cutWith({})],
      },
      origin,
    )
    expect(entered.type).toBe('planned')
    expect(plan).toStrictEqual({
      type: 'planned',
      write: entered.type === 'planned' ? entered.write : null,
    })
  })

  it('plans one line of the service with the staff member, a pending booking for the customer, and the customer as the one who made it', () => {
    const write = writeOf(planAt('13:30'))

    expect(write.booking).toMatchObject({
      bookingNumber: BOOKING_NUMBER,
      salonId: SALON_ID,
      customerId: CUSTOMER_ID,
      staffId: STAFF_MEMBER_ID,
      bookingDate: DATE,
      startTime: '2026-11-16T04:30:00.000Z',
      endTime: '2026-11-16T05:30:00.000Z',
      duration: 60,
      status: 'pending',
      subtotal: 6600,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 6600,
      depositAmount: null,
      customerRequest: null,
      internalNotes: null,
      source: 'online',
      ipAddress: '203.0.113.7',
      userAgent: 'SalonApp/1.0',
    })
    expect(write.services).toStrictEqual([
      {
        serviceId: CUT_ID,
        staffId: STAFF_MEMBER_ID,
        startTime: '2026-11-16T04:30:00.000Z',
        endTime: '2026-11-16T05:30:00.000Z',
        duration: 60,
        price: 6600,
        discountAmount: 0,
        finalPrice: 6600,
        taxIncluded: true,
        isCompleted: false,
        completedAt: null,
        notes: null,
        sortOrder: 0,
      },
    ])
    expect(write.statusChange).toStrictEqual({
      fromStatus: null,
      toStatus: 'pending',
      changedBy: USER_ID,
      reason: null,
      metadata: null,
    })
  })

  describe('only an available slot', () => {
    it.each(STARTS_OF_DAY)('plans the slot at %s', (start) => {
      expect(planAt(start).type).toBe('planned')
    })

    it.each([
      ['before the salon opens', '09:00'],
      ['between two slots', '10:15'],
      ['a minute after a slot', '10:01'],
      ['too late to end before the break', '11:30'],
      ['in the break', '12:00'],
      ['too late to end before the staff member leaves', '17:30'],
      ['after the staff member has left', '18:00'],
      ['at midnight', '00:00'],
    ])('refuses a time %s', (_case, start) => {
      expect(planAt(start)).toEqual(notASlot)
    })

    it('asks for the time the service takes: a longer one has to end before the break as well', () => {
      const perm = cutWith({ duration: 90 })

      expect(planAt('10:30', { service: perm }).type).toBe('planned')
      expect(planAt('11:00', { service: perm })).toEqual(notASlot)
      expect(writeOf(planAt('10:30', { service: perm })).booking).toMatchObject(
        {
          endTime: '2026-11-16T03:00:00.000Z',
          duration: 90,
        },
      )
    })

    it('refuses a slot that has begun, by the moment the customer books at', () => {
      const start = jst('10:00')

      expect(planAt('10:00', {}, new Date(start.getTime() - 1)).type).toBe(
        'planned',
      )
      expect(planAt('10:00', {}, start)).toEqual(notASlot)
      expect(planAt('10:00', {}, new Date(start.getTime() + 1))).toEqual(
        notASlot,
      )
    })

    it.each<[string, Partial<CustomerBookingReferences>]>([
      [
        'the salon does not take bookings',
        { salon: salonWith({ isActive: false }) },
      ],
      [
        'the salon has no hours for the day',
        { salon: salonWith({ businessHours: null }) },
      ],
      [
        'the salon is closed on the day of the week',
        {
          salon: salonWith({
            businessHours: [weeklyHours({ isClosed: true })],
          }),
        },
      ],
      ['the service is not active', { service: cutWith({ isActive: false }) }],
      [
        'the service is discontinued',
        { service: cutWith({ serviceStatus: 'discontinued' }) },
      ],
      [
        'the service is not booked online',
        { service: cutWith({ allowOnlineBooking: false }) },
      ],
      [
        'the service is offered at weekends only',
        { service: cutWith({ availability: 'weekends_only' }) },
      ],
      [
        'the staff member is not active',
        { staff: staffOfDay({ isActive: false }) },
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
            taken: [{ bookingId: BOOKING_ID, ...time('10:30', '11:30') }],
          }),
        },
      ],
    ])('refuses the slot at ten when %s', (_case, overrides) => {
      expect(planAt('10:00', overrides)).toEqual(notASlot)
    })

    it('refuses a service that has to be booked in advance on the day itself, and plans it the day before', () => {
      const service = cutWith({
        bookingRequirements: ['advance_booking_required'],
      })

      expect(planAt('15:00', { service }, jst('09:00'))).toEqual(notASlot)
      expect(
        planAt('15:00', { service }, jst('23:59', '2026-11-15')).type,
      ).toBe('planned')
    })

    it('lets as many customers into a slot as the staff member takes at once', () => {
      const taken = [{ bookingId: BOOKING_ID, ...time('10:00', '11:00') }]

      expect(
        planAt('10:00', {
          staff: staffOfDay({ maxConcurrentBookings: 2, taken }),
        }).type,
      ).toBe('planned')
      expect(
        planAt('10:00', {
          staff: staffOfDay({ maxConcurrentBookings: 1, taken }),
        }),
      ).toEqual(notASlot)
    })

    describe('the calendar of the salon', () => {
      const closed = { openTime: null, closeTime: null }
      const early = { openTime: '08:00:00', closeTime: '12:00:00' }

      it('reads the row of the date the time is on in the time zone of the salon', () => {
        expect(
          planAt('10:00', { calendarDays: [{ date: DATE, ...closed }] }),
        ).toEqual(notASlot)
        expect(
          planAt('09:00', { calendarDays: [{ date: DATE, ...early }] }).type,
        ).toBe('planned')
        expect(
          planAt('13:00', { calendarDays: [{ date: DATE, ...early }] }),
        ).toEqual(notASlot)
      })

      it('does not read the rows of the days around it', () => {
        const around = [
          { date: '2026-11-15', ...closed },
          { date: '2026-11-17', ...closed },
        ]

        expect(planAt('10:00', { calendarDays: around }).type).toBe('planned')
        expect(
          planAt('10:00', {
            calendarDays: [...around, { date: DATE, ...closed }],
          }),
        ).toEqual(notASlot)
      })

      it('takes the date in the time zone of the salon, which is not the one in UTC early in the morning', () => {
        // 08:30 in Tokyo on the 16th is 23:30 on the 15th in UTC.
        const overrides = {
          calendarDays: [{ date: DATE, ...early }],
          staff: staffOfDay({
            schedules: [dbStaffSchedule({ startTime: '08:00:00' })],
          }),
        }

        const plan = planAt('08:30', overrides)

        expect(writeOf(plan).booking).toMatchObject({
          bookingDate: DATE,
          startTime: '2026-11-15T23:30:00.000Z',
        })
      })
    })

    describe('a service that is booked so many times a day', () => {
      const once = cutWith({ maxBookingsPerDay: 1 })

      it('is refused once the day is full, whoever the staff member', () => {
        expect(
          planAt('15:00', { service: once, serviceLineStarts: [jst('10:00')] }),
        ).toEqual(notASlot)
        expect(
          planAt('15:00', {
            service: cutWith({ maxBookingsPerDay: 2 }),
            serviceLineStarts: [jst('10:00')],
          }).type,
        ).toBe('planned')
      })

      it('counts the day of the salon: neither the day before nor the day after', () => {
        const others = [jst('23:59', '2026-11-15'), jst('00:00', '2026-11-17')]

        expect(
          planAt('15:00', { service: once, serviceLineStarts: others }).type,
        ).toBe('planned')
        expect(
          planAt('15:00', {
            service: once,
            serviceLineStarts: [...others, jst('00:00')],
          }),
        ).toEqual(notASlot)
      })
    })
  })

  describe('the customer who books', () => {
    it.each<[string, CustomerBookingReferences['customer'], string]>([
      ['is active', { isActive: true, customerStatus: 'active' }, 'planned'],
      ['is a VIP', { isActive: true, customerStatus: 'vip' }, 'planned'],
      [
        'is set aside as inactive',
        { isActive: true, customerStatus: 'inactive' },
        'customerNotAccepted',
      ],
      [
        'is blacklisted',
        { isActive: true, customerStatus: 'blacklisted' },
        'customerNotAccepted',
      ],
      [
        'is not active',
        { isActive: false, customerStatus: 'active' },
        'customerNotAccepted',
      ],
      [
        'is a VIP who is not active',
        { isActive: false, customerStatus: 'vip' },
        'customerNotAccepted',
      ],
    ])('answers a customer who %s with %s', (_case, customer, outcome) => {
      expect(planAt('10:00', { customer }).type).toBe(outcome)
    })

    it.each<[string, string, string, string]>([
      ['at the same time', '10:00', '11:00', 'customerOccupied'],
      ['that begins during it', '10:59', '12:00', 'customerOccupied'],
      ['that ends during it', '09:00', '10:01', 'customerOccupied'],
      ['that lasts all day', '08:00', '20:00', 'customerOccupied'],
      ['within it', '10:20', '10:40', 'customerOccupied'],
      ['that ends when it begins', '09:00', '10:00', 'planned'],
      ['that begins when it ends', '11:00', '12:00', 'planned'],
      ['later that day', '15:00', '16:00', 'planned'],
    ])(
      'answers a slot for which the customer has another booking %s with %s',
      (_case, from, until, outcome) => {
        expect(
          planAt('10:00', { customerTimes: [time(from, until)] }).type,
        ).toBe(outcome)
      },
    )

    it('looks at every other booking of the customer', () => {
      const customerTimes = [
        time('08:00', '09:00'),
        time('13:00', '14:00'),
        time('15:30', '16:30'),
      ]

      expect(planAt('10:00', { customerTimes }).type).toBe('planned')
      expect(planAt('13:30', { customerTimes }).type).toBe('customerOccupied')
      expect(planAt('15:00', { customerTimes }).type).toBe('customerOccupied')
      expect(planAt('16:30', { customerTimes }).type).toBe('planned')
    })

    it('measures the other bookings against the time the service takes', () => {
      const perm = cutWith({ duration: 120 })
      const customerTimes = [time('16:30', '17:00')]

      expect(planAt('15:00', { service: perm, customerTimes }).type).toBe(
        'customerOccupied',
      )
      expect(planAt('15:00', { customerTimes }).type).toBe('planned')
    })
  })

  describe('what the request refers to', () => {
    const issue = (field: string, message: LocalizedText) => ({
      field,
      rule: 'not_found',
      message,
    })

    it('reports a salon that is not there, and nothing of what would be of it', () => {
      expect(
        planAt('10:00', { salon: null, service: null, staff: null }),
      ).toEqual({
        type: 'invalid',
        issues: [issue('salonId', ruleMessages.aSalon)],
      })
    })

    it.each<[string, Partial<CustomerBookingReferences>, string[]]>([
      ['a service', { service: null }, ['serviceId']],
      ['a staff member', { staff: null }, ['staffId']],
      ['either', { service: null, staff: null }, ['serviceId', 'staffId']],
    ])(
      'reports a salon without %s of the request',
      (_case, overrides, fields) => {
        const plan = planAt('10:00', overrides)

        expect(plan).toEqual({
          type: 'invalid',
          issues: fields.map((field) =>
            issue(
              field,
              field === 'serviceId'
                ? ruleMessages.aServiceOfSalon
                : ruleMessages.aStaffMemberOfSalon,
            ),
          ),
        })
      },
    )

    it('reports a price that is more than a booking holds for the service', () => {
      const plan = planAt('10:00', {
        service: cutWith({ price: 2_147_483_647, taxIncluded: false }),
      })

      expect(plan).toEqual({
        type: 'invalid',
        issues: [
          {
            field: 'serviceId',
            rule: 'too_big',
            message: bookingMessages.amountsWithinLimit(2147483647),
          },
        ],
      })
    })
  })

  describe('the order in which a request is looked at', () => {
    const everythingWrong: Partial<CustomerBookingReferences> = {
      customer: { isActive: false, customerStatus: 'blacklisted' },
      salon: salonWith({
        timezone: 'Mars/Olympus',
        businessHours: [{ dayOfWeek: 'someday' }],
      }),
      service: cutWith({ price: 2_147_483_647, taxIncluded: false }),
      staff: staffOfDay({ schedules: [] }),
      customerTimes: [time('10:00', '11:00')],
    }

    it('answers a customer who is not there before anything else', () => {
      expect(
        planAt('10:00', {
          ...everythingWrong,
          customer: null,
          salon: null,
          service: null,
          staff: null,
        }),
      ).toEqual({ type: 'profileNotFound' })
    })

    it('reports what is not there before it looks at the time zone', () => {
      expect(planAt('10:00', { ...everythingWrong, service: null }).type).toBe(
        'invalid',
      )
    })

    it('answers a time zone the runtime does not know before it looks at the customer', () => {
      expect(
        planAt('10:00', {
          ...everythingWrong,
          service: cutWith({}),
        }),
      ).toEqual({ type: 'timeZoneUnknown' })
    })

    it('looks at the customer before the hours of the salon', () => {
      expect(
        planAt('10:00', {
          ...everythingWrong,
          service: cutWith({}),
          salon: salonWith({ businessHours: [{ dayOfWeek: 'someday' }] }),
        }),
      ).toEqual({ type: 'customerNotAccepted' })
    })

    it('answers stored hours that do not have the shape of the model with the error of the mapper, before it looks at the slot', () => {
      const plan = planAt('03:00', {
        salon: salonWith({ businessHours: [{ dayOfWeek: 'someday' }] }),
        customerTimes: [time('03:00', '04:00')],
      })

      expect(plan).toMatchObject({
        type: 'hoursUnreadable',
        error: {
          type: 'database',
          message: `Stored salon ${SALON_ID} does not match the API model`,
        },
      })
    })

    it('looks at the slot before the other bookings of the customer', () => {
      expect(
        planAt('03:00', { customerTimes: [time('03:00', '04:00')] }),
      ).toEqual(notASlot)
    })
  })
})

describe('refusalOfSlot', () => {
  it('should answer a time zone the runtime does not know, in which no slot can be told', () => {
    // Arrange
    const asked = { date: DATE, startTime: jst('10:00'), duration: 60 }

    // Act
    const refusal = refusalOfSlot(asked, NOW, {
      customer: { isActive: true, customerStatus: 'active' },
      salon: salonWith({ timezone: 'Mars/Olympus' }),
      service: cutWith({}),
      staff: staffOfDay(),
      calendarDays: [],
      serviceLineStarts: [],
      customerTimes: [],
    })

    // Assert
    expect(refusal).toEqual({ type: 'timeZoneUnknown' })
  })
})

describe('candidateDatesOf', () => {
  it.each([
    ['at ten in Tokyo', '10:00', DATE],
    ['just after midnight in UTC', '09:00', DATE],
    ['at the end of the day in UTC', '08:59', '2026-11-17'],
  ])(
    'returns the date in UTC with the one before and the one after, for a time %s',
    (_case, start, date) => {
      const asked = request('10:00', {
        startTime: jst(start, date).toISOString(),
      })

      expect(candidateDatesOf(asked)).toEqual([
        '2026-11-15',
        '2026-11-16',
        '2026-11-17',
      ])
    },
  )

  it.each([
    'Pacific/Kiritimati',
    'Asia/Tokyo',
    'UTC',
    'America/New_York',
    'Etc/GMT+12',
  ])('has the date the time is on in %s, at whatever hour', (timeZone) => {
    for (let hour = 0; hour < 24; hour += 1) {
      const moment = new Date(Date.UTC(2026, 10, 16, hour, 30))
      const asked = request('10:00', { startTime: moment.toISOString() })

      const days = candidateDatesOf(asked).map((date) => dayIn(date, timeZone))

      expect(
        days.some(
          (day) => day !== null && day.from <= moment && moment < day.until,
        ),
      ).toBe(true)
    }
  })
})

describe('candidateTimeOf', () => {
  const written = ({ from, until }: { from: Date; until: Date }): string =>
    `${from.toISOString()} - ${until.toISOString()}`

  it('returns the time from the first moment of the first date in the time zone furthest ahead to the last of the last date in the one furthest behind', () => {
    expect(written(candidateTimeOf(request('10:00'), 0))).toBe(
      '2026-11-14T10:00:00.000Z - 2026-11-18T12:00:00.000Z',
    )
  })

  it('is wider by the minutes around it, before and after', () => {
    expect(written(candidateTimeOf(request('10:00'), 45))).toBe(
      '2026-11-14T09:15:00.000Z - 2026-11-18T12:45:00.000Z',
    )
  })

  it.each([
    'Pacific/Kiritimati',
    'Asia/Tokyo',
    'UTC',
    'America/New_York',
    'Etc/GMT+12',
  ])('holds every date the time can be on in %s', (timeZone) => {
    const asked = request('10:00')
    const widest = candidateTimeOf(asked, 0)

    for (const date of candidateDatesOf(asked)) {
      const day = dayIn(date, timeZone)

      expect(
        day !== null && widest.from <= day.from && day.until <= widest.until,
      ).toBe(true)
    }
  })
})
