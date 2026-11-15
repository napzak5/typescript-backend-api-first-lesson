import { describe, expect, it } from 'vitest'
import {
  type DayOfSlots,
  SLOT_STEP_MINUTES,
  type SlotsOfDay,
  type StaffOfDay,
  slotsOf,
} from '../business-logic/available-slot/_shared/slots'
import { NOW } from './auth-fixtures'
import {
  DATE,
  jst,
  STARTS_OF_DAY,
  serviceOfSlots,
  staffOfDay,
  weeklyHours,
} from './available-slot-fixtures'
import { BOOKING_ID, OTHER_BOOKING_ID } from './booking-fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'
import {
  dayOffEntry,
  dbStaffSchedule,
  singleDayEntry,
} from './staff-schedule-fixtures'

/**
 * `DATE` in a salon in Tokyo that is open from 10:00 to 19:00, with one
 * staff member who works from 09:00 to 18:00 and has a break from 12:00 to
 * 13:00, for a service of an hour, asked two days before.
 */
const day = (overrides: Partial<DayOfSlots> = {}): DayOfSlots => ({
  date: DATE,
  now: NOW,
  duration: 60,
  salon: {
    isActive: true,
    timezone: 'Asia/Tokyo',
    businessHours: [weeklyHours()],
  },
  calendarDay: null,
  service: serviceOfSlots(),
  serviceLineStarts: [],
  staff: [staffOfDay()],
  ...overrides,
})

const MILLISECONDS_OF_NINE_HOURS = 9 * 60 * 60 * 1000

/** The time the clocks of Tokyo show at a moment (HH:mm). */
const inTokyo = (moment: Date): string =>
  new Date(moment.getTime() + MILLISECONDS_OF_NINE_HOURS)
    .toISOString()
    .slice(11, 16)

/** When the slots of a staff member begin, as the clocks of Tokyo show it. */
const startsOf = (
  result: SlotsOfDay,
  staffId: string = STAFF_MEMBER_ID,
): string[] =>
  result.type === 'slots'
    ? result.slots
        .filter((slot) => slot.staffId === staffId)
        .map(({ startTime }) => inTokyo(startTime))
    : [result.type]

/** The slots as text, in UTC: `<start> - <end> <last characters of the staff ID>`. */
const written = (result: SlotsOfDay): string[] =>
  result.type === 'slots'
    ? result.slots.map(
        ({ staffId, startTime, endTime }) =>
          `${startTime.toISOString()} - ${endTime.toISOString()} ${staffId.slice(-2)}`,
      )
    : [result.type]

const taken = (bookingId: string, from: string, until: string) => ({
  bookingId,
  startTime: jst(from),
  endTime: jst(until),
})

describe('slotsOf', () => {
  it('begins a slot every half hour', () => {
    expect(SLOT_STEP_MINUTES).toBe(30)
  })

  it('returns the times at which the staff member can begin the service, where the salon is open and they work', () => {
    const result = slotsOf(day())

    expect(startsOf(result)).toEqual(STARTS_OF_DAY)
    expect(result).toEqual({
      type: 'slots',
      slots: STARTS_OF_DAY.map((start) => ({
        staffId: STAFF_MEMBER_ID,
        startTime: jst(start),
        endTime: new Date(jst(start).getTime() + 60 * 60 * 1000),
      })),
    })
  })

  describe('the length of the treatment', () => {
    it.each([
      [
        30,
        [
          ...['10:00', '10:30', '11:00', '11:30'],
          ...['13:00', '13:30', '14:00', '14:30', '15:00'],
          ...['15:30', '16:00', '16:30', '17:00', '17:30'],
        ],
      ],
      [
        90,
        [
          ...['10:00', '10:30'],
          ...['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'],
          '16:30',
        ],
      ],
      [
        120,
        [
          '10:00',
          '13:00',
          '13:30',
          '14:00',
          '14:30',
          '15:00',
          '15:30',
          '16:00',
        ],
      ],
      [121, ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30']],
      [299, ['13:00']],
      [300, ['13:00']],
      [301, []],
      [1440, []],
    ])(
      'leaves, for %i minutes, the slots within which the whole treatment lies in one stretch',
      (duration, starts) => {
        expect(startsOf(slotsOf(day({ duration })))).toEqual(starts)
      },
    )

    it('ends a slot as many minutes after it begins as the treatment takes, whatever the service takes', () => {
      const result = slotsOf(
        day({ duration: 45, service: serviceOfSlots({ duration: 60 }) }),
      )

      expect(written(result).slice(0, 2)).toEqual([
        '2026-11-16T01:00:00.000Z - 2026-11-16T01:45:00.000Z 01',
        '2026-11-16T01:30:00.000Z - 2026-11-16T02:15:00.000Z 01',
      ])
    })

    it('takes a treatment of one minute every half hour up to the last minute', () => {
      const starts = startsOf(slotsOf(day({ duration: 1 })))

      expect(starts.slice(0, 5)).toEqual([
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '13:00',
      ])
      expect(starts.at(-1)).toBe('17:30')
    })
  })

  describe('the stretches of the day', () => {
    it('counts the half hours from where a stretch begins, not from the hour', () => {
      const result = slotsOf(
        day({ calendarDay: { openTime: '10:15:00', closeTime: '19:00:00' } }),
      )

      expect(startsOf(result).slice(0, 3)).toEqual(['10:15', '10:45', '13:00'])
    })

    it('begins no slot before the salon opens or the shift begins, and none that ends after either ends', () => {
      const early = staffOfDay({
        schedules: [
          dbStaffSchedule({
            startTime: '07:00:00',
            endTime: '21:00:00',
            breakStartTime: null,
            breakEndTime: null,
          }),
        ],
      })
      const starts = startsOf(slotsOf(day({ staff: [early] })))

      expect(starts.at(0)).toBe('10:00')
      expect(starts.at(-1)).toBe('18:00')
      expect(starts).toHaveLength(17)
    })

    it('has no slot on a day the salon is closed by its calendar', () => {
      expect(
        slotsOf(day({ calendarDay: { openTime: null, closeTime: null } })),
      ).toEqual({ type: 'slots', slots: [] })
    })

    it('has the slots within the times of the calendar on a day the calendar has a row for', () => {
      expect(
        startsOf(
          slotsOf(
            day({
              calendarDay: { openTime: '11:00:00', closeTime: '16:00:00' },
            }),
          ),
        ),
      ).toEqual(['11:00', '13:00', '13:30', '14:00', '14:30', '15:00'])
    })

    it('has no slot on a day of the week the salon has no hours for', () => {
      expect(
        slotsOf(
          day({
            salon: {
              isActive: true,
              timezone: 'Asia/Tokyo',
              businessHours: [weeklyHours({ dayOfWeek: 'tuesday' })],
            },
          }),
        ),
      ).toEqual({ type: 'slots', slots: [] })
    })

    it('has no slot during the breaks of the salon', () => {
      expect(
        startsOf(
          slotsOf(
            day({
              salon: {
                isActive: true,
                timezone: 'Asia/Tokyo',
                businessHours: [
                  weeklyHours({
                    breakSlots: [{ startTime: '14:00', endTime: '16:00' }],
                  }),
                ],
              },
            }),
          ),
        ),
      ).toEqual(['10:00', '10:30', '11:00', '13:00', '16:00', '16:30', '17:00'])
    })

    it('has no slot for a staff member without a row of the schedule for the day', () => {
      expect(slotsOf(day({ staff: [staffOfDay({ schedules: [] })] }))).toEqual({
        type: 'slots',
        slots: [],
      })
      expect(
        slotsOf(
          day({
            staff: [
              staffOfDay({
                schedules: [dbStaffSchedule({ dayOfWeek: 'tuesday' })],
              }),
            ],
          }),
        ),
      ).toEqual({ type: 'slots', slots: [] })
    })

    it('has no slot for a staff member whose row for the date is a day off, although they work on that day of the week', () => {
      expect(
        slotsOf(
          day({
            staff: [
              staffOfDay({
                schedules: [
                  dbStaffSchedule(),
                  dbStaffSchedule({
                    id: 'day-off',
                    ...dayOffEntry({ date: DATE }),
                  }),
                ],
              }),
            ],
          }),
        ),
      ).toEqual({ type: 'slots', slots: [] })
    })

    it('reads the row of the date before the weekly row of its day of the week', () => {
      expect(
        startsOf(
          slotsOf(
            day({
              staff: [
                staffOfDay({
                  schedules: [
                    dbStaffSchedule(),
                    dbStaffSchedule({
                      id: 'single',
                      ...singleDayEntry({ date: DATE }),
                    }),
                  ],
                }),
              ],
            }),
          ),
        ),
      ).toEqual([
        ...['10:00', '10:30', '11:00', '11:30', '12:00'],
        ...['12:30', '13:00', '13:30', '14:00'],
      ])
    })

    it('has no slot when no stretch is as long as the treatment', () => {
      expect(
        slotsOf(
          day({
            calendarDay: { openTime: '11:30:00', closeTime: '13:45:00' },
          }),
        ),
      ).toEqual({ type: 'slots', slots: [] })
    })
  })

  describe('several staff members', () => {
    const second = (overrides: Partial<StaffOfDay> = {}) =>
      staffOfDay({
        id: OTHER_STAFF_MEMBER_ID,
        schedules: [
          dbStaffSchedule({
            id: 'second',
            staffId: OTHER_STAFF_MEMBER_ID,
            ...singleDayEntry({
              date: DATE,
              startTime: '10:30:00',
              endTime: '12:30:00',
            }),
          }),
        ],
        ...overrides,
      })

    it('lists the slots by when they begin and then by the ID of the staff member, in whatever order the staff come', () => {
      const result = slotsOf(day({ staff: [second(), staffOfDay()] }))

      expect(written(result).slice(0, 7)).toEqual([
        '2026-11-16T01:00:00.000Z - 2026-11-16T02:00:00.000Z 01',
        '2026-11-16T01:30:00.000Z - 2026-11-16T02:30:00.000Z 01',
        '2026-11-16T01:30:00.000Z - 2026-11-16T02:30:00.000Z 02',
        '2026-11-16T02:00:00.000Z - 2026-11-16T03:00:00.000Z 01',
        '2026-11-16T02:00:00.000Z - 2026-11-16T03:00:00.000Z 02',
        '2026-11-16T02:30:00.000Z - 2026-11-16T03:30:00.000Z 02',
        '2026-11-16T04:00:00.000Z - 2026-11-16T05:00:00.000Z 01',
      ])
      expect(
        written(slotsOf(day({ staff: [staffOfDay(), second()] }))),
      ).toEqual(written(result))
    })

    it('works the slots of each staff member out from their own schedule and their own bookings', () => {
      const result = slotsOf(
        day({
          staff: [
            staffOfDay({ taken: [taken(BOOKING_ID, '10:00', '12:00')] }),
            second({ taken: [taken(OTHER_BOOKING_ID, '13:00', '18:00')] }),
          ],
        }),
      )

      expect(startsOf(result).slice(0, 2)).toEqual(['13:00', '13:30'])
      expect(startsOf(result, OTHER_STAFF_MEMBER_ID)).toEqual([
        '10:30',
        '11:00',
        '11:30',
      ])
    })

    const unfit: [string, Partial<StaffOfDay>][] = [
      ['is not active', { isActive: false }],
      ['does not take bookings', { canReceiveBookings: false }],
      ['is of a level below the one the service asks for', { level: 'junior' }],
    ]
    it.each(unfit)(
      'has no slot for a staff member who %s, and the slots of the others',
      (_what, overrides) => {
        const result = slotsOf(
          day({
            service: serviceOfSlots({ requiredStaffLevel: 'stylist' }),
            staff: [staffOfDay(overrides), second()],
          }),
        )

        expect(startsOf(result)).toEqual([])
        expect(startsOf(result, OTHER_STAFF_MEMBER_ID)).toEqual([
          '10:30',
          '11:00',
          '11:30',
        ])
      },
    )

    it('has no slot without staff', () => {
      expect(slotsOf(day({ staff: [] }))).toEqual({ type: 'slots', slots: [] })
    })
  })

  describe('what the salon and the service take', () => {
    const none = { type: 'slots', slots: [] }

    it('has no slot in a salon that is not active', () => {
      expect(
        slotsOf(
          day({
            salon: {
              isActive: false,
              timezone: 'Asia/Tokyo',
              businessHours: [weeklyHours()],
            },
          }),
        ),
      ).toEqual(none)
    })

    it.each([
      ['is not active', serviceOfSlots({ isActive: false })],
      ['is not offered now', serviceOfSlots({ serviceStatus: 'inactive' })],
      ['is not booked online', serviceOfSlots({ allowOnlineBooking: false })],
      [
        'is offered at weekends only, on a Monday',
        serviceOfSlots({ availability: 'weekends_only' }),
      ],
    ])('has no slot for a service that %s', (_what, service) => {
      expect(slotsOf(day({ service }))).toEqual(none)
    })

    it('has the slots of a Monday for a service that is offered on weekdays only', () => {
      expect(
        startsOf(
          slotsOf(
            day({ service: serviceOfSlots({ availability: 'weekdays_only' }) }),
          ),
        ),
      ).toEqual(STARTS_OF_DAY)
    })

    describe('a service that has to be booked in advance', () => {
      const service = serviceOfSlots({
        bookingRequirements: ['advance_booking_required'],
      })

      it('has slots on the day before the date', () => {
        expect(startsOf(slotsOf(day({ service })))).toEqual(STARTS_OF_DAY)
      })

      it('has slots in the last minute of the day before, as the clocks of the salon show it', () => {
        // 23:59 on 2026-11-15 in Tokyo, which is 14:59 in UTC.
        expect(
          startsOf(slotsOf(day({ service, now: jst('23:59', '2026-11-15') }))),
        ).toEqual(STARTS_OF_DAY)
      })

      it('has no slot from the first moment of the date, as the clocks of the salon show it', () => {
        // 00:00 on 2026-11-16 in Tokyo is still 2026-11-15 in UTC.
        expect(slotsOf(day({ service, now: jst('00:00') }))).toEqual(none)
        expect(slotsOf(day({ service, now: jst('09:00') }))).toEqual(none)
      })

      it('has the slots of the date itself without the requirement', () => {
        expect(startsOf(slotsOf(day({ now: jst('09:00') })))).toEqual(
          STARTS_OF_DAY,
        )
      })
    })

    describe('a service that is booked so many times a day at most', () => {
      const service = serviceOfSlots({ maxBookingsPerDay: 2 })

      it('has slots while fewer lines of the service begin on the date', () => {
        expect(
          startsOf(
            slotsOf(day({ service, serviceLineStarts: [jst('10:00')] })),
          ),
        ).toEqual(STARTS_OF_DAY)
      })

      it('has no slot once as many lines of the service begin on the date', () => {
        expect(
          slotsOf(
            day({
              service,
              serviceLineStarts: [jst('10:00'), jst('18:30')],
            }),
          ),
        ).toEqual(none)
        expect(
          slotsOf(
            day({
              service,
              serviceLineStarts: [jst('10:00'), jst('10:00'), jst('15:00')],
            }),
          ),
        ).toEqual(none)
      })

      it('counts a line that begins at the first moment of the date and not one at the first moment of the next', () => {
        expect(
          slotsOf(
            day({
              service,
              serviceLineStarts: [jst('00:00'), jst('23:59')],
            }),
          ),
        ).toEqual(none)
        expect(
          startsOf(
            slotsOf(
              day({
                service,
                serviceLineStarts: [
                  jst('23:59', '2026-11-15'),
                  jst('10:00'),
                  jst('00:00', '2026-11-17'),
                ],
              }),
            ),
          ),
        ).toEqual(STARTS_OF_DAY)
      })

      it('does not count the lines for a service without such a number', () => {
        expect(
          startsOf(
            slotsOf(
              day({
                serviceLineStarts: [jst('10:00'), jst('11:00'), jst('12:00')],
              }),
            ),
          ),
        ).toEqual(STARTS_OF_DAY)
      })
    })
  })

  describe('the present moment', () => {
    it('leaves out the slots that have begun and the one that begins now', () => {
      expect(startsOf(slotsOf(day({ now: jst('14:00') })))).toEqual([
        '14:30',
        '15:00',
        '15:30',
        '16:00',
        '16:30',
        '17:00',
      ])
    })

    it('keeps the slot that begins a moment after now', () => {
      expect(
        startsOf(
          slotsOf(day({ now: new Date(jst('14:00').getTime() - 1) })),
        ).at(0),
      ).toBe('14:00')
    })

    it('has no slot on a date that has passed', () => {
      expect(slotsOf(day({ now: jst('17:00') }))).toEqual({
        type: 'slots',
        slots: [],
      })
      expect(slotsOf(day({ now: jst('09:00', '2026-12-01') }))).toEqual({
        type: 'slots',
        slots: [],
      })
    })
  })

  describe('the bookings of the staff member', () => {
    it('leaves out the slots during which another booking occupies the staff member', () => {
      expect(
        startsOf(
          slotsOf(
            day({
              staff: [
                staffOfDay({ taken: [taken(BOOKING_ID, '14:00', '15:00')] }),
              ],
            }),
          ),
        ),
      ).toEqual([
        ...['10:00', '10:30', '11:00', '13:00'],
        ...['15:00', '15:30', '16:00', '16:30', '17:00'],
      ])
    })

    it('leaves out the slots within the time the staff member keeps free around a booking and around the slot', () => {
      expect(
        startsOf(
          slotsOf(
            day({
              staff: [
                staffOfDay({
                  bufferTimeBefore: 10,
                  bufferTimeAfter: 20,
                  taken: [taken(BOOKING_ID, '14:00', '15:00')],
                }),
              ],
            }),
          ),
        ),
      ).toEqual(['10:00', '10:30', '11:00', '15:30', '16:00', '16:30', '17:00'])
    })

    it('keeps a slot that is exactly the kept time away from a booking', () => {
      // The booking ends at 14:30 and keeps 20 minutes; the slot at 15:00
      // keeps 10 minutes before it.
      expect(
        startsOf(
          slotsOf(
            day({
              staff: [
                staffOfDay({
                  bufferTimeBefore: 10,
                  bufferTimeAfter: 20,
                  taken: [taken(BOOKING_ID, '13:30', '14:30')],
                }),
              ],
            }),
          ),
        ),
      ).toEqual([
        '10:00',
        '10:30',
        '11:00',
        '15:00',
        '15:30',
        '16:00',
        '16:30',
        '17:00',
      ])
    })

    it('keeps the slots beside one booking for a staff member who takes two at once', () => {
      expect(
        startsOf(
          slotsOf(
            day({
              staff: [
                staffOfDay({
                  maxConcurrentBookings: 2,
                  taken: [taken(BOOKING_ID, '14:00', '15:00')],
                }),
              ],
            }),
          ),
        ),
      ).toEqual(STARTS_OF_DAY)
    })

    it('leaves out the slots beside two bookings for a staff member who takes two at once', () => {
      expect(
        startsOf(
          slotsOf(
            day({
              staff: [
                staffOfDay({
                  maxConcurrentBookings: 2,
                  taken: [
                    taken(BOOKING_ID, '14:00', '15:00'),
                    taken(OTHER_BOOKING_ID, '14:30', '16:00'),
                  ],
                }),
              ],
            }),
          ),
        ),
      ).toEqual([
        ...['10:00', '10:30', '11:00', '13:00', '13:30'],
        ...['15:00', '15:30', '16:00', '16:30', '17:00'],
      ])
    })

    it('reads a booking of the day before that reaches into the day', () => {
      expect(
        startsOf(
          slotsOf(
            day({
              staff: [
                staffOfDay({
                  taken: [
                    {
                      bookingId: BOOKING_ID,
                      startTime: jst('22:00', '2026-11-15'),
                      endTime: jst('10:30'),
                    },
                  ],
                }),
              ],
            }),
          ),
        ).slice(0, 2),
      ).toEqual(['10:30', '11:00'])
    })
  })

  describe('the time zone of the salon', () => {
    it('cannot tell the slots of a salon whose time zone the runtime does not know', () => {
      expect(
        slotsOf(
          day({
            salon: {
              isActive: true,
              timezone: 'Mars/Olympus',
              businessHours: [weeklyHours()],
            },
          }),
        ),
      ).toEqual({ type: 'timeZoneUnknown' })
    })

    it('says so before it looks at what the salon takes', () => {
      expect(
        slotsOf(
          day({
            salon: {
              isActive: false,
              timezone: 'Mars/Olympus',
              businessHours: null,
            },
            service: serviceOfSlots({ isActive: false }),
            staff: [],
          }),
        ),
      ).toEqual({ type: 'timeZoneUnknown' })
    })

    /** A Sunday night in New York: the salon and the staff member from 00:00 to 06:00. */
    const nightOf = (date: string): DayOfSlots =>
      day({
        date,
        now: new Date('2026-01-01T00:00:00.000Z'),
        salon: {
          isActive: true,
          timezone: 'America/New_York',
          businessHours: [
            weeklyHours({
              dayOfWeek: 'sunday',
              operatingSlots: [{ startTime: '00:00', endTime: '06:00' }],
            }),
          ],
        },
        staff: [
          staffOfDay({
            schedules: [
              dbStaffSchedule(
                singleDayEntry({
                  date,
                  startTime: '00:00:00',
                  endTime: '06:00:00',
                }),
              ),
            ],
          }),
        ],
      })

    it('has the slots of an ordinary night every half hour of the six hours', () => {
      const slots = written(slotsOf(nightOf('2026-07-12')))

      expect(slots).toHaveLength(11)
      expect(slots.at(0)).toBe(
        '2026-07-12T04:00:00.000Z - 2026-07-12T05:00:00.000Z 01',
      )
      expect(slots.at(-1)).toBe(
        '2026-07-12T09:00:00.000Z - 2026-07-12T10:00:00.000Z 01',
      )
    })

    // On 2026-03-08 the clocks go from 02:00 to 03:00: the night has five hours.
    it('has an hour of slots less on the night the clocks are put forward, and every slot lasts as long as the treatment', () => {
      expect(written(slotsOf(nightOf('2026-03-08')))).toEqual([
        '2026-03-08T05:00:00.000Z - 2026-03-08T06:00:00.000Z 01',
        '2026-03-08T05:30:00.000Z - 2026-03-08T06:30:00.000Z 01',
        '2026-03-08T06:00:00.000Z - 2026-03-08T07:00:00.000Z 01',
        '2026-03-08T06:30:00.000Z - 2026-03-08T07:30:00.000Z 01',
        '2026-03-08T07:00:00.000Z - 2026-03-08T08:00:00.000Z 01',
        '2026-03-08T07:30:00.000Z - 2026-03-08T08:30:00.000Z 01',
        '2026-03-08T08:00:00.000Z - 2026-03-08T09:00:00.000Z 01',
        '2026-03-08T08:30:00.000Z - 2026-03-08T09:30:00.000Z 01',
        '2026-03-08T09:00:00.000Z - 2026-03-08T10:00:00.000Z 01',
      ])
    })

    // On 2026-11-01 the clocks go from 02:00 back to 01:00: the night has seven hours.
    it('has an hour of slots more on the night the clocks are put back', () => {
      const slots = written(slotsOf(nightOf('2026-11-01')))

      expect(slots).toHaveLength(13)
      expect(slots.at(0)).toBe(
        '2026-11-01T04:00:00.000Z - 2026-11-01T05:00:00.000Z 01',
      )
      expect(slots.at(-1)).toBe(
        '2026-11-01T10:00:00.000Z - 2026-11-01T11:00:00.000Z 01',
      )
    })

    it('counts the lines of a service on the date as the clocks of the salon show it', () => {
      const night = nightOf('2026-07-12')
      const service = serviceOfSlots({ maxBookingsPerDay: 1 })

      // 2026-07-12 in New York is from 04:00 in UTC to 04:00 on the next day.
      expect(
        written(
          slotsOf({
            ...night,
            service,
            serviceLineStarts: [new Date('2026-07-12T03:59:00.000Z')],
          }),
        ),
      ).toHaveLength(11)
      expect(
        slotsOf({
          ...night,
          service,
          serviceLineStarts: [new Date('2026-07-12T04:00:00.000Z')],
        }),
      ).toEqual({ type: 'slots', slots: [] })
    })
  })
})
