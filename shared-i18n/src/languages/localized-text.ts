import type { Locale } from './locale'

/**
 * A text written in every language of the product. One that lacks a
 * language does not compile, so a translation cannot be forgotten.
 */
export type LocalizedText = Readonly<Record<Locale, string>>

/** A text in every language, as a list of messages writes it. */
export const text = (written: LocalizedText): LocalizedText => written

/** A text as it reads in one language. */
export const textIn = (written: LocalizedText, locale: Locale): string =>
  written[locale]
