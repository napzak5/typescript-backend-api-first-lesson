import { LOCALES, type Locale } from './locale'

/** One language range of an `Accept-Language` header, with its weight. */
type LanguageRange = { tag: string; weight: number }

/**
 * A language range that names a language, with the weight it may have
 * (RFC 9110, sections 12.4.2 and 12.5.4): `ja`, `en-US;q=0.8`. The weight
 * is 0 to 1 with at most three decimals.
 */
const LANGUAGE_RANGE =
  /^([a-z]{1,8}(?:-[a-z0-9]{1,8})*)(?:[ \t]*;[ \t]*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i

/**
 * A range that is not written as the grammar has it is left out, and so is
 * `*`, which names no language.
 */
const languageRangesOf = (element: string): LanguageRange[] => {
  const [, tag, weight = '1'] = LANGUAGE_RANGE.exec(element.trim()) ?? []

  return tag === undefined ? [] : [{ tag, weight: Number(weight) }]
}

/**
 * The language of the product that a language tag names, if it names one.
 * The languages of the product are written without a region or a script,
 * so the tag names the language of its first part: that is where the
 * Lookup of RFC 4647 (section 3.4) arrives when it shortens `ja-JP` to
 * `ja`. Tags are compared without regard to case (RFC 5646, section 2.1.1).
 */
const localeOfTag = (tag: string): Locale | undefined => {
  const [language] = tag.toLowerCase().split('-')

  return LOCALES.find((locale) => locale === language)
}

/**
 * The language to answer a request in, from its `Accept-Language` header
 * (RFC 9110, section 12.5.4).
 *
 * - The ranges are tried by their weight, the heaviest first, and those of
 *   one weight in the order they are written in. The first that names a
 *   language of the product decides.
 * - A range of the weight 0 names a language that is not accepted: it
 *   decides nothing, and where no range decides, the answer is in the
 *   fallback unless it is that language.
 * - `*` names no language. Without a header, or when no range names a
 *   language of the product, the answer is in the fallback: the header is
 *   a wish, and no request is refused for it.
 */
export const localeOfAcceptLanguage = (
  header: string | undefined,
  fallback: Locale,
): Locale => {
  const ranges = (header ?? '').split(',').flatMap(languageRangesOf)
  const refused = ranges
    .filter(({ weight }) => weight === 0)
    .map(({ tag }) => localeOfTag(tag))
  const wanted = ranges
    .filter(({ weight }) => weight > 0)
    .toSorted((one, other) => other.weight - one.weight)
    .map(({ tag }) => localeOfTag(tag))

  return (
    wanted.find((locale) => locale !== undefined) ??
    [fallback, ...LOCALES].find((locale) => !refused.includes(locale)) ??
    fallback
  )
}
