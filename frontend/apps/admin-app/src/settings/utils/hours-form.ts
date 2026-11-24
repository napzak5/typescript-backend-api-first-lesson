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
  type FormErrors,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match, P } from 'ts-pattern'
import { dateRowsIn, WEEKDAYS, weekdayOf } from '../../shifts/utils/shift-week'
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
export const LONGEST_HOLIDAY_NAME = 100

const { hoursForm } = adminSettingsMessages
const { errors: ERRORS } = hoursForm

const HOLIDAY_NAME_TOO_LONG = tooLongOf(
  hoursForm.holidayName,
  LONGEST_HOLIDAY_NAME,
)

/** What is said at a control, under its name, or nothing */
type Entry = [string, LocalizedText | undefined]

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
): Entry[] => [
  [nameOf('openTime'), openTime === undefined ? ERRORS.openMissing : undefined],
  [
    nameOf('closeTime'),
    closeTime === undefined
      ? ERRORS.closeMissing
      : openTime !== undefined && closeTime <= openTime
        ? ERRORS.closeBeforeOpen
        : undefined,
  ],
]

/** What is said at the break of a day of the week the salon is open on. */
const restEntriesOf = (
  { openTime, closeTime }: Times,
  { breakStart, breakEnd }: Rest,
  nameOf: (property: HoursProperty) => string,
): Entry[] => [
  [
    nameOf('breakStart'),
    breakStart === undefined
      ? breakEnd === undefined
        ? undefined
        : ERRORS.noBreakStart
      : openTime !== undefined && breakStart <= openTime
        ? ERRORS.breakBeforeOpen
        : undefined,
  ],
  [
    nameOf('breakEnd'),
    breakEnd === undefined
      ? breakStart === undefined
        ? undefined
        : ERRORS.noBreakEnd
      : breakStart !== undefined && breakEnd <= breakStart
        ? ERRORS.breakEndBeforeStart
        : closeTime !== undefined && breakEnd >= closeTime
          ? ERRORS.breakAfterClose
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
): LocalizedText | undefined => {
  if (date === '') {
    return ERRORS.dayMissing
  }
  if (!isDay(date)) {
    return ERRORS.dayOutOfRange
  }
  if (date < today) {
    return ERRORS.dayPast
  }
  const same = earlier.indexOf(date)

  return same === -1 ? undefined : ERRORS.sameDate(same + 1)
}

/** What a change of the hours asks for, nothing when nothing was changed, or what is wrong with the form. */
export type HoursChangeRead =
  | { type: 'valid'; value: ModelsSalonUpdateRequest }
  | { type: 'unchanged' }
  | { type: 'invalid'; errors: FormErrors<LocalizedText> }

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
  const entries: Entry[] = [
    ...week.flatMap(({ nameOf, opens, times, rest }) =>
      opens
        ? [
            ...timeEntriesOf(times, nameOf),
            ...restEntriesOf(times, rest, nameOf),
          ]
        : [],
    ),
    ...dated.flatMap(
      ({ nameOf, date, opens, times, holidayName }, position): Entry[] => [
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
  const errors: FormErrors<LocalizedText> = Object.fromEntries(
    entries.flatMap(([name, error]): [string, LocalizedText][] =>
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

/**
 * What the form of the hours says after the API did not take them. A
 * salon that is gone is no failure of the form: the screen says so.
 */
export const afterHoursChange = (
  outcome: Exclude<HoursAttempt, { type: 'written' } | NotFound>,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'changed' }, () =>
      aboutTheAttempt(hoursForm.changedMeanwhile),
    )
    // The form sends no email address: a refusal of one is a refusal of the form
    .with({ type: P.union('invalid', 'emailTaken') }, () =>
      aboutTheAttempt(CHECK_THE_VALUES_MESSAGE),
    )
    .with({ type: 'forbidden' }, () => aboutTheAttempt(hoursForm.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(hoursForm.failed))
    .exhaustive()
