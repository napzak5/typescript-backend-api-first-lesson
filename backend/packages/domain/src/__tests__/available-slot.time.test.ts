import { describe, expect, it } from 'vitest'
import {
  dateIn,
  dayIn,
  momentAt,
  widestDayOf,
} from '../business-logic/available-slot/_shared/salon-time'
import {
  joined,
  overlapOf,
  type TimeRange,
  without,
} from '../business-logic/available-slot/_shared/time-ranges'

const at = (time: string): Date => new Date(`2026-11-16T${time}:00.000Z`)

const range = (from: string, until: string): TimeRange => ({
  from: at(from),
  until: at(until),
})

/** A range as text, which tells a plain date (`…Z`) from one of a time zone. */
const written = (ranges: readonly TimeRange[] | null): string[] =>
  (ranges ?? []).map(
    ({ from, until }) => `${from.toISOString()} - ${until.toISOString()}`,
  )

/** A day as text; null when there is none. */
const writtenDay = (day: TimeRange | null): string | null =>
  day === null ? null : `${day.from.toISOString()} - ${day.until.toISOString()}`

describe('joined', () => {
  it('returns nothing for nothing', () => {
    expect(joined([])).toEqual([])
  })

  it('puts the ranges in the order in which they begin', () => {
    expect(
      joined([
        range('13:00', '14:00'),
        range('09:00', '10:00'),
        range('11:00', '12:00'),
      ]),
    ).toEqual([
      range('09:00', '10:00'),
      range('11:00', '12:00'),
      range('13:00', '14:00'),
    ])
  })

  it('makes two ranges that overlap into one', () => {
    expect(joined([range('09:00', '11:00'), range('10:00', '12:00')])).toEqual([
      range('09:00', '12:00'),
    ])
  })

  it('makes two ranges into one where the one ends as the other begins', () => {
    expect(joined([range('10:00', '11:00'), range('09:00', '10:00')])).toEqual([
      range('09:00', '11:00'),
    ])
  })

  it('keeps the end of a range that another lies within', () => {
    expect(joined([range('09:00', '12:00'), range('10:00', '11:00')])).toEqual([
      range('09:00', '12:00'),
    ])
  })

  it('joins a chain of ranges of which each meets the next', () => {
    expect(
      joined([
        range('09:00', '10:00'),
        range('11:00', '12:30'),
        range('10:00', '11:00'),
        range('14:00', '15:00'),
      ]),
    ).toEqual([range('09:00', '12:30'), range('14:00', '15:00')])
  })

  it('keeps ranges apart that a minute lies between', () => {
    expect(joined([range('09:00', '10:00'), range('10:01', '11:00')])).toEqual([
      range('09:00', '10:00'),
      range('10:01', '11:00'),
    ])
  })

  it('leaves out a range that ends where it begins, or before', () => {
    expect(
      joined([
        range('10:00', '10:00'),
        range('12:00', '11:00'),
        range('09:00', '09:30'),
      ]),
    ).toEqual([range('09:00', '09:30')])
  })

  it('does not change the list it is given', () => {
    const ranges = [range('13:00', '14:00'), range('09:00', '13:00')]

    joined(ranges)

    expect(ranges).toEqual([range('13:00', '14:00'), range('09:00', '13:00')])
  })
})

describe('overlapOf', () => {
  it('returns the time that is in a range of both lists', () => {
    expect(
      overlapOf(
        [range('09:00', '12:00'), range('13:00', '18:00')],
        [range('10:00', '14:00')],
      ),
    ).toEqual([range('10:00', '12:00'), range('13:00', '14:00')])
  })

  it('returns a range that lies within another as it is', () => {
    expect(
      overlapOf([range('09:00', '18:00')], [range('10:00', '11:00')]),
    ).toEqual([range('10:00', '11:00')])
    expect(
      overlapOf([range('10:00', '11:00')], [range('09:00', '18:00')]),
    ).toEqual([range('10:00', '11:00')])
  })

  it('returns nothing for ranges that only touch', () => {
    expect(
      overlapOf([range('09:00', '10:00')], [range('10:00', '11:00')]),
    ).toEqual([])
  })

  it('returns nothing for ranges that do not meet', () => {
    expect(
      overlapOf([range('09:00', '10:00')], [range('11:00', '12:00')]),
    ).toEqual([])
  })

  it('returns nothing when either list is empty', () => {
    expect(overlapOf([], [range('09:00', '10:00')])).toEqual([])
    expect(overlapOf([range('09:00', '10:00')], [])).toEqual([])
  })

  it('joins what the ranges of a list share with the same range of the other', () => {
    expect(
      overlapOf(
        [range('09:00', '18:00')],
        [range('10:00', '12:00'), range('11:00', '13:00')],
      ),
    ).toEqual([range('10:00', '13:00')])
  })
})

describe('without', () => {
  it('takes time out of the middle of a range, which leaves two', () => {
    expect(
      without([range('09:00', '18:00')], [range('12:00', '13:00')]),
    ).toEqual([range('09:00', '12:00'), range('13:00', '18:00')])
  })

  it('takes time off the beginning of a range', () => {
    expect(
      without([range('09:00', '18:00')], [range('08:00', '10:00')]),
    ).toEqual([range('10:00', '18:00')])
    expect(
      without([range('09:00', '18:00')], [range('09:00', '10:00')]),
    ).toEqual([range('10:00', '18:00')])
  })

  it('takes time off the end of a range', () => {
    expect(
      without([range('09:00', '18:00')], [range('17:00', '19:00')]),
    ).toEqual([range('09:00', '17:00')])
    expect(
      without([range('09:00', '18:00')], [range('17:00', '18:00')]),
    ).toEqual([range('09:00', '17:00')])
  })

  it('leaves nothing of a range that is removed as a whole', () => {
    expect(
      without([range('09:00', '18:00')], [range('09:00', '18:00')]),
    ).toEqual([])
    expect(
      without([range('09:00', '18:00')], [range('08:00', '19:00')]),
    ).toEqual([])
  })

  it('leaves a range as it is that the removed time does not meet', () => {
    expect(
      without([range('09:00', '12:00')], [range('12:00', '13:00')]),
    ).toEqual([range('09:00', '12:00')])
    expect(
      without([range('09:00', '12:00')], [range('07:00', '09:00')]),
    ).toEqual([range('09:00', '12:00')])
  })

  it('takes out every removed range', () => {
    expect(
      without(
        [range('09:00', '18:00')],
        [range('15:00', '16:00'), range('10:00', '11:00')],
      ),
    ).toEqual([
      range('09:00', '10:00'),
      range('11:00', '15:00'),
      range('16:00', '18:00'),
    ])
  })

  it('takes removed ranges that touch out as one', () => {
    expect(
      without(
        [range('09:00', '18:00')],
        [range('10:00', '11:00'), range('11:00', '12:00')],
      ),
    ).toEqual([range('09:00', '10:00'), range('12:00', '18:00')])
  })

  it('takes a removed range out of every range it meets', () => {
    expect(
      without(
        [range('09:00', '12:00'), range('13:00', '18:00')],
        [range('11:00', '14:00')],
      ),
    ).toEqual([range('09:00', '11:00'), range('14:00', '18:00')])
  })

  it('returns the ranges joined when nothing is removed', () => {
    expect(
      without([range('10:00', '11:00'), range('09:00', '10:00')], []),
    ).toEqual([range('09:00', '11:00')])
  })

  it('ignores a removed range that is no time at all', () => {
    expect(
      without([range('09:00', '18:00')], [range('12:00', '12:00')]),
    ).toEqual([range('09:00', '18:00')])
  })
})

describe('momentAt', () => {
  it('returns the moment at which the clocks of the time zone show the time on the date', () => {
    expect(momentAt('2026-11-16', '10:00', 'Asia/Tokyo').toISOString()).toBe(
      '2026-11-16T01:00:00.000Z',
    )
    expect(momentAt('2026-11-16', '00:00', 'Asia/Tokyo').toISOString()).toBe(
      '2026-11-15T15:00:00.000Z',
    )
    expect(momentAt('2026-11-16', '23:59', 'Asia/Tokyo').toISOString()).toBe(
      '2026-11-16T14:59:00.000Z',
    )
  })

  it('reads a time with seconds, as a `time` column has it', () => {
    expect(momentAt('2026-11-16', '10:00:30', 'Asia/Tokyo').toISOString()).toBe(
      '2026-11-16T01:00:30.000Z',
    )
  })

  it('follows the season of a time zone that has summer time', () => {
    expect(
      momentAt('2026-01-15', '09:00', 'America/New_York').toISOString(),
    ).toBe('2026-01-15T14:00:00.000Z')
    expect(
      momentAt('2026-07-15', '09:00', 'America/New_York').toISOString(),
    ).toBe('2026-07-15T13:00:00.000Z')
  })

  // On 2026-03-08 the clocks of New York go from 02:00 to 03:00.
  it('takes a time the clocks skip as the moment that much later', () => {
    expect(
      momentAt('2026-03-08', '01:59', 'America/New_York').toISOString(),
    ).toBe('2026-03-08T06:59:00.000Z')
    expect(
      momentAt('2026-03-08', '02:00', 'America/New_York').toISOString(),
    ).toBe('2026-03-08T07:00:00.000Z')
    expect(
      momentAt('2026-03-08', '02:30', 'America/New_York').toISOString(),
    ).toBe('2026-03-08T07:30:00.000Z')
    expect(
      momentAt('2026-03-08', '03:00', 'America/New_York').toISOString(),
    ).toBe('2026-03-08T07:00:00.000Z')
    expect(
      momentAt('2026-03-08', '03:30', 'America/New_York').toISOString(),
    ).toBe('2026-03-08T07:30:00.000Z')
  })

  // On 2026-11-01 the clocks of New York go from 02:00 back to 01:00.
  it('takes a time the clocks show twice as the first of the two moments', () => {
    expect(
      momentAt('2026-11-01', '00:30', 'America/New_York').toISOString(),
    ).toBe('2026-11-01T04:30:00.000Z')
    expect(
      momentAt('2026-11-01', '01:30', 'America/New_York').toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z')
    expect(
      momentAt('2026-11-01', '02:00', 'America/New_York').toISOString(),
    ).toBe('2026-11-01T07:00:00.000Z')
  })

  it('reads UTC and an offset as time zones', () => {
    expect(momentAt('2026-11-16', '10:00', 'UTC').toISOString()).toBe(
      '2026-11-16T10:00:00.000Z',
    )
    expect(momentAt('2026-11-16', '10:00', '+09:00').toISOString()).toBe(
      '2026-11-16T01:00:00.000Z',
    )
  })

  it.each(['Mars/Olympus', '', 'Tokyo'])(
    'returns an invalid date for the time zone %j, which the runtime does not know',
    (timeZone) => {
      expect(
        Number.isNaN(momentAt('2026-11-16', '10:00', timeZone).getTime()),
      ).toBe(true)
    },
  )
})

describe('dayIn', () => {
  it('returns the date from its first moment to the first moment of the next date', () => {
    expect(writtenDay(dayIn('2026-11-16', 'Asia/Tokyo'))).toBe(
      '2026-11-15T15:00:00.000Z - 2026-11-16T15:00:00.000Z',
    )
    expect(writtenDay(dayIn('2026-11-16', 'UTC'))).toBe(
      '2026-11-16T00:00:00.000Z - 2026-11-17T00:00:00.000Z',
    )
  })

  it('returns a day of 23 hours where the clocks are put forward', () => {
    expect(writtenDay(dayIn('2026-03-08', 'America/New_York'))).toBe(
      '2026-03-08T05:00:00.000Z - 2026-03-09T04:00:00.000Z',
    )
  })

  it('returns a day of 25 hours where the clocks are put back', () => {
    expect(writtenDay(dayIn('2026-11-01', 'America/New_York'))).toBe(
      '2026-11-01T04:00:00.000Z - 2026-11-02T05:00:00.000Z',
    )
  })

  it('goes over the end of a month and of a year', () => {
    expect(writtenDay(dayIn('2026-12-31', 'Asia/Tokyo'))).toBe(
      '2026-12-30T15:00:00.000Z - 2026-12-31T15:00:00.000Z',
    )
    expect(writtenDay(dayIn('2028-02-29', 'UTC'))).toBe(
      '2028-02-29T00:00:00.000Z - 2028-03-01T00:00:00.000Z',
    )
  })

  it.each(['Mars/Olympus', '', 'Tokyo'])(
    'returns null for the time zone %j, which the runtime does not know',
    (timeZone) => {
      expect(dayIn('2026-11-16', timeZone)).toBeNull()
    },
  )
})

describe('dateIn', () => {
  it('returns the date the clocks of the time zone show at the moment', () => {
    expect(dateIn(new Date('2026-11-15T14:59:59.999Z'), 'Asia/Tokyo')).toBe(
      '2026-11-15',
    )
    expect(dateIn(new Date('2026-11-15T15:00:00.000Z'), 'Asia/Tokyo')).toBe(
      '2026-11-16',
    )
  })

  it('returns the date of a time zone behind UTC', () => {
    expect(
      dateIn(new Date('2026-11-16T04:59:59.999Z'), 'America/New_York'),
    ).toBe('2026-11-15')
    expect(
      dateIn(new Date('2026-11-16T05:00:00.000Z'), 'America/New_York'),
    ).toBe('2026-11-16')
  })

  it('returns the date in which a moment lies that `dayIn` gives the date', () => {
    const day = dayIn('2026-03-08', 'America/New_York')

    expect(day === null ? null : dateIn(day.from, 'America/New_York')).toBe(
      '2026-03-08',
    )
    expect(day === null ? null : dateIn(day.until, 'America/New_York')).toBe(
      '2026-03-09',
    )
  })
})

describe('widestDayOf', () => {
  it('returns the time from the first moment of the date in the time zone furthest ahead to its last in the one furthest behind', () => {
    expect(written([widestDayOf('2026-11-16', 0)])).toEqual([
      '2026-11-15T10:00:00.000Z - 2026-11-17T12:00:00.000Z',
    ])
  })

  it('is wider by the minutes around it, before and after', () => {
    expect(written([widestDayOf('2026-11-16', 45)])).toEqual([
      '2026-11-15T09:15:00.000Z - 2026-11-17T12:45:00.000Z',
    ])
  })

  it.each([
    'Pacific/Kiritimati',
    'Asia/Tokyo',
    'UTC',
    'America/New_York',
    'Etc/GMT+12',
  ])('holds the whole date in %s', (timeZone) => {
    const widest = widestDayOf('2026-11-01', 0)
    const day = dayIn('2026-11-01', timeZone)

    expect(day).not.toBeNull()
    expect(
      day !== null && widest.from <= day.from && day.until <= widest.until,
    ).toBe(true)
  })

  it('begins and ends with the date in the time zones furthest from UTC', () => {
    const widest = widestDayOf('2026-11-16', 0)

    expect(dayIn('2026-11-16', 'Pacific/Kiritimati')?.from).toEqual(widest.from)
    expect(dayIn('2026-11-16', 'Etc/GMT+12')?.until).toEqual(widest.until)
  })
})
