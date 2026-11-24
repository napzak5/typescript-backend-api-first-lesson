import type { Locale } from './locale'
import { localeOfTag } from './locale'

/**
 * The language of a page whose visitor chose none, from the languages the
 * browser is set to (`navigator.languages`), the one it prefers first: the
 * first of them that names a language of the product decides, read as a
 * range of `Accept-Language` is (`en-US` names English). When none does,
 * the page is in the fallback.
 */
export const localeOfLanguages = (
  languages: readonly string[],
  fallback: Locale,
): Locale =>
  languages.map(localeOfTag).find((locale) => locale !== undefined) ?? fallback
