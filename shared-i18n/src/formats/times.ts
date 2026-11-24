import type { Locale } from '../languages/locale'
import type { LocalizedText } from '../languages/localized-text'
import { numberFormatIn } from './formatters'
import { inEachLanguage } from './in-each-language'
import type { Decimals } from './numbers'

/*
 * A length of time (how long a service takes, in hours and minutes or in
 * minutes alone), and times of a day from when until when, as the API
 * writes a time of a day: `10:00` or `10:00:00`.
 */

const unitIn = (
  language: Locale,
  value: number,
  unit: 'hour' | 'minute',
  decimals?: Decimals,
): string =>
  numberFormatIn(language, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    ...(decimals === undefined
      ? {}
      : {
          maximumFractionDigits: decimals.most,
          minimumFractionDigits: decimals.least ?? 0,
        }),
  }).format(value)

/**
 * How long something takes, in hours and minutes: 「1 時間 30 分」,
 * "1 hr 30 min". Whole hours are written without minutes (「1 時間」),
 * and less than an hour in minutes alone (「45 分」).
 */
export const durationOf = (minutes: number): LocalizedText =>
  inEachLanguage((language) => {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60

    return [
      ...(hours === 0 ? [] : [unitIn(language, hours, 'hour')]),
      ...(rest === 0 && hours > 0 ? [] : [unitIn(language, rest, 'minute')]),
    ].join(' ')
  })

/**
 * How long something takes, in minutes alone, as a form that takes minutes
 * writes it back: 「90 分」, "90 min". An average is written with the
 * decimals it is given (「72.5 分」); without them, as many as three.
 */
export const minutesOf = (
  minutes: number,
  decimals?: Decimals,
): LocalizedText =>
  inEachLanguage((language) => unitIn(language, minutes, 'minute', decimals))

/** A time of a day without its seconds: `10:00` of `10:00:00`. */
const withoutSeconds = (time: string): string => time.slice(0, 5)

/** From when until when, in a language: 「10:00〜11:00」, "10:00–11:00". */
export const rangeIn = (language: Locale, from: string, to: string): string =>
  language === 'ja' ? `${from}〜${to}` : `${from}–${to}`

/**
 * From when until when, the times written as they are given: 「09:00〜20:00」,
 * "09:00–20:00". A screen that keeps the seconds of a time it shows passes
 * them in.
 */
export const timeRangeOf = (from: string, to: string): LocalizedText =>
  inEachLanguage((language) => rangeIn(language, from, to))

/** The slots of a day, as a sentence lists them: 「10:00〜12:00、14:00〜16:00」, "10:00–12:00, 14:00–16:00". */
export const timeSlotsOf = (
  slots: readonly { startTime: string; endTime: string }[],
): LocalizedText =>
  inEachLanguage((language) =>
    slots
      .map(({ startTime, endTime }) =>
        rangeIn(language, withoutSeconds(startTime), withoutSeconds(endTime)),
      )
      .join(language === 'ja' ? '、' : ', '),
  )
