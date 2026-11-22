/*
 * How long a text is, and what a form says of one that is longer than the
 * API takes. The API counts characters (the code points of Unicode), and
 * so does a column of the database: every length a form checks is counted
 * here, and every sentence that names a number of characters is written
 * here.
 */

/**
 * How many characters a text has, as the API counts them: a character
 * outside the basic plane (「𠮷」, an emoji) is one, where `text.length`
 * counts it as two.
 */
export const lengthOf = (text: string): number => [...text].length

/** A number of characters as a sentence writes it: 「2,000 文字」. */
export const charactersOf = (count: number): string =>
  `${count.toLocaleString('ja-JP')} 文字`

/** What a form says of a text that is longer than the API takes. */
export const tooLong = (most: number): string =>
  `${charactersOf(most)}以内で入力してください。`

/**
 * The same of a text the sentence names (「仕入先」): the message stands
 * where it could mean more than one control, or apart from its control.
 */
export const tooLongOf = (what: string, most: number): string =>
  `${what}は、${tooLong(most)}`

/** The same of the entries of a list, each of which may be so long. */
export const eachTooLongOf = (what: string, most: number): string =>
  `${what}は、1 つ ${tooLong(most)}`

/**
 * What a form says of a text that has to be written and may be so long:
 * one sentence for a text that is missing and for one that is too long.
 */
export const neededWithin = (what: string, most: number): string =>
  `${what}を、${tooLong(most)}`

/** How long a text may be, as the description of its control says it. */
export const upTo = (most: number): string => `${charactersOf(most)}まで。`

/**
 * The message of a text that may be left empty (`null`), when it is
 * longer than the API takes.
 */
export const tooLongError = (
  text: string | null,
  most: number,
  message: string,
): string | undefined =>
  text !== null && lengthOf(text) > most ? message : undefined

/**
 * The message of a text that has to be written, when it is empty or
 * longer than the API takes.
 */
export const neededError = (
  text: string,
  most: number,
  message: string,
): string | undefined =>
  text === '' || lengthOf(text) > most ? message : undefined

/**
 * What a form says of the texts that may be left empty, under the names of
 * their controls: one that is longer than its length is too long. `text`
 * reads a control, as `null` when it was left empty.
 */
export const lengthErrors = (
  lengths: Readonly<Record<string, number>>,
  text: (name: string) => string | null,
): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(lengths).map(
      ([name, most]): [string, string | undefined] => [
        name,
        tooLongError(text(name), most, tooLong(most)),
      ],
    ),
  )
