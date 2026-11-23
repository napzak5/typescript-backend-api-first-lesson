import { availableSlotMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import {
  DATE,
  jst,
  serviceOfSlots,
  staffOfDay,
  weeklyHours,
} from '../../../__tests__/fixtures/available-slot-fixtures'
import { OTHER_SALON_ID, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import {
  dayOffEntry,
  dbStaffSchedule,
  singleDayEntry,
} from '../../../__tests__/fixtures/staff-schedule-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  ServiceOfSlots,
  StaffOfSlots,
} from '../../../models/available-slot'
import { salonIdSchema } from '../../../models/salon'
import {
  booksOnline,
  hasRoomFor,
  isBookable,
  isBookedInTime,
  isOfferedOn,
  takesBookings,
  takesBookingsOf,
} from '../_shared/acceptance'
import { mayAskLedgerOf } from '../_shared/authorization'
import { type HoursOfSalon, openRangesOf } from '../_shared/opening'
import { comesAfter, slotCursorOf, slotPositionOf } from '../_shared/page'
import { timeZoneUnknown } from '../_shared/refusals'
import type { Slot } from '../_shared/slots'
import type { TimeRange } from '../_shared/time-ranges'
import { workingRangesOf } from '../_shared/working'

/** A stretch of a date between two times of the clocks of Tokyo. */
const range = (
  from: string,
  until: string,
  date: string = DATE,
): TimeRange => ({
  from: jst(from, date),
  until: jst(until, date),
})

/** Ranges as text, in UTC. */
const written = (ranges: readonly TimeRange[]): string[] =>
  ranges.map(
    ({ from, until }) => `${from.toISOString()} - ${until.toISOString()}`,
  )

const inTokyo = (
  businessHours: HoursOfSalon['businessHours'],
): HoursOfSalon => ({ timezone: 'Asia/Tokyo', businessHours })

const inNewYork = (
  businessHours: HoursOfSalon['businessHours'],
): HoursOfSalon => ({ timezone: 'America/New_York', businessHours })

describe('openRangesOf', () => {
  describe('without a row of the calendar for the date', () => {
    it('is closed for a salon that has said no weekly hours', () => {
      expect(openRangesOf(inTokyo(null), null, DATE)).toEqual([])
      expect(openRangesOf(inTokyo([]), null, DATE)).toEqual([])
    })

    it('is open during the operating slots of the day of the week of the date', () => {
      expect(openRangesOf(inTokyo([weeklyHours()]), null, DATE)).toEqual([
        range('10:00', '19:00'),
      ])
    })

    it('returns the times as moments, not as times of a time zone', () => {
      expect(
        written(openRangesOf(inTokyo([weeklyHours()]), null, DATE)),
      ).toEqual(['2026-11-16T01:00:00.000Z - 2026-11-16T10:00:00.000Z'])
    })

    it('reads the entry of the day of the week of the date, among those of the other days', () => {
      const hours = [
        weeklyHours({
          dayOfWeek: 'sunday',
          operatingSlots: [{ startTime: '08:00', endTime: '12:00' }],
        }),
        weeklyHours(),
        weeklyHours({
          dayOfWeek: 'tuesday',
          operatingSlots: [{ startTime: '12:00', endTime: '21:00' }],
        }),
      ]

      expect(openRangesOf(inTokyo(hours), null, '2026-11-15')).toEqual([
        range('08:00', '12:00', '2026-11-15'),
      ])
      expect(openRangesOf(inTokyo(hours), null, DATE)).toEqual([
        range('10:00', '19:00'),
      ])
      expect(openRangesOf(inTokyo(hours), null, '2026-11-17')).toEqual([
        range('12:00', '21:00', '2026-11-17'),
      ])
    })

    it('is closed on a day of the week the weekly hours have no entry for', () => {
      expect(
        openRangesOf(inTokyo([weeklyHours()]), null, '2026-11-17'),
      ).toEqual([])
    })

    it('is closed on a day the weekly hours close', () => {
      expect(
        openRangesOf(
          inTokyo([weeklyHours({ isClosed: true, operatingSlots: [] })]),
          null,
          DATE,
        ),
      ).toEqual([])
    })

    it('is closed on a day that is closed although it has operating slots', () => {
      expect(
        openRangesOf(inTokyo([weeklyHours({ isClosed: true })]), null, DATE),
      ).toEqual([])
    })

    it('is closed on a day without operating slots', () => {
      expect(
        openRangesOf(
          inTokyo([weeklyHours({ operatingSlots: [] })]),
          null,
          DATE,
        ),
      ).toEqual([])
    })

    it('is open during each operating slot of a day that has several', () => {
      expect(
        openRangesOf(
          inTokyo([
            weeklyHours({
              operatingSlots: [
                { startTime: '15:00', endTime: '20:00' },
                { startTime: '09:00', endTime: '13:00' },
              ],
            }),
          ]),
          null,
          DATE,
        ),
      ).toEqual([range('09:00', '13:00'), range('15:00', '20:00')])
    })

    it('is open without a gap where an operating slot ends as the next begins', () => {
      expect(
        openRangesOf(
          inTokyo([
            weeklyHours({
              operatingSlots: [
                { startTime: '09:00', endTime: '13:00' },
                { startTime: '13:00', endTime: '20:00' },
              ],
            }),
          ]),
          null,
          DATE,
        ),
      ).toEqual([range('09:00', '20:00')])
    })

    it('is closed during the break slots', () => {
      expect(
        openRangesOf(
          inTokyo([
            weeklyHours({
              breakSlots: [
                { startTime: '13:00', endTime: '14:00' },
                { startTime: '16:00', endTime: '16:30' },
              ],
            }),
          ]),
          null,
          DATE,
        ),
      ).toEqual([
        range('10:00', '13:00'),
        range('14:00', '16:00'),
        range('16:30', '19:00'),
      ])
    })

    it('opens later and closes earlier for break slots at the beginning and the end of the day', () => {
      expect(
        openRangesOf(
          inTokyo([
            weeklyHours({
              breakSlots: [
                { startTime: '09:00', endTime: '11:00' },
                { startTime: '18:00', endTime: '19:00' },
              ],
            }),
          ]),
          null,
          DATE,
        ),
      ).toEqual([range('11:00', '18:00')])
    })

    describe('with a period the entry is for', () => {
      const during = (startDate: string, endDate: string) =>
        openRangesOf(
          inTokyo([weeklyHours({ effectivePeriod: { startDate, endDate } })]),
          null,
          DATE,
        )

      it('is open on a date within the period', () => {
        expect(during('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')).toEqual([
          range('10:00', '19:00'),
        ])
      })

      it('is closed on a date before the period begins', () => {
        expect(during('2026-11-17T00:00:00Z', '2026-12-01T00:00:00Z')).toEqual(
          [],
        )
      })

      it('is closed on a date after the period ended', () => {
        expect(during('2026-10-01T00:00:00Z', '2026-11-15T15:00:00Z')).toEqual(
          [],
        )
      })

      it('opens when the period begins on a date on which it does', () => {
        // 2026-11-16T03:00:00Z is 12:00 in Tokyo.
        expect(during('2026-11-16T03:00:00Z', '2026-12-01T00:00:00Z')).toEqual([
          range('12:00', '19:00'),
        ])
      })

      it('closes when the period ends on a date on which it does', () => {
        // 2026-11-16T06:30:00.000Z is 15:30 in Tokyo.
        expect(
          during('2026-11-01T00:00:00Z', '2026-11-16T06:30:00.000Z'),
        ).toEqual([range('10:00', '15:30')])
      })

      it('is closed for a period that ends as the salon would open', () => {
        expect(during('2026-11-01T00:00:00Z', '2026-11-16T01:00:00Z')).toEqual(
          [],
        )
      })
    })

    it('reads the times as those of the clocks of the time zone of the salon', () => {
      const hours = [
        weeklyHours({
          dayOfWeek: 'wednesday',
          operatingSlots: [{ startTime: '09:00', endTime: '17:00' }],
        }),
      ]

      expect(
        written(openRangesOf(inNewYork(hours), null, '2026-07-15')),
      ).toEqual(['2026-07-15T13:00:00.000Z - 2026-07-15T21:00:00.000Z'])
      expect(
        written(openRangesOf(inNewYork(hours), null, '2026-01-14')),
      ).toEqual(['2026-01-14T14:00:00.000Z - 2026-01-14T22:00:00.000Z'])
    })

    // The clocks of New York skip 02:00 to 03:00 on 2026-03-08 and show
    // 01:00 to 02:00 twice on 2026-11-01. Both are Sundays.
    const sundayNight = [
      weeklyHours({
        dayOfWeek: 'sunday',
        operatingSlots: [{ startTime: '00:00', endTime: '04:00' }],
      }),
    ]

    it('is open an hour less on the night the clocks are put forward', () => {
      expect(
        written(openRangesOf(inNewYork(sundayNight), null, '2026-03-08')),
      ).toEqual(['2026-03-08T05:00:00.000Z - 2026-03-08T08:00:00.000Z'])
    })

    it('is open an hour more on the night the clocks are put back', () => {
      expect(
        written(openRangesOf(inNewYork(sundayNight), null, '2026-11-01')),
      ).toEqual(['2026-11-01T04:00:00.000Z - 2026-11-01T09:00:00.000Z'])
    })

    it('has no break left where the clocks skip the whole of it', () => {
      expect(
        written(
          openRangesOf(
            inNewYork([
              weeklyHours({
                dayOfWeek: 'sunday',
                operatingSlots: [{ startTime: '00:00', endTime: '04:00' }],
                breakSlots: [{ startTime: '02:00', endTime: '03:00' }],
              }),
            ]),
            null,
            '2026-03-08',
          ),
        ),
      ).toEqual(['2026-03-08T05:00:00.000Z - 2026-03-08T08:00:00.000Z'])
    })
  })

  describe('with a row of the calendar for the date', () => {
    const open = { openTime: '11:00:00', closeTime: '16:00:00' }
    const closed = { openTime: null, closeTime: null }

    it('is open between the two times of the row', () => {
      expect(openRangesOf(inTokyo(null), open, DATE)).toEqual([
        range('11:00', '16:00'),
      ])
    })

    it('is open between the times of the row whatever the weekly hours say', () => {
      expect(openRangesOf(inTokyo([weeklyHours()]), open, DATE)).toEqual([
        range('11:00', '16:00'),
      ])
      expect(
        openRangesOf(
          inTokyo([weeklyHours({ isClosed: true, operatingSlots: [] })]),
          open,
          DATE,
        ),
      ).toEqual([range('11:00', '16:00')])
    })

    it('is open during the weekly breaks: the row decides alone', () => {
      expect(
        openRangesOf(
          inTokyo([
            weeklyHours({
              breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
            }),
          ]),
          open,
          DATE,
        ),
      ).toEqual([range('11:00', '16:00')])
    })

    it('is open outside of the period of the weekly entry', () => {
      expect(
        openRangesOf(
          inTokyo([
            weeklyHours({
              effectivePeriod: {
                startDate: '2027-01-01T00:00:00Z',
                endDate: '2027-02-01T00:00:00Z',
              },
            }),
          ]),
          open,
          DATE,
        ),
      ).toEqual([range('11:00', '16:00')])
    })

    it('is closed all day for a row without times, whatever the weekly hours say', () => {
      expect(openRangesOf(inTokyo(null), closed, DATE)).toEqual([])
      expect(openRangesOf(inTokyo([weeklyHours()]), closed, DATE)).toEqual([])
    })

    it('is closed for a row that has only one of the two times', () => {
      expect(
        openRangesOf(
          inTokyo([weeklyHours()]),
          { openTime: '11:00:00', closeTime: null },
          DATE,
        ),
      ).toEqual([])
      expect(
        openRangesOf(
          inTokyo([weeklyHours()]),
          { openTime: null, closeTime: '16:00:00' },
          DATE,
        ),
      ).toEqual([])
    })

    it('is closed for a row that closes when it opens, or before', () => {
      expect(
        openRangesOf(
          inTokyo(null),
          { openTime: '11:00:00', closeTime: '11:00:00' },
          DATE,
        ),
      ).toEqual([])
      expect(
        openRangesOf(
          inTokyo(null),
          { openTime: '16:00:00', closeTime: '11:00:00' },
          DATE,
        ),
      ).toEqual([])
    })

    it('reads the times as those of the clocks of the time zone of the salon', () => {
      expect(
        written(openRangesOf(inNewYork(null), open, '2026-07-15')),
      ).toEqual(['2026-07-15T15:00:00.000Z - 2026-07-15T20:00:00.000Z'])
    })
  })
})

describe('workingRangesOf', () => {
  const working = (
    schedule: Parameters<typeof workingRangesOf>[0],
    date: string = DATE,
    timeZone = 'Asia/Tokyo',
  ) => workingRangesOf(schedule, date, timeZone)

  it('is nobody working on a day without a row', () => {
    expect(working(null)).toEqual([])
  })

  it('is nobody working on a day off', () => {
    expect(working(dbStaffSchedule(dayOffEntry({ date: DATE })))).toEqual([])
  })

  it('is nobody working on a day off that still has times', () => {
    expect(working(dbStaffSchedule({ isAvailable: false }))).toEqual([])
  })

  it('is the shift from its beginning to its end, without the break', () => {
    expect(working(dbStaffSchedule())).toEqual([
      range('09:00', '12:00'),
      range('13:00', '18:00'),
    ])
  })

  it('is the whole shift of a day without a break', () => {
    expect(working(dbStaffSchedule(singleDayEntry({ date: DATE })))).toEqual([
      range('10:00', '15:00'),
    ])
  })

  it('is the whole shift when the row has only one time of a break', () => {
    expect(working(dbStaffSchedule({ breakEndTime: null }))).toEqual([
      range('09:00', '18:00'),
    ])
    expect(working(dbStaffSchedule({ breakStartTime: null }))).toEqual([
      range('09:00', '18:00'),
    ])
  })

  it('is nobody working for a working day whose row lacks a time of the shift', () => {
    expect(working(dbStaffSchedule({ startTime: null }))).toEqual([])
    expect(working(dbStaffSchedule({ endTime: null }))).toEqual([])
  })

  it('is nobody working for a shift that ends when it begins', () => {
    expect(
      working(dbStaffSchedule({ startTime: '09:00:00', endTime: '09:00:00' })),
    ).toEqual([])
  })

  it('is the times of the date that is asked for, not of the date of the row', () => {
    expect(working(dbStaffSchedule(), '2026-11-23')).toEqual([
      range('09:00', '12:00', '2026-11-23'),
      range('13:00', '18:00', '2026-11-23'),
    ])
  })

  it('reads the times as those of the clocks of the time zone', () => {
    expect(
      written(working(dbStaffSchedule(), '2026-07-13', 'America/New_York')),
    ).toEqual([
      '2026-07-13T13:00:00.000Z - 2026-07-13T16:00:00.000Z',
      '2026-07-13T17:00:00.000Z - 2026-07-13T22:00:00.000Z',
    ])
  })
})

describe('takesBookings', () => {
  it('is whether the salon is active', () => {
    expect(takesBookings({ isActive: true })).toBe(true)
    expect(takesBookings({ isActive: false })).toBe(false)
  })
})

describe('isBookable', () => {
  it('is true for a service that is on the menu, offered now and booked online', () => {
    expect(isBookable(serviceOfSlots())).toBe(true)
  })

  it('is false for a service that is not active', () => {
    expect(isBookable(serviceOfSlots({ isActive: false }))).toBe(false)
  })

  it('is false for a service the salon does not take online bookings for', () => {
    expect(isBookable(serviceOfSlots({ allowOnlineBooking: false }))).toBe(
      false,
    )
  })

  const notOffered: ServiceOfSlots['serviceStatus'][] = [
    'inactive',
    'coming_soon',
    'discontinued',
  ]
  it.each(notOffered)(
    'is false for a service whose status is %s',
    (serviceStatus) => {
      expect(isBookable(serviceOfSlots({ serviceStatus }))).toBe(false)
    },
  )
})

describe('isOfferedOn', () => {
  // 2026-11-16 is a Monday.
  const week: [string, string, boolean][] = [
    ['Monday', '2026-11-16', false],
    ['Tuesday', '2026-11-17', false],
    ['Wednesday', '2026-11-18', false],
    ['Thursday', '2026-11-19', false],
    ['Friday', '2026-11-20', false],
    ['Saturday', '2026-11-21', true],
    ['Sunday', '2026-11-22', true],
  ]

  it.each(week)(
    'offers a service of weekdays only on a %s as it is one, and not otherwise',
    (_day, date, isWeekend) => {
      expect(isOfferedOn({ availability: 'weekdays_only' }, date)).toBe(
        !isWeekend,
      )
    },
  )

  it.each(week)(
    'offers a service of weekends only on a %s as it is at a weekend, and not otherwise',
    (_day, date, isWeekend) => {
      expect(isOfferedOn({ availability: 'weekends_only' }, date)).toBe(
        isWeekend,
      )
    },
  )

  const everyDay: ServiceOfSlots['availability'][] = [
    'always',
    'by_appointment_only',
    'seasonal',
  ]
  it.each(everyDay)(
    'offers a service whose availability is %s on every day of the week',
    (availability) => {
      expect(
        week.map(([, date]) => isOfferedOn({ availability }, date)),
      ).toEqual([true, true, true, true, true, true, true])
    },
  )
})

describe('isBookedInTime', () => {
  const inAdvance: Pick<ServiceOfSlots, 'bookingRequirements'> = {
    bookingRequirements: ['deposit_required', 'advance_booking_required'],
  }

  it('is true for the day itself for a service without the requirement', () => {
    expect(isBookedInTime({ bookingRequirements: [] }, DATE, DATE)).toBe(true)
  })

  it('does not ask for a booking in advance for the other requirements', () => {
    expect(
      isBookedInTime(
        {
          bookingRequirements: [
            'consultation_required',
            'patch_test_required',
            'deposit_required',
          ],
        },
        DATE,
        DATE,
      ),
    ).toBe(true)
  })

  it('is false for the day itself for a service that has to be booked in advance', () => {
    expect(isBookedInTime(inAdvance, DATE, DATE)).toBe(false)
  })

  it('is true for the day after today for such a service', () => {
    expect(isBookedInTime(inAdvance, '2026-11-17', DATE)).toBe(true)
    expect(isBookedInTime(inAdvance, '2026-12-01', '2026-11-30')).toBe(true)
    expect(isBookedInTime(inAdvance, '2027-01-01', '2026-12-31')).toBe(true)
  })

  it('is false for a day before today for such a service', () => {
    expect(isBookedInTime(inAdvance, '2026-11-15', DATE)).toBe(false)
    expect(isBookedInTime(inAdvance, '2026-10-30', DATE)).toBe(false)
  })
})

describe('hasRoomFor', () => {
  it('always has room for a service without a number of bookings per day', () => {
    expect(hasRoomFor({ maxBookingsPerDay: null }, 0)).toBe(true)
    expect(hasRoomFor({ maxBookingsPerDay: null }, 1000)).toBe(true)
  })

  it('has room while the service is booked fewer times than the number', () => {
    expect(hasRoomFor({ maxBookingsPerDay: 3 }, 0)).toBe(true)
    expect(hasRoomFor({ maxBookingsPerDay: 3 }, 2)).toBe(true)
  })

  it('has no room once the service is booked as many times as the number, or more', () => {
    expect(hasRoomFor({ maxBookingsPerDay: 3 }, 3)).toBe(false)
    expect(hasRoomFor({ maxBookingsPerDay: 3 }, 4)).toBe(false)
    expect(hasRoomFor({ maxBookingsPerDay: 1 }, 1)).toBe(false)
  })
})

describe('takesBookingsOf', () => {
  const LEVELS: StaffOfSlots['level'][] = [
    'junior',
    'stylist',
    'senior',
    'expert',
    'director',
  ]
  const anyone = { requiredStaffLevel: null }

  it('is true for a staff member who works at the salon and takes bookings', () => {
    expect(takesBookingsOf(staffOfDay(), anyone)).toBe(true)
  })

  it('is false for a staff member who is not active', () => {
    expect(takesBookingsOf(staffOfDay({ isActive: false }), anyone)).toBe(false)
  })

  it('is false for a staff member who does not take bookings', () => {
    expect(
      takesBookingsOf(staffOfDay({ canReceiveBookings: false }), anyone),
    ).toBe(false)
  })

  it.each(LEVELS)(
    'lets a staff member of the level %s take a service that asks for no level',
    (level) => {
      expect(takesBookingsOf(staffOfDay({ level }), anyone)).toBe(true)
    },
  )

  it.each(
    LEVELS.map(
      (
        requiredStaffLevel,
        required,
      ): [StaffOfSlots['level'], StaffOfSlots['level'][]] => [
        requiredStaffLevel,
        LEVELS.slice(required),
      ],
    ),
  )(
    'lets a service that asks for the level %s be taken by the levels %j and no others',
    (requiredStaffLevel, qualifying) => {
      const service = serviceOfSlots({ requiredStaffLevel })

      expect(
        LEVELS.filter((level) =>
          takesBookingsOf(staffOfDay({ level }), service),
        ),
      ).toEqual(qualifying)
    },
  )

  it('is false for a staff member of the level who does not take bookings', () => {
    expect(
      takesBookingsOf(
        staffOfDay({ level: 'director', canReceiveBookings: false }),
        { requiredStaffLevel: 'junior' },
      ),
    ).toBe(false)
  })
})

describe('booksOnline', () => {
  it.each<[string, Parameters<typeof booksOnline>[0], boolean]>([
    ['an active customer', { isActive: true, customerStatus: 'active' }, true],
    ['a VIP', { isActive: true, customerStatus: 'vip' }, true],
    [
      'a customer set aside as inactive',
      { isActive: true, customerStatus: 'inactive' },
      false,
    ],
    [
      'a blacklisted customer',
      { isActive: true, customerStatus: 'blacklisted' },
      false,
    ],
    [
      'a customer who is not active',
      { isActive: false, customerStatus: 'active' },
      false,
    ],
    [
      'a VIP who is not active',
      { isActive: false, customerStatus: 'vip' },
      false,
    ],
    [
      'a blacklisted customer who is not active',
      { isActive: false, customerStatus: 'blacklisted' },
      false,
    ],
  ])('says of %s whether they book by themself', (_case, customer, books) => {
    expect(booksOnline(customer)).toBe(books)
  })
})

describe('the cursor of a page of slots', () => {
  const slot = (
    startTime: string,
    staffId: string = STAFF_MEMBER_ID,
  ): Slot => ({
    staffId,
    startTime: jst(startTime),
    endTime: jst(startTime),
  })

  describe('slotCursorOf', () => {
    it('writes when the slot begins, in UTC, and whose it is', () => {
      expect(slotCursorOf(slot('10:00'))).toBe(
        `2026-11-16T01:00:00.000Z_${STAFF_MEMBER_ID}`,
      )
    })
  })

  describe('slotPositionOf', () => {
    it('reads what `slotCursorOf` wrote', () => {
      expect(slotPositionOf(slotCursorOf(slot('10:30')))).toEqual({
        startTime: jst('10:30'),
        staffId: STAFF_MEMBER_ID,
      })
    })

    it('reads a time without milliseconds and an ID in upper case as the same position', () => {
      expect(
        slotPositionOf(`2026-11-16T01:30:00Z_${STAFF_MEMBER_ID.toUpperCase()}`),
      ).toEqual({ startTime: jst('10:30'), staffId: STAFF_MEMBER_ID })
    })

    it.each([
      ['an empty text', ''],
      ['a text of another kind', 'eyJpZCI6MX0='],
      ['a time alone', '2026-11-16T01:00:00.000Z'],
      ['a time and a separator', '2026-11-16T01:00:00.000Z_'],
      ['an ID alone', STAFF_MEMBER_ID],
      ['an ID after a separator', `_${STAFF_MEMBER_ID}`],
      ['a date without a time', `2026-11-16_${STAFF_MEMBER_ID}`],
      [
        'a time that does not exist',
        `2026-11-16T25:00:00.000Z_${STAFF_MEMBER_ID}`,
      ],
      [
        'a time with an offset',
        `2026-11-16T10:00:00.000+09:00_${STAFF_MEMBER_ID}`,
      ],
      ['an ID that is not a UUID', '2026-11-16T01:00:00.000Z_abc'],
      [
        'the two the other way round',
        `${STAFF_MEMBER_ID}_2026-11-16T01:00:00.000Z`,
      ],
      [
        'a third part',
        `2026-11-16T01:00:00.000Z_${STAFF_MEMBER_ID}_${STAFF_MEMBER_ID}`,
      ],
      [
        'a separator at the end',
        `2026-11-16T01:00:00.000Z_${STAFF_MEMBER_ID}_`,
      ],
    ])('returns null for %s', (_what, cursor) => {
      expect(slotPositionOf(cursor)).toBeNull()
    })
  })

  describe('comesAfter', () => {
    const position = { startTime: jst('10:30'), staffId: STAFF_MEMBER_ID }

    it('is true for a slot that begins later, whoever it is of', () => {
      expect(comesAfter(slot('11:00'), position)).toBe(true)
      expect(
        comesAfter(
          slot('11:00', '00000000-0000-4000-8000-000000000000'),
          position,
        ),
      ).toBe(true)
    })

    it('is false for a slot that begins earlier, whoever it is of', () => {
      expect(comesAfter(slot('10:00'), position)).toBe(false)
      expect(comesAfter(slot('10:00', OTHER_STAFF_MEMBER_ID), position)).toBe(
        false,
      )
    })

    it('is false for the slot of the position itself', () => {
      expect(comesAfter(slot('10:30'), position)).toBe(false)
    })

    it('is true for a slot that begins at the same time and is of a staff member with a later ID', () => {
      expect(comesAfter(slot('10:30', OTHER_STAFF_MEMBER_ID), position)).toBe(
        true,
      )
    })

    it('is false for a slot that begins at the same time and is of a staff member with an earlier ID', () => {
      expect(
        comesAfter(slot('10:30'), {
          startTime: jst('10:30'),
          staffId: OTHER_STAFF_MEMBER_ID,
        }),
      ).toBe(false)
    })
  })
})

describe('mayAskLedgerOf', () => {
  const salon = salonIdSchema.parse(SALON_ID)

  const keepers: [string, Actor][] = [
    ['an administrator', actors.admin],
    ['the owner of the salon', actors.ofSalon('owner')],
    ['a manager of the salon', actors.ofSalon('manager')],
    ['a staff member of the salon', actors.ofSalon('staff')],
  ]
  it.each(keepers)('lets %s ask', (_who, actor) => {
    expect(mayAskLedgerOf(actor, salon)).toBe(true)
  })

  const others: [string, Actor][] = [
    ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
    [
      'a staff member of another salon',
      actors.ofSalon('staff', OTHER_SALON_ID),
    ],
    ['a customer', actors.customer],
    ['a customer without a profile', actors.customerWithoutProfile],
    ['a user without a scope', actors.withoutScope],
  ]
  it.each(others)('does not let %s ask', (_who, actor) => {
    expect(mayAskLedgerOf(actor, salon)).toBe(false)
  })
})

describe('timeZoneUnknown', () => {
  it('is a conflict that says what to correct', () => {
    expect(timeZoneUnknown()).toEqual({
      type: 'conflict',
      message: availableSlotMessages.timeZoneUnknown,
    })
  })
})
