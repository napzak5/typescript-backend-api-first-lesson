import type { Locale } from '../languages/locale'
import type { LocalizedText } from '../languages/localized-text'
import { dateTimeFormatIn } from './formatters'
import { inEachLanguage } from './in-each-language'

/*
 * A day of the calendar (`2026-11-20`), as the API writes the day of a
 * booking, a day of birth or an expiry. It is no moment in time, so it is
 * written as it stands, in no time zone but the one it is read in.
 */

const written = (
  language: Locale,
  day: string,
  options: Intl.DateTimeFormatOptions,
): string =>
  dateTimeFormatIn(language, { ...options, timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  )

/** The day of the week in a word: 「金」, "Fri". */
const weekdayIn = (language: Locale, day: string): string =>
  written(language, day, { weekday: 'short' })

/** A day: 「2026年11月20日」, "November 20, 2026". */
export const dayOf = (day: string): LocalizedText =>
  inEachLanguage((language) => written(language, day, { dateStyle: 'long' }))

/** A day with its day of the week: 「2026年11月20日（金）」, "Fri, November 20, 2026". */
export const dayWithWeekdayOf = (day: string): LocalizedText => ({
  en: written('en', day, {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  ja: `${written('ja', day, { dateStyle: 'long' })}（${weekdayIn('ja', day)}）`,
})

/** A day with the whole name of its day of the week: 「2026年11月20日金曜日」, "Friday, November 20, 2026". */
export const fullDayOf = (day: string): LocalizedText =>
  inEachLanguage((language) => written(language, day, { dateStyle: 'full' }))

/** A day of a year that goes without saying, with its day of the week: 「11月20日（金）」, "Fri, November 20". */
export const monthDayOf = (day: string): LocalizedText => ({
  en: written('en', day, { weekday: 'short', month: 'long', day: 'numeric' }),
  ja: `${written('ja', day, { month: 'long', day: 'numeric' })}（${weekdayIn('ja', day)}）`,
})

/** A day where room is short (a column of a week): 「11/20（金）」, "Fri, 11/20". */
export const shortDayOf = (day: string): LocalizedText => ({
  en: written('en', day, {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  }),
  ja: `${written('ja', day, { month: 'numeric', day: 'numeric' })}（${weekdayIn('ja', day)}）`,
})
