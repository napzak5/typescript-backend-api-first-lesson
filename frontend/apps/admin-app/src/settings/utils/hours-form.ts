import {
  CHECK_THE_VALUES_MESSAGE,
  type NotFound,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBusinessHours,
  ModelsDateRange,
  ModelsDayOfWeekType,
  ModelsOpeningHours,
  ModelsSalonUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { isDay, tooLongError, tooLongOf } from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match, P } from 'ts-pattern'
import {
  dateRowsIn,
  NO_BREAK_END,
  NO_BREAK_START,
  WEEKDAYS,
  weekdayOf,
} from '../../shifts/utils/shift-week'
import type { Hours, HoursAttempt } from '../api/hours-api'

/*
 * The form of the hours of a salon: a part for every day of the week, and
 * the rows of the dates of the calendar from today on. The API replaces
 * the week and the calendar whole, so the form sends whichever of them was
 * changed whole, the dates before today among them as they were.
 */

/** What a part of the form chooses: whether the salon is open */
export const OPEN = 'open'
export const CLOSED = 'closed'

/** The longest name of a holiday the API takes */
/** The longest name of a holiday the API takes */
export const LONGEST_HOLIDAY_NAME = 100

const HOLIDAY_NAME_TOO_LONG = tooLongOf(
  '祝日・休業日の名前',
  LONGEST_HOLIDAY_NAME,
)

/** A value of a part or of a row, as a control of the form is named after it */
export type HoursProperty =
  | 'opens'
  | 'openTime'
  | 'closeTime'
  | 'breakStart'
  | 'breakEnd'
  | 'date'
  | 'isHoliday'
  | 'holidayName'
  | 'notes'

/** The name of a control of the part of a day of the week: 「monday.openTime」. */
export const weekdayControlOf = (
  weekday: ModelsDayOfWeekType,
  property: HoursProperty,
): string => `${weekday}.${property}`

/** The name of a control of the row of a date, by the place of the row: 「dates.0.openTime」. */
export const dateControlOf = (index: number, property: HoursProperty): string =>
  `dates.${index}.${property}`

/** A day of the regular week, as the form shows it: the times in 「10:00」. */
export type WeekdayPart = {
  weekday: ModelsDayOfWeekType
  opens: boolean
  openTime: string | undefined
  closeTime: string | undefined
  breakStart: string | undefined
  breakEnd: string | undefined
  /** The day has more hours or more breaks than the form holds: the first of each is what it keeps */
  more: boolean
  /** The days the hours are kept in, sent back as they are */
  effectivePeriod: ModelsDateRange | null
}

/**
 * The regular week of a salon as the form shows it, from Monday: a day
 * without an entry, one that is closed and one without hours are closed.
 */
export const weekPartsOf = (
  businessHours: readonly ModelsBusinessHours[] | null,
): WeekdayPart[] =>
  WEEKDAYS.map((weekday) => {
    const entry = businessHours?.find(({ dayOfWeek }) => dayOfWeek === weekday)
    const [hours] = entry?.operatingSlots ?? []
    const [rest] = entry?.breakSlots ?? []
    const effectivePeriod = entry?.effectivePeriod ?? null
    if (entry === undefined || entry.isClosed || hours === undefined) {
      return {
        weekday,
        opens: false,
        openTime: undefined,
        closeTime: undefined,
        breakStart: undefined,
        breakEnd: undefined,
        more: false,
        effectivePeriod,
      }
    }

    return {
      weekday,
      opens: true,
      openTime: hours.startTime,
      closeTime: hours.endTime,
      breakStart: rest?.startTime,
      breakEnd: rest?.endTime,
      more:
        entry.operatingSlots.length > 1 || (entry.breakSlots ?? []).length > 1,
      effectivePeriod,
    }
  })

const byDate = (one: ModelsOpeningHours, other: ModelsOpeningHours): number =>
  one.date.localeCompare(other.date)

/** The dates of the calendar the form shows, from today on, and those before today that it keeps out of sight. */
export const calendarPartsOf = (
  openingHours: readonly ModelsOpeningHours[],
  today: string,
): { dates: ModelsOpeningHours[]; past: ModelsOpeningHours[] } => ({
  dates: openingHours.filter(({ date }) => date >= today).toSorted(byDate),
  past: openingHours.filter(({ date }) => date < today).toSorted(byDate),
})

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** A time of the week as the API keeps it: 「10:00」; none for no time. */
const minutesOf = (text: string): string | undefined =>
  TIME.test(text) ? text.slice(0, 5) : undefined

/** A time of a date as the API keeps it: 「10:00:00」; none for no time. */
const secondsOf = (text: string): string | undefined =>
  TIME.test(text) ? (text.length === 5 ? `${text}:00` : text) : undefined

/** The hours of a day the form holds, in the form of time the API keeps them in. */
type Times = {
  openTime: string | undefined
  closeTime: string | undefined
}

/** The break of a day of the week the form holds. */
type Rest = {
  breakStart: string | undefined
  breakEnd: string | undefined
}

/** What is said at the times of a day the salon is open on, under the names of their controls. */
const timeEntriesOf = (
  { openTime, closeTime }: Times,
  nameOf: (property: HoursProperty) => string,
): [string, string | undefined][] => [
  [
    nameOf('openTime'),
    openTime === undefined ? '開店の時刻を入力してください。' : undefined,
  ],
  [
    nameOf('closeTime'),
    closeTime === undefined
      ? '閉店の時刻を入力してください。'
      : openTime !== undefined && closeTime <= openTime
        ? '閉店は、開店より後の時刻にしてください。日付をまたぐ営業は入れられません。'
        : undefined,
  ],
]

/** What is said at the break of a day of the week the salon is open on. */
const restEntriesOf = (
  { openTime, closeTime }: Times,
  { breakStart, breakEnd }: Rest,
  nameOf: (property: HoursProperty) => string,
): [string, string | undefined][] => [
  [
    nameOf('breakStart'),
    breakStart === undefined
      ? breakEnd === undefined
        ? undefined
        : NO_BREAK_START
      : openTime !== undefined && breakStart <= openTime
        ? '休憩は、開店より後に始めてください。'
        : undefined,
  ],
  [
    nameOf('breakEnd'),
    breakEnd === undefined
      ? breakStart === undefined
        ? undefined
        : NO_BREAK_END
      : breakStart !== undefined && breakEnd <= breakStart
        ? '休憩の終わりは、休憩の始まりより後の時刻にしてください。'
        : closeTime !== undefined && breakEnd >= closeTime
          ? '休憩は、閉店より前に終えてください。'
          : undefined,
  ],
]

/** The entry of a day of the week as the API takes it. */
const businessHoursOf = (
  weekday: ModelsDayOfWeekType,
  { openTime, closeTime }: Times,
  { breakStart, breakEnd }: Rest,
  opens: boolean,
  effectivePeriod: ModelsDateRange | null,
): ModelsBusinessHours =>
  opens && openTime !== undefined && closeTime !== undefined
    ? {
        dayOfWeek: weekday,
        operatingSlots: [{ startTime: openTime, endTime: closeTime }],
        breakSlots:
          breakStart === undefined || breakEnd === undefined
            ? null
            : [{ startTime: breakStart, endTime: breakEnd }],
        isClosed: false,
        effectivePeriod,
      }
    : {
        dayOfWeek: weekday,
        operatingSlots: [],
        breakSlots: null,
        isClosed: true,
        effectivePeriod,
      }

/** The values of an entry of the week, in one order whatever the order of its properties. */
const weekValuesOf = (entry: ModelsBusinessHours): unknown[] => [
  entry.dayOfWeek,
  entry.operatingSlots.map(({ startTime, endTime }) => [startTime, endTime]),
  entry.breakSlots?.map(({ startTime, endTime }) => [startTime, endTime]) ??
    null,
  entry.isClosed,
  entry.effectivePeriod?.startDate ?? null,
  entry.effectivePeriod?.endDate ?? null,
]

/** The values of a date of the calendar, in one order whatever the order of its properties. */
const dateValuesOf = (entry: ModelsOpeningHours): unknown[] => [
  entry.dayOfWeek,
  entry.date,
  entry.openTime,
  entry.closeTime,
  entry.isHoliday,
  entry.holidayName,
  entry.notes,
]

const sameEntries = <Entry>(
  one: readonly Entry[],
  other: readonly Entry[],
  valuesOf: (entry: Entry) => unknown[],
): boolean =>
  JSON.stringify(one.map(valuesOf)) === JSON.stringify(other.map(valuesOf))

/** What is said at the date of a row: none, when it may be sent. */
const dateErrorOf = (
  date: string,
  earlier: readonly string[],
  today: string,
): string | undefined => {
  if (date === '') {
    return '日付を入力してください。'
  }
  if (!isDay(date)) {
    return '日付は、1900 年 1 月 1 日から 2999 年 12 月 31 日までにしてください。'
  }
  if (date < today) {
    return '今日か、今日より後の日付を入力してください。'
  }
  const same = earlier.indexOf(date)

  return same === -1
    ? undefined
    : `この日付は、${same + 1} 行目と同じです。1 つの日付に入れられるのは 1 行です。`
}

/** What a change of the hours asks for, nothing when nothing was changed, or what is wrong with the form. */
export type HoursChangeRead =
  | { type: 'valid'; value: ModelsSalonUpdateRequest }
  | { type: 'unchanged' }
  | { type: 'invalid'; errors: Record<string, string> }

/**
 * What the form of the hours asks for, against the hours it was opened
 * with (`shown`): the week, whole, when a day of it was changed, and the
 * calendar, whole and in the order of its dates, when a date of it was.
 * A day of the week the form sends back unchanged is the day as the form
 * shows it: one with more hours than the form holds is not sent unless
 * the week was changed.
 */
export const readHoursChange = (
  values: FormData,
  shown: Hours,
  today: string,
): HoursChangeRead => {
  const parts = weekPartsOf(shown.businessHours)
  const calendar = calendarPartsOf(shown.openingHours, today)
  const week = parts.map((part) => {
    const nameOf = (property: HoursProperty): string =>
      weekdayControlOf(part.weekday, property)
    const at = (property: HoursProperty): string =>
      textOf(values, nameOf(property)).trim()

    return {
      part,
      nameOf,
      opens: at('opens') === OPEN,
      times: {
        openTime: minutesOf(at('openTime')),
        closeTime: minutesOf(at('closeTime')),
      },
      rest: {
        breakStart: minutesOf(at('breakStart')),
        breakEnd: minutesOf(at('breakEnd')),
      },
    }
  })
  const dated = dateRowsIn(values).map((index) => {
    const nameOf = (property: HoursProperty): string =>
      dateControlOf(index, property)
    const at = (property: HoursProperty): string =>
      textOf(values, nameOf(property)).trim()

    return {
      nameOf,
      date: at('date'),
      opens: at('opens') === OPEN,
      times: {
        openTime: secondsOf(at('openTime')),
        closeTime: secondsOf(at('closeTime')),
      },
      isHoliday: values.has(nameOf('isHoliday')),
      holidayName: textOrNull(at('holidayName')),
      notes: textOrNull(textOf(values, nameOf('notes'))),
    }
  })
  const entries: [string, string | undefined][] = [
    ...week.flatMap(({ nameOf, opens, times, rest }) =>
      opens
        ? [
            ...timeEntriesOf(times, nameOf),
            ...restEntriesOf(times, rest, nameOf),
          ]
        : [],
    ),
    ...dated.flatMap(
      (
        { nameOf, date, opens, times, holidayName },
        position,
      ): [string, string | undefined][] => [
        [
          nameOf('date'),
          dateErrorOf(
            date,
            dated.slice(0, position).map((earlier) => earlier.date),
            today,
          ),
        ],
        ...(opens ? timeEntriesOf(times, nameOf) : []),
        [
          nameOf('holidayName'),
          tooLongError(
            holidayName,
            LONGEST_HOLIDAY_NAME,
            HOLIDAY_NAME_TOO_LONG,
          ),
        ],
      ],
    ),
  ]
  const errors = Object.fromEntries(
    entries.flatMap(([name, error]): [string, string][] =>
      error === undefined ? [] : [[name, error]],
    ),
  )
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  const businessHours = week.map(({ part, opens, times, rest }) =>
    businessHoursOf(part.weekday, times, rest, opens, part.effectivePeriod),
  )
  const openingHours = [
    ...calendar.past,
    ...dated.map(
      ({
        date,
        opens,
        times,
        isHoliday,
        holidayName,
        notes,
      }): ModelsOpeningHours => ({
        dayOfWeek: weekdayOf(date),
        date,
        openTime: opens ? (times.openTime ?? null) : null,
        closeTime: opens ? (times.closeTime ?? null) : null,
        isHoliday: opens ? isHoliday : true,
        holidayName,
        notes,
      }),
    ),
  ].toSorted(byDate)
  const weekAsShown = parts.map((part) =>
    businessHoursOf(part.weekday, part, part, part.opens, part.effectivePeriod),
  )
  const request: ModelsSalonUpdateRequest = {
    ...(sameEntries(businessHours, weekAsShown, weekValuesOf)
      ? {}
      : { businessHours }),
    ...(sameEntries(
      openingHours,
      shown.openingHours.toSorted(byDate),
      dateValuesOf,
    )
      ? {}
      : { openingHours }),
  }

  return Object.keys(request).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: request }
}

const CHANGED_MEANWHILE =
  'その間に、ほかのアカウントがこのサロンの営業時間を変えていました。このフォームの内容は、まだ保存していません。もう一度「保存する」を押すと、いまの営業時間を、このフォームの内容で置き換えます。ほかのアカウントの変更を確かめるときは、「やめる」で設定に戻ってください。'

/**
 * What the form of the hours says after the API did not take them. A
 * salon that is gone is no failure of the form: the screen says so.
 */
export const afterHoursChange = (
  outcome: Exclude<HoursAttempt, { type: 'written' } | NotFound>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'changed' }, () => aboutTheAttempt(CHANGED_MEANWHILE))
    // The form sends no email address: a refusal of one is a refusal of the form
    .with({ type: P.union('invalid', 'emailTaken') }, () =>
      aboutTheAttempt(CHECK_THE_VALUES_MESSAGE),
    )
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt(
        'このサロンの営業時間は、変えられません。営業時間を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      ),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        '営業時間を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
    .exhaustive()
