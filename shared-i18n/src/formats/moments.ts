import type { Locale } from '../languages/locale'
import type { LocalizedText } from '../languages/localized-text'
import { dateTimeFormatIn } from './formatters'
import { inEachLanguage } from './in-each-language'
import { rangeIn } from './times'

/*
 * A moment in time (ISO 8601, `2026-11-20T01:30:00Z`), as the clock of a
 * time zone shows it: that of the salon, or that of whoever reads. Every
 * language writes the hours from 0 to 23, as the API writes the times of
 * a day (`10:00`).
 */

const TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}

const written = (
  language: Locale,
  moment: string,
  options: Intl.DateTimeFormatOptions,
): string => dateTimeFormatIn(language, options).format(new Date(moment))

/** The time of day, with two digits for the hour: 「09:05」. */
export const timeOfDayAt = (moment: string, timeZone: string): LocalizedText =>
  inEachLanguage((language) => written(language, moment, { ...TIME, timeZone }))

/** From when until when, on the clock of a time zone: 「10:00〜11:00」, "10:00–11:00". */
export const timeRangeAt = (
  from: string,
  to: string,
  timeZone: string,
): LocalizedText =>
  inEachLanguage((language) =>
    rangeIn(
      language,
      written(language, from, { ...TIME, timeZone }),
      written(language, to, { ...TIME, timeZone }),
    ),
  )

/** The day and the time: 「2026年11月20日 9:05」, "November 20, 2026 at 09:05". */
export const momentAt = (moment: string, timeZone: string): LocalizedText =>
  inEachLanguage((language) =>
    written(language, moment, {
      dateStyle: 'long',
      timeStyle: 'short',
      hourCycle: 'h23',
      timeZone,
    }),
  )

/** The day with its day of the week, and the time: 「2026年11月20日（金） 09:05」, "Fri, November 20, 2026 at 09:05". */
export const momentWithWeekdayAt = (
  moment: string,
  timeZone: string,
): LocalizedText => ({
  en: written('en', moment, {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...TIME,
    timeZone,
  }),
  ja: `${written('ja', moment, { dateStyle: 'long', timeZone })}（${written('ja', moment, { weekday: 'short', timeZone })}） ${written('ja', moment, { ...TIME, timeZone })}`,
})
