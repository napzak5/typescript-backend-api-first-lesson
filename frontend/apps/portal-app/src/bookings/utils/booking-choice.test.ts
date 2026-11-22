import type {
  ModelsStaffLevelType,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { staff } from '../../salons/components/examples'
import {
  choiceIn,
  dayAfter,
  dayBefore,
  isBookable,
  queryOf,
  staffFor,
  timesOf,
} from './booking-choice'

const TODAY = '2026-11-19'

const BOOKABLE: Parameters<typeof isBookable>[1] = {
  isActive: true,
  serviceStatus: 'active',
  allowOnlineBooking: true,
}

const LEVELS: ModelsStaffLevelType[] = [
  'junior',
  'stylist',
  'senior',
  'expert',
  'director',
]

/** A member of the staff who takes bookings, of each level, named after it. */
const OF_EVERY_LEVEL: ModelsStaffProfileResponse[] = staff
  .slice(0, 1)
  .flatMap((example) =>
    LEVELS.map((level, index) => ({
      ...example,
      id: `00000000-0000-4000-8000-00000000000${index}`,
      displayName: `${index} ${level}`,
      level,
      canReceiveBookings: true,
    })),
  )

/** The levels that may give a service, for the level the service asks for. */
const LEVELS_FOR: [ModelsStaffLevelType, ModelsStaffLevelType[]][] = [
  ['junior', LEVELS],
  ['stylist', ['stylist', 'senior', 'expert', 'director']],
  ['senior', ['senior', 'expert', 'director']],
  ['expert', ['expert', 'director']],
  ['director', ['director']],
]

const NOT_BOOKABLE: [
  string,
  Parameters<typeof isBookable>[0],
  Parameters<typeof isBookable>[1],
][] = [
  ['the salon takes no bookings', { isActive: false }, BOOKABLE],
  [
    'the service is switched off',
    { isActive: true },
    { ...BOOKABLE, isActive: false },
  ],
  [
    'the service is not booked online',
    { isActive: true },
    { ...BOOKABLE, allowOnlineBooking: false },
  ],
  [
    'the service is not on offer yet',
    { isActive: true },
    { ...BOOKABLE, serviceStatus: 'coming_soon' },
  ],
  [
    'the service is on offer no longer',
    { isActive: true },
    { ...BOOKABLE, serviceStatus: 'discontinued' },
  ],
  [
    'the service is not on offer for now',
    { isActive: true },
    { ...BOOKABLE, serviceStatus: 'inactive' },
  ],
]

const levelsFor = (
  requiredStaffLevel: ModelsStaffLevelType | null,
): ModelsStaffLevelType[] =>
  staffFor({ requiredStaffLevel }, OF_EVERY_LEVEL).map(({ level }) => level)

const FIRST = '6f81a3c4-e075-429b-93bd-5f7193acc0ce'
const SECOND = '7092b4d5-f186-43ac-a4ce-60829bbdd1df'

const KNOWN = [{ id: FIRST }, { id: SECOND }]

const slot = (staffId: string, startTime: string) => ({
  staffId,
  startTime,
  endTime: new Date(Date.parse(startTime) + 60 * 60 * 1000).toISOString(),
})

describe('isBookable', () => {
  it('should be so for a service that is on offer online at a salon that takes bookings', () => {
    expect(isBookable({ isActive: true }, BOOKABLE)).toBe(true)
  })

  it.each(NOT_BOOKABLE)('should not be so when %s', (_case, salon, service) => {
    expect(isBookable(salon, service)).toBe(false)
  })
})

describe('staffFor', () => {
  it('should be everybody who takes bookings for a service that asks for no level', () => {
    expect(levelsFor(null)).toEqual(LEVELS)
  })

  it.each(LEVELS_FOR)(
    'should be those of the level %s and above for a service that asks for it',
    (required, levels) => {
      expect(levelsFor(required)).toEqual(levels)
    },
  )

  it('should leave out a member of the staff who takes no bookings, whatever their level', () => {
    expect(
      staffFor({ requiredStaffLevel: null }, staff).map(
        ({ displayName }) => displayName,
      ),
    ).toEqual(['田中 ひろし', '鈴木 みか'])
  })

  it('should be in the order of the names, whatever order the API lists them in', () => {
    expect(
      staffFor(
        { requiredStaffLevel: null },
        OF_EVERY_LEVEL.slice(0, 3).toReversed(),
      ).map(({ displayName }) => displayName),
    ).toEqual(['0 junior', '1 stylist', '2 senior'])
  })

  it('should leave the list it was given as it is', () => {
    const given = OF_EVERY_LEVEL.toReversed()
    const before = given.map(({ id }) => id)

    staffFor({ requiredStaffLevel: null }, given)

    expect(given.map(({ id }) => id)).toEqual(before)
  })

  it('should be nobody for a salon without staff', () => {
    expect(staffFor({ requiredStaffLevel: null }, [])).toEqual([])
  })
})

describe('dayAfter', () => {
  it.each([
    ['2026-11-19', '2026-11-20'],
    ['2026-11-30', '2026-12-01'],
    ['2026-12-31', '2027-01-01'],
    ['2028-02-28', '2028-02-29'],
    ['2027-02-28', '2027-03-01'],
  ])(
    'should be the next day of the calendar: after %s comes %s',
    (date, next) => {
      expect(dayAfter(date)).toBe(next)
    },
  )
})

describe('dayBefore', () => {
  it.each([
    ['2026-11-21', '2026-11-20'],
    ['2026-12-01', '2026-11-30'],
    ['2027-01-01', '2026-12-31'],
  ])(
    'should be the day before of the calendar: before %s comes %s',
    (date, before) => {
      expect(dayBefore(date, TODAY)).toBe(before)
    },
  )

  it('should be today for tomorrow', () => {
    expect(dayBefore('2026-11-20', TODAY)).toBe(TODAY)
  })

  it.each([TODAY, '2026-11-01'])(
    'should be today, and no day that has passed, for %s',
    (date) => {
      expect(dayBefore(date, TODAY)).toBe(TODAY)
    },
  )
})

describe('choiceIn', () => {
  const read = (query: string) =>
    choiceIn(new URLSearchParams(query), TODAY, KNOWN)

  it('should read the member of the staff and the day of an address', () => {
    expect(read(`staffId=${SECOND}&date=2026-11-24`)).toEqual({
      staffId: SECOND,
      date: '2026-11-24',
    })
  })

  it('should be nobody in particular, today, for an address that says nothing', () => {
    expect(read('')).toEqual({ staffId: undefined, date: TODAY })
  })

  it('should take today itself as a day', () => {
    expect(read(`date=${TODAY}`)).toEqual({ staffId: undefined, date: TODAY })
  })

  it.each([
    ['a day that has passed', 'date=2026-11-18'],
    ['a day long ago', 'date=1999-12-31'],
    ['a word', 'date=tomorrow'],
    ['a day no calendar has', 'date=2026-02-30'],
    ['a month no calendar has', 'date=2026-13-01'],
    ['a day with its time', 'date=2026-11-24T10:00:00Z'],
    ['a day written another way', 'date=2026/11/24'],
    ['nothing', 'date='],
  ])('should be today for %s', (_case, query) => {
    expect(read(query).date).toBe(TODAY)
  })

  it.each([
    [
      'somebody who cannot be asked for',
      '81a3c5e6-0297-44bd-b5df-7193acce02e0',
    ],
    ['a word', 'anybody'],
    ['nothing', ''],
  ])('should be nobody in particular for %s', (_case, staffId) => {
    expect(read(`staffId=${staffId}&date=2026-11-24`)).toEqual({
      staffId: undefined,
      date: '2026-11-24',
    })
  })

  it('should read the first of a parameter that is given twice, and nothing of what it does not know', () => {
    expect(
      read(`date=2026-11-24&date=2026-11-25&staffId=${FIRST}&time=10:00`),
    ).toEqual({ staffId: FIRST, date: '2026-11-24' })
  })
})

describe('queryOf', () => {
  it('should write the member of the staff and the day, in one order', () => {
    expect(queryOf({ date: '2026-11-24', staffId: SECOND })).toBe(
      `staffId=${SECOND}&date=2026-11-24`,
    )
  })

  it('should write the day alone for nobody in particular', () => {
    expect(queryOf({ staffId: undefined, date: '2026-11-24' })).toBe(
      'date=2026-11-24',
    )
  })

  it('should write what `choiceIn` reads back', () => {
    const choice = { staffId: FIRST, date: '2026-12-01' }

    expect(
      choiceIn(new URLSearchParams(queryOf(choice)), TODAY, KNOWN),
    ).toEqual(choice)
  })
})

describe('timesOf', () => {
  it('should list a time once, with everybody who is free then, in the order of the API', () => {
    expect(
      timesOf(
        [
          slot(FIRST, '2026-11-24T01:00:00.000Z'),
          slot(SECOND, '2026-11-24T01:00:00.000Z'),
          slot(SECOND, '2026-11-24T01:30:00.000Z'),
        ],
        'Asia/Tokyo',
      ),
    ).toEqual([
      {
        startTime: '2026-11-24T01:00:00.000Z',
        label: '10:00',
        staffIds: [FIRST, SECOND],
      },
      {
        startTime: '2026-11-24T01:30:00.000Z',
        label: '10:30',
        staffIds: [SECOND],
      },
    ])
  })

  it('should put the earliest time first, whatever order the slots come in', () => {
    expect(
      timesOf(
        [
          slot(FIRST, '2026-11-24T03:00:00.000Z'),
          slot(FIRST, '2026-11-24T00:30:00.000Z'),
          slot(SECOND, '2026-11-24T03:00:00.000Z'),
          slot(FIRST, '2026-11-24T01:00:00.000Z'),
        ],
        'Asia/Tokyo',
      ).map(({ label }) => label),
    ).toEqual(['09:30', '10:00', '12:00'])
  })

  it.each([
    ['Asia/Tokyo', '10:00'],
    ['Europe/Paris', '02:00'],
    ['America/New_York', '20:00'],
    ['UTC', '01:00'],
  ])('should say the time of day at a salon in %s', (timezone, label) => {
    expect(
      timesOf([slot(FIRST, '2026-11-24T01:00:00.000Z')], timezone),
    ).toMatchObject([{ label }])
  })

  it('should write midnight as 00:00', () => {
    expect(
      timesOf([slot(FIRST, '2026-11-24T15:00:00.000Z')], 'Asia/Tokyo'),
    ).toMatchObject([{ label: '00:00' }])
  })

  it('should be no time for a day without a slot', () => {
    expect(timesOf([], 'Asia/Tokyo')).toEqual([])
  })
})
