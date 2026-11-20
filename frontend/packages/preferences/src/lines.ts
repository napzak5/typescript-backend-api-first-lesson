import * as z from 'zod/mini'

/*
 * A list that a person writes a line each: colours, styles, the addresses
 * of pictures. The control is a text of several lines.
 */

/** How many characters the API takes of the address of a picture */
const MAX_PICTURE_ADDRESS_LENGTH = 500

/**
 * The entries of a list that is written a line each: without the spaces
 * around them, without the empty lines, and each once. (The API takes no
 * entry twice.)
 */
export const linesOf = (text: string): string[] => [
  ...new Set(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  ),
]

/** An address of the web as the API takes it for a picture. */
const pictureAddressSchema = z
  .httpUrl()
  .check(z.maxLength(MAX_PICTURE_ADDRESS_LENGTH))

/**
 * What is wrong with the addresses of pictures that were written a line
 * each: the first line that is no address the API takes, by the number a
 * person counts it with.
 */
export const pictureAddressesError = (text: string): string | undefined => {
  const wrong = text
    .split('\n')
    .map((line) => line.trim())
    .findIndex(
      (line) => line !== '' && !pictureAddressSchema.safeParse(line).success,
    )

  return wrong === -1
    ? undefined
    : `${wrong + 1} 行目を確かめてください。http:// または https:// で始まる URL を、${MAX_PICTURE_ADDRESS_LENGTH} 文字以内で書いてください。`
}
