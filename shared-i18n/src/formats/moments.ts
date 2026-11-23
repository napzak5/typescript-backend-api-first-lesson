import type { LocalizedText } from '../languages/localized-text'
import { inEachLanguage } from './in-each-language'

/*
 * A moment in time (ISO 8601, `2026-11-20T01:30:00Z`), as the clock of a
 * time zone shows it: that of the salon, or that of whoever reads. Every
 * language writes the hours from 0 to 23, as the API writes the times of
 * a day (`10:00`).
 */

/** The time of day, with two digits for the hour: 「09:05」. */
export const timeOfDayAt = (moment: string, timeZone: string): LocalizedText =>
  inEachLanguage((language) =>
    new Intl.DateTimeFormat(language, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).format(new Date(moment)),
  )

/** The day and the time: 「2026年11月20日 9:05」, "November 20, 2026 at 09:05". */
export const momentAt = (moment: string, timeZone: string): LocalizedText =>
  inEachLanguage((language) =>
    new Intl.DateTimeFormat(language, {
      dateStyle: 'long',
      timeStyle: 'short',
      hourCycle: 'h23',
      timeZone,
    }).format(new Date(moment)),
  )
