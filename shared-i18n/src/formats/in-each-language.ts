import type { Locale } from '../languages/locale'
import type { LocalizedText } from '../languages/localized-text'

/** A value as each language of the product writes it. */
export const inEachLanguage = (
  write: (language: Locale) => string,
): LocalizedText => ({
  en: write('en'),
  ja: write('ja'),
})
