import type { LocalizedText } from './localized-text'

/**
 * What stands between the languages of a text that is written as one
 * string: the unit separator, a character that is there to part the pieces
 * of data in a string, and that no sentence holds.
 */
const BETWEEN_LANGUAGES = '\u001f'

/** A value of a request may bring the separator into a text; it is told as a space. */
const withoutSeparator = (sentence: string): string =>
  sentence.replaceAll(BETWEEN_LANGUAGES, ' ')

/**
 * A text in every language as one string, for a place that takes one
 * string and has to carry the text in every language: the message of a
 * rule of a schema. `textOfOneString` reads it back.
 */
export const asOneString = (written: LocalizedText): string =>
  [written.en, written.ja].map(withoutSeparator).join(BETWEEN_LANGUAGES)

/**
 * The text that a string made by `asOneString` holds, and nothing for any
 * other string.
 */
export const textOfOneString = (string: string): LocalizedText | undefined => {
  const [en, ja, ...more] = string.split(BETWEEN_LANGUAGES)

  return en !== undefined && ja !== undefined && more.length === 0
    ? { en, ja }
    : undefined
}
