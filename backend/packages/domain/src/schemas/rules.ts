import { TZDate } from '@date-fns/tz'
import { format, isValid, parseISO } from 'date-fns'
import { z } from 'zod'

/**
 * Rules that the request schemas of more than one domain share.
 */

/** A nullable text is either null or says something: '' is not "unset". */
export const nonBlankText = z.string().regex(/\S/, 'Must not be blank')

/** An address that is stored and compared in lower case. */
export const lowerCaseEmail = z
  .email()
  .max(255)
  .transform((value) => value.toLowerCase())

const MIN_PHONE_DIGITS = 10

/** A phone number as people write it: digits with the usual separators. */
export const phoneNumber = z
  .string()
  .max(20)
  .regex(/^[\d\s\-+()]+$/, 'Must be a phone number')
  .refine(
    (value) => value.replace(/\D/g, '').length >= MIN_PHONE_DIGITS,
    `Must contain at least ${MIN_PHONE_DIGITS} digits`,
  )

const TIME_OF_DAY = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/

/** Time of a `time` column; the database returns it as HH:mm:ss. */
export const timeOfDay = z
  .string()
  .regex(TIME_OF_DAY, 'Must be a time in HH:mm or HH:mm:ss format')

/** A time of day in the form in which two of them compare as text. */
export const withSeconds = (time: string): string => time.padEnd(8, ':00')

/**
 * Shape of a time slot in a JSON column: two times of day in HH:mm, which
 * compare as text.
 */
export const timeSlot = z.strictObject({
  startTime: z.iso.time({ precision: -1 }),
  endTime: z.iso.time({ precision: -1 }),
})

/** A time slot as a request states it: it ends after it begins. */
export const orderedTimeSlot = timeSlot.refine(
  (slot) => slot.startTime < slot.endTime,
  { path: ['endTime'], message: 'Must be later than startTime' },
)

/**
 * The day of the week of a date (`YYYY-MM-DD`), as the `day_of_week` type
 * of the database names it. Null when the text is not a date; the format
 * rule reports that.
 */
export const dayOfWeekOf = (date: string): string | null => {
  const parsed = parseISO(date)
  return isValid(parsed) ? format(parsed, 'EEEE').toLowerCase() : null
}

/**
 * The local time in a time zone; an invalid date when the runtime does not
 * know the zone.
 */
export const inTimeZone = (moment: Date, timeZone: string): Date =>
  new TZDate(moment, timeZone)

/**
 * A time zone by the name the runtime knows it by, which the IANA names
 * such as `Asia/Tokyo` are. An offset such as `+09:00` is not a name: it
 * says what the clocks show now and not what they show in another season.
 */
export const timeZoneName = z
  .string()
  .max(50)
  .refine(
    (zone) => /^[A-Za-z]/.test(zone) && isValid(inTimeZone(new Date(0), zone)),
    'Must be the name of a time zone, such as Asia/Tokyo',
  )

/** The first day that a date or a moment of a request may be on. */
const EARLIEST_DATE = '1900-01-01'

/** The last day that a date or a moment of a request may be on. */
const LATEST_DATE = '2999-12-31'

/**
 * A date (`YYYY-MM-DD`), or a moment in UTC, lies within the days a
 * request may name. PostgreSQL holds no day of the year 0, which the ISO
 * format allows, nor a moment written past the year 9999; a day of the
 * range stays within what it holds when it is turned into a day of any
 * time zone, or into the day before or after. A moment is on the day it
 * begins with, as it is written in UTC. What is not a date has been
 * reported as that.
 */
const dayWithinRange = (context: z.core.ParsePayload<string>): void => {
  const day = context.value.slice(0, 10)
  if (!isValid(parseISO(day))) {
    return
  }
  if (day < EARLIEST_DATE) {
    context.issues.push({
      code: 'too_small',
      origin: 'date',
      minimum: parseISO(EARLIEST_DATE).getTime(),
      inclusive: true,
      message: `Must not be earlier than ${EARLIEST_DATE}`,
      input: context.value,
      continue: true,
    })
  } else if (day > LATEST_DATE) {
    context.issues.push({
      code: 'too_big',
      origin: 'date',
      maximum: parseISO(LATEST_DATE).getTime(),
      inclusive: true,
      message: `Must not be later than ${LATEST_DATE}`,
      input: context.value,
      continue: true,
    })
  }
}

/** A moment in UTC, as the request writes it, on a day a request may name. */
export const momentOfRequest = z.iso.datetime().check(dayWithinRange)

/**
 * A moment something actually happened at, in UTC, on a day a request may
 * name. It is returned in the one spelling `toISOString` gives, to the
 * millisecond.
 */
export const momentInUtc = momentOfRequest.transform((value) =>
  parseISO(value).toISOString(),
)

/** A day of the calendar, as a `date` column holds it, that a request may name. */
export const calendarDate = z.iso.date().check(dayWithinRange)

/** The largest value of an `integer` column. */
export const MAX_INTEGER = 2_147_483_647

/**
 * A reference is a kind and an ID together, or neither: an ID alone does
 * not say which table it is of. The one that is missing is reported.
 */
export const referenceInPairs = (
  context: z.core.ParsePayload<{
    referenceType: string | null
    referenceId: string | null
  }>,
): void => {
  const { referenceType, referenceId } = context.value
  if ((referenceType === null) === (referenceId === null)) {
    return
  }
  const [field, other] =
    referenceType === null
      ? ['referenceType', 'referenceId']
      : ['referenceId', 'referenceType']
  context.issues.push({
    code: 'custom',
    path: [field],
    message: `Must not be null when ${other} is given`,
    input: null,
    continue: true,
  })
}

/**
 * For a list in which no entry may come twice: an entry that an earlier one
 * equals is reported under its own index.
 */
export const noRepeatedEntries = (
  context: z.core.ParsePayload<readonly string[]>,
): void => {
  const seen = new Set<string>()
  context.value.forEach((entry, index) => {
    if (seen.has(entry)) {
      context.issues.push({
        code: 'custom',
        path: [index],
        message: 'Must not repeat an earlier entry',
        input: entry,
      })
    }
    seen.add(entry)
  })
}

/**
 * For the schema of an update, in which every property may be absent: a
 * request that names none changes nothing and is refused. An unknown
 * property is reported as such, not as an empty request.
 */
export const atLeastOneProperty = (
  context: z.core.ParsePayload<object>,
): void => {
  if (context.issues.length === 0 && Object.keys(context.value).length === 0) {
    context.issues.push({
      code: 'custom',
      path: [],
      message: 'At least one property must be specified',
      input: context.value,
    })
  }
}
