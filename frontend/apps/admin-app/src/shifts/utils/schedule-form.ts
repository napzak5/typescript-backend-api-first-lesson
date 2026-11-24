import {
  CHECK_THE_VALUES_MESSAGE,
  type NotFound,
  REFUSED_VALUE_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsDayOfWeekType,
  ModelsStaffSchedule,
} from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminShiftMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { type ScheduleAttempt, sameSchedule } from '../api/schedules-api'
import { dateRowsIn, WEEKDAYS } from './shift-week'

const { form } = adminShiftMessages
const { errors: ERRORS } = form

/*
 * The form of the schedule of a member: a part for every day of the week,
 * and the rows of dates that come after today. The API replaces the whole
 * schedule, so the form sends every row it keeps, the rows of the days
 * before today among them unless they are to go.
 */

/** The rows of dates a schedule holds at most: one for every day of a year */
export const MOST_DATES = 366

/** What a part of the form chooses: whether the member works */
export const WORKS = 'works'
export const OFF = 'off'

/** A value of a row, as a control of the form is named after it */
export type ScheduleProperty =
  | 'works'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'breakStartTime'
  | 'breakEndTime'
  | 'notes'

/** The name of a control of the row of a day of the week: 「monday.startTime」. */
export const weeklyControlOf = (
  weekday: ModelsDayOfWeekType,
  property: ScheduleProperty,
): string => `${weekday}.${property}`

/** The name of a control of the row of a date, by the place of the row: 「dates.0.startTime」. */
export const dateControlOf = (
  index: number,
  property: ScheduleProperty,
): string => `dates.${index}.${property}`

/** The control that drops the rows of the days before today */
export const DROP_PAST = 'dropPast'

/** The rows the form shows of a schedule, and those it keeps out of sight. */
export type ScheduleParts = {
  /** The row of every day of the week, from Monday: none for a day without one */
  weekly: {
    weekday: ModelsDayOfWeekType
    row: ModelsStaffSchedule | undefined
  }[]
  /** The rows of today and of the days after it */
  dates: ModelsStaffSchedule[]
  /** The rows of the days before today */
  past: ModelsStaffSchedule[]
}

/** The rows of a schedule as the form shows them, `today` being today at the salon. */
export const partsOf = (
  rows: readonly ModelsStaffSchedule[],
  today: string,
): ScheduleParts => ({
  weekly: WEEKDAYS.map((weekday) => ({
    weekday,
    row: rows.find((row) => row.isRecurring && row.dayOfWeek === weekday),
  })),
  dates: rows.filter(
    (row) => !row.isRecurring && row.date !== null && row.date >= today,
  ),
  past: rows.filter(
    (row) => !row.isRecurring && row.date !== null && row.date < today,
  ),
})

/** A time of a row as a control of the form holds it: 「09:00」. */
export const timeInputOf = (time: string | null): string | undefined =>
  time === null
    ? undefined
    : time.length === 8 && time.endsWith(':00')
      ? time.slice(0, 5)
      : time

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** A time a control holds, as the API keeps it with its seconds: 「09:00:00」; none for no time. */
const timeOf = (text: string): string | undefined =>
  TIME.test(text) ? (text.length === 5 ? `${text}:00` : text) : undefined

/** What a part of the form holds: the times as the API keeps them, none for no time. */
type Filled = {
  works: boolean
  startTime: string | undefined
  endTime: string | undefined
  breakStartTime: string | undefined
  breakEndTime: string | undefined
  notes: string | null
}

const filledAt = (
  values: FormData,
  nameOf: (property: ScheduleProperty) => string,
): Filled => ({
  works: textOf(values, nameOf('works')) === WORKS,
  startTime: timeOf(textOf(values, nameOf('startTime')).trim()),
  endTime: timeOf(textOf(values, nameOf('endTime')).trim()),
  breakStartTime: timeOf(textOf(values, nameOf('breakStartTime')).trim()),
  breakEndTime: timeOf(textOf(values, nameOf('breakEndTime')).trim()),
  notes: textOrNull(textOf(values, nameOf('notes'))),
})

/** What is said at the end of the hours of a part. */
const endTimeError = ({
  startTime,
  endTime,
}: Filled): LocalizedText | undefined => {
  if (endTime === undefined) {
    return ERRORS.endMissing
  }
  if (startTime !== undefined && endTime <= startTime) {
    return ERRORS.endBeforeStart
  }

  return undefined
}

/** What is said at the start of the break of a part. */
const breakStartError = ({
  startTime,
  breakStartTime,
  breakEndTime,
}: Filled): LocalizedText | undefined => {
  if (breakStartTime === undefined) {
    return breakEndTime === undefined ? undefined : ERRORS.noBreakStart
  }
  if (startTime !== undefined && breakStartTime <= startTime) {
    return ERRORS.breakBeforeStart
  }

  return undefined
}

/** What is said at the end of the break of a part. */
const breakEndError = ({
  endTime,
  breakStartTime,
  breakEndTime,
}: Filled): LocalizedText | undefined => {
  if (breakEndTime === undefined) {
    return breakStartTime === undefined ? undefined : ERRORS.noBreakEnd
  }
  if (breakStartTime !== undefined && breakEndTime <= breakStartTime) {
    return ERRORS.breakEndBeforeStart
  }
  if (endTime !== undefined && breakEndTime >= endTime) {
    return ERRORS.breakAfterEnd
  }

  return undefined
}

/** What is said at the times of a part the member works on, under the names of their controls; nothing for a day off. */
const timeEntriesOf = (
  filled: Filled,
  nameOf: (property: ScheduleProperty) => string,
): [string, LocalizedText | undefined][] =>
  filled.works
    ? [
        [
          nameOf('startTime'),
          filled.startTime === undefined ? ERRORS.startMissing : undefined,
        ],
        [nameOf('endTime'), endTimeError(filled)],
        [nameOf('breakStartTime'), breakStartError(filled)],
        [nameOf('breakEndTime'), breakEndError(filled)],
      ]
    : []

/** The values of a row that the times of a part give: none on a day off. */
const hoursOf = (
  filled: Filled,
): Pick<
  ModelsStaffSchedule,
  | 'startTime'
  | 'endTime'
  | 'breakStartTime'
  | 'breakEndTime'
  | 'isAvailable'
  | 'notes'
> =>
  filled.works
    ? {
        startTime: filled.startTime ?? null,
        endTime: filled.endTime ?? null,
        breakStartTime: filled.breakStartTime ?? null,
        breakEndTime: filled.breakEndTime ?? null,
        isAvailable: true,
        notes: filled.notes,
      }
    : {
        startTime: null,
        endTime: null,
        breakStartTime: null,
        breakEndTime: null,
        isAvailable: false,
        notes: filled.notes,
      }

/** A row the form sends, with the control it was written at: none for a row of a day before today. */
type Sent = { row: ModelsStaffSchedule; control: string | undefined }

/** What the form sends: every row of the schedule, and where each was written. */
export type ScheduleRequest = {
  rows: ModelsStaffSchedule[]
  /** The control every row was written at, in the order of `rows`: 「monday」, 「dates.0」 */
  controls: (string | undefined)[]
}

/** What is said at the date of a row: none, when it may be sent. */
const dateErrorOf = (
  date: string,
  earlier: readonly string[],
  kept: readonly ModelsStaffSchedule[],
): LocalizedText | undefined => {
  if (date === '') {
    return ERRORS.dayMissing
  }
  if (!isDay(date)) {
    return ERRORS.dayOutOfRange
  }
  const same = earlier.indexOf(date)
  if (same !== -1) {
    return ERRORS.sameDate(same + 1)
  }

  return kept.some((row) => row.date === date) ? ERRORS.pastDateKept : undefined
}

/**
 * The schedule a form holds, as the API takes it: the weekly rows from
 * Monday, then the rows of dates by their dates. A day of the week the
 * member does not work on has a row only when there is a note to keep
 * (the API takes a day off and no row alike). The rows of the days before
 * today that the form does not show are sent as they were, unless they are
 * to go.
 */
const readWhole = (
  values: FormData,
  shown: readonly ModelsStaffSchedule[],
  today: string,
): FormRead<ScheduleRequest, FormErrors<LocalizedText>> => {
  const parts = partsOf(shown, today)
  const kept = values.has(DROP_PAST) ? [] : parts.past
  const weekly = WEEKDAYS.map((weekday) => ({
    weekday,
    filled: filledAt(values, (property) => weeklyControlOf(weekday, property)),
  }))
  const dated = dateRowsIn(values).map((index) => ({
    index,
    date: textOf(values, dateControlOf(index, 'date')).trim(),
    filled: filledAt(values, (property) => dateControlOf(index, property)),
  }))
  const entries: [string, LocalizedText | undefined][] = [
    ...weekly.flatMap(({ weekday, filled }) =>
      timeEntriesOf(filled, (property) => weeklyControlOf(weekday, property)),
    ),
    ...dated.flatMap(
      (
        { index, date, filled },
        position,
      ): [string, LocalizedText | undefined][] => [
        [
          dateControlOf(index, 'date'),
          dateErrorOf(
            date,
            dated.slice(0, position).map((earlier) => earlier.date),
            kept,
          ),
        ],
        ...timeEntriesOf(filled, (property) => dateControlOf(index, property)),
      ],
    ),
  ]
  const errors = Object.fromEntries(
    entries.flatMap(([name, error]): [string, LocalizedText][] =>
      error === undefined ? [] : [[name, error]],
    ),
  )
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  const sent: Sent[] = [
    ...weekly.flatMap(({ weekday, filled }): Sent[] =>
      !filled.works && filled.notes === null
        ? []
        : [
            {
              row: {
                dayOfWeek: weekday,
                date: null,
                isRecurring: true,
                ...hoursOf(filled),
              },
              control: weekday,
            },
          ],
    ),
    ...[
      ...kept.map((row): Sent => ({ row, control: undefined })),
      ...dated.map(
        ({ index, date, filled }): Sent => ({
          row: {
            dayOfWeek: null,
            date,
            isRecurring: false,
            ...hoursOf(filled),
          },
          control: `dates.${index}`,
        }),
      ),
    ].sort((one, other) =>
      (one.row.date ?? '').localeCompare(other.row.date ?? ''),
    ),
  ]

  return {
    type: 'valid',
    value: {
      rows: sent.map(({ row }) => row),
      controls: sent.map(({ control }) => control),
    },
  }
}

/** The rows of a schedule as the form would send them back unchanged: a day off without a note is no row. */
const asSent = (rows: readonly ModelsStaffSchedule[]): ModelsStaffSchedule[] =>
  rows.filter(
    (row) => !(row.isRecurring && !row.isAvailable && row.notes === null),
  )

/** What a change of a schedule asks for: nothing, when nothing was changed. */
export type ScheduleChange =
  | FormRead<ScheduleRequest, FormErrors<LocalizedText>>
  | { type: 'unchanged' }

/**
 * The schedule a form holds, and whether it differs from the schedule it
 * was opened with (`shown`): a form sent as it was opened asks the API for
 * nothing.
 */
export const readScheduleChange = (
  values: FormData,
  shown: readonly ModelsStaffSchedule[],
  today: string,
): ScheduleChange => {
  const read = readWhole(values, shown, today)
  if (read.type === 'invalid') {
    return read
  }

  return sameSchedule(read.value.rows, asSent(shown))
    ? { type: 'unchanged' }
    : read
}

/** The values of a row that a control of the form is named after */
const PROPERTIES: readonly string[] = [
  'date',
  'startTime',
  'endTime',
  'breakStartTime',
  'breakEndTime',
  'notes',
]

/**
 * What the form of a schedule says after the API did not take it. A
 * member who is gone is no failure of the form: the screen says so.
 */
export const afterScheduleSave = (
  outcome: Exclude<ScheduleAttempt, { type: 'saved' } | NotFound>,
  request: ScheduleRequest,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap(({ field }) => {
        const [place, property] = field.split('.')
        const control = request.controls[Number(place)]

        return control === undefined ||
          property === undefined ||
          !PROPERTIES.includes(property)
          ? []
          : [`${control}.${property}`]
      })

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          said.map((control) => [control, REFUSED_VALUE_MESSAGE]),
        ),
      }
    })
    .with({ type: 'changed' }, () => aboutTheAttempt(form.changedMeanwhile))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(form.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(form.failed))
    .exhaustive()
