import type { LocalizedText } from '../languages/localized-text'
import { inEachLanguage } from './in-each-language'

/**
 * How many digits a number is written with after the decimal point: at
 * most `most`, and at least `least` (none unless it says).
 */
export type Decimals = {
  most: number
  least?: number | undefined
}

/**
 * A number with the separators of its language: 「1,234」, 「12.5」. Without
 * `decimals`, as many as three digits after the point are written.
 */
export const numberOf = (value: number, decimals?: Decimals): LocalizedText =>
  inEachLanguage((language) =>
    new Intl.NumberFormat(
      language,
      decimals === undefined
        ? {}
        : {
            maximumFractionDigits: decimals.most,
            minimumFractionDigits: decimals.least ?? 0,
          },
    ).format(value),
  )

/** An amount in a currency (an ISO 4217 code): 「￥5,500」, "¥5,500". */
export const amountOf = (amount: number, currency: string): LocalizedText =>
  inEachLanguage((language) =>
    new Intl.NumberFormat(language, { style: 'currency', currency }).format(
      amount,
    ),
  )

/** An amount in a few characters, where room is short (the axis of a chart): 「￥2.5万」, "¥25K". */
export const shortAmountOf = (
  amount: number,
  currency: string,
): LocalizedText =>
  inEachLanguage((language) =>
    new Intl.NumberFormat(language, {
      style: 'currency',
      currency,
      notation: 'compact',
    }).format(amount),
  )

/** The name of a currency (an ISO 4217 code): 「日本円」, "Japanese Yen". The code, for one the language has no name for. */
export const currencyNameOf = (currency: string): LocalizedText =>
  inEachLanguage(
    (language) =>
      new Intl.DisplayNames(language, { type: 'currency' }).of(currency) ??
      currency,
  )
