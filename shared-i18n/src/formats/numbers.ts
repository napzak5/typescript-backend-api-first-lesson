import type { Locale } from '../languages/locale'
import type { LocalizedText } from '../languages/localized-text'
import { displayNamesIn, numberFormatIn, pluralRulesIn } from './formatters'
import { inEachLanguage } from './in-each-language'

/**
 * How many digits a number is written with after the decimal point: at
 * most `most`, and at least `least` (none unless it says).
 */
export type Decimals = {
  most: number
  least?: number | undefined
}

const numberIn = (
  language: Locale,
  value: number | bigint,
  decimals: Decimals | undefined,
): string =>
  numberFormatIn(
    language,
    decimals === undefined
      ? {}
      : {
          maximumFractionDigits: decimals.most,
          minimumFractionDigits: decimals.least ?? 0,
        },
  ).format(value)

/**
 * A number with the separators of its language: 「1,234」, 「12.5」. Without
 * `decimals`, as many as three digits after the point are written.
 */
export const numberOf = (
  value: number | bigint,
  decimals?: Decimals,
): LocalizedText =>
  inEachLanguage((language) => numberIn(language, value, decimals))

/** The ending of an English ordinal, by the form its number takes */
const ORDINAL_ENDINGS: Record<Intl.LDMLPluralRule, string> = {
  zero: 'th',
  one: 'st',
  two: 'nd',
  few: 'rd',
  many: 'th',
  other: 'th',
}

/** A place in a ranking, counted from 1: 「1 位」, "1st", 「12 位」, "12th". */
export const placeOf = (place: number): LocalizedText => ({
  en: `${numberIn('en', place, undefined)}${ORDINAL_ENDINGS[pluralRulesIn('en', { type: 'ordinal' }).select(place)]}`,
  ja: `${numberIn('ja', place, undefined)} 位`,
})

/** A share of the whole, as the API writes it in percent (`12.5`): 「12.5%」. */
export const percentOf = (
  percentage: number,
  decimals?: Decimals,
): LocalizedText =>
  inEachLanguage((language) => `${numberIn(language, percentage, decimals)}%`)

/** An amount in a currency (an ISO 4217 code): 「￥5,500」, "¥5,500". */
export const amountOf = (amount: number, currency: string): LocalizedText =>
  inEachLanguage((language) =>
    numberFormatIn(language, { style: 'currency', currency }).format(amount),
  )

/** An amount in a few characters, where room is short (the axis of a chart): 「￥2.5万」, "¥25K". */
export const shortAmountOf = (
  amount: number,
  currency: string,
): LocalizedText =>
  inEachLanguage((language) =>
    numberFormatIn(language, {
      style: 'currency',
      currency,
      notation: 'compact',
    }).format(amount),
  )

const KILOBYTE = 1024
const MEGABYTE = 1024 * 1024

/** The size of a file to the last byte: 「1,234 バイト」, "1,234 bytes". */
export const bytesOf = (size: number): LocalizedText =>
  inEachLanguage((language) =>
    numberFormatIn(language, {
      style: 'unit',
      unit: 'byte',
      unitDisplay: 'long',
    }).format(size),
  )

/**
 * The size of a file as it is read at a glance: in bytes below a kilobyte
 * (1,024 bytes), in whole kilobytes below a megabyte, and in megabytes to
 * one decimal from it on: 「512 バイト」, 「340 KB」, 「1.2 MB」.
 */
export const fileSizeOf = (size: number): LocalizedText => {
  if (size < KILOBYTE) {
    return bytesOf(size)
  }
  if (size < MEGABYTE) {
    return inEachLanguage((language) =>
      numberFormatIn(language, {
        style: 'unit',
        unit: 'kilobyte',
        maximumFractionDigits: 0,
      }).format(size / KILOBYTE),
    )
  }

  return inEachLanguage((language) =>
    numberFormatIn(language, {
      style: 'unit',
      unit: 'megabyte',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(size / MEGABYTE),
  )
}

/** The name of a currency (an ISO 4217 code): 「日本円」, "Japanese Yen". The code, for one the language has no name for. */
export const currencyNameOf = (currency: string): LocalizedText =>
  inEachLanguage(
    (language) =>
      displayNamesIn(language, { type: 'currency', fallback: 'none' }).of(
        currency,
      ) ?? currency,
  )
