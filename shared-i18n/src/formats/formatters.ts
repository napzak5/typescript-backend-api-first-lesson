import type { Locale } from '../languages/locale'

/*
 * A formatter of `Intl` costs some fifty times what a value written with
 * it does, and every value is written in each language: a formatter is
 * made once for a language and its options, and kept.
 */

const keptBy = <Options, Formatter>(
  make: (language: Locale, options: Options) => Formatter,
): ((language: Locale, options: Options) => Formatter) => {
  const made = new Map<string, Formatter>()

  return (language, options) => {
    const key = `${language} ${JSON.stringify(options)}`
    const known = made.get(key)
    if (known !== undefined) {
      return known
    }
    const formatter = make(language, options)
    made.set(key, formatter)

    return formatter
  }
}

/** The formatter of numbers of a language and its options. */
export const numberFormatIn = keptBy(
  (language: Locale, options: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(language, options),
)

/** The formatter of days and times of a language and its options. */
export const dateTimeFormatIn = keptBy(
  (language: Locale, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(language, options),
)

/** The names a language has for the codes of a kind (currencies). */
export const displayNamesIn = keptBy(
  (language: Locale, options: Intl.DisplayNamesOptions) =>
    new Intl.DisplayNames(language, options),
)
