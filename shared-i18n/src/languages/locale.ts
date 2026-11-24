/** A language the product is written in. */
export type Locale = 'en' | 'ja'

/** Every language of the product. */
export const LOCALES: readonly Locale[] = ['en', 'ja']

/**
 * The name of each language of the product, written in that language: a
 * visitor who cannot read the page finds their own language by it, in a
 * list of the languages.
 */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
}

/**
 * The language of the product that a language tag names, if it names one.
 * The languages of the product are written without a region or a script,
 * so the tag names the language of its first part: that is where the
 * Lookup of RFC 4647 (section 3.4) arrives when it shortens `ja-JP` to
 * `ja`. Tags are compared without regard to case (RFC 5646, section 2.1.1).
 */
export const localeOfTag = (tag: string): Locale | undefined => {
  const [language] = tag.toLowerCase().split('-')

  return LOCALES.find((locale) => locale === language)
}
