import * as z from 'zod/mini'
import { lengthOf, tooLong, upTo } from './lengths'

/*
 * The addresses of the web a form takes, and the address a link may go
 * to. The API takes an address of `http` or `https` at a domain name: one
 * at `localhost`, at a machine by its number or at a name without a dot is
 * none. Every form checks an address here, and says the same sentence of
 * one that is none.
 */

/**
 * How many characters the API takes of an address that stands alone, and
 * of an address of the lists that have a length.
 */
export const LONGEST_WEB_ADDRESS = 500

const webAddressSchema = z.httpUrl()

const WEB_ADDRESS =
  'http:// か https:// で始まる、ドメイン名（example.com など）の URL'

/**
 * What a form says of an address that is none the API takes. `longest` is
 * `null` where the API takes an address of any length (the pictures of a
 * salon and of a service, which are lists).
 */
export const notWebAddress = (longest: number | null): string =>
  longest === null
    ? `${WEB_ADDRESS} を入力してください。`
    : `${WEB_ADDRESS} を、${tooLong(longest)}`

/** The same of an address that stands alone. */
export const WEB_ADDRESS_ERROR = notWebAddress(LONGEST_WEB_ADDRESS)

/** What the description of a control says of the address it takes. */
export const WEB_ADDRESS_DESCRIPTION = `http:// か https:// で始まる URL。${upTo(LONGEST_WEB_ADDRESS)}`

const isWebAddress = (text: string, longest: number | null): boolean =>
  webAddressSchema.safeParse(text).success &&
  (longest === null || lengthOf(text) <= longest)

/**
 * The message of an address that may be left empty (`null`), when it is
 * none the API takes.
 */
export const webAddressError = (address: string | null): string | undefined =>
  address === null || isWebAddress(address, LONGEST_WEB_ADDRESS)
    ? undefined
    : WEB_ADDRESS_ERROR

/**
 * What is wrong with addresses that were written a line each: the first
 * line that is no address the API takes, by the number a person counts it
 * with. A line that holds nothing is none to check. `longest` is `null`
 * for a list whose addresses may be of any length.
 */
export const webAddressLinesError = (
  text: string,
  longest: number | null,
): string | undefined => {
  const wrong = text
    .split('\n')
    .map((line) => line.trim())
    .findIndex((line) => line !== '' && !isWebAddress(line, longest))

  return wrong === -1
    ? undefined
    : `${wrong + 1} 行目を確かめてください。${notWebAddress(longest)}`
}

/**
 * The address a link may go to: one of the web (`http`, `https`). Any other
 * text, such as a note written where an address would be, is `null`, and
 * is shown as text.
 */
export const webAddressOf = (url: string): string | null =>
  /^https?:\/\//i.test(url) ? url : null
