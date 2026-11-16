/**
 * The symbols of Crockford's Base32: the digits and the capital letters
 * without I, L, O and U, which are mistaken for 1 and 0 when a number is
 * read out or typed.
 */
const SYMBOLS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const GROUPS = 2
const SYMBOLS_OF_A_GROUP = 4

/**
 * A number by which people name a record, `<prefix>-XXXX-XXXX`, from
 * whoever picks its symbols: `pick` is asked eight times for one of `count`
 * symbols and answers with an integer from 0 up to `count`, which is not
 * one of them.
 */
export const recordNumberFrom = (
  prefix: string,
  pick: (count: number) => number,
): string =>
  [
    prefix,
    ...Array.from({ length: GROUPS }, () =>
      Array.from({ length: SYMBOLS_OF_A_GROUP }, () =>
        SYMBOLS.charAt(pick(SYMBOLS.length)),
      ).join(''),
    ),
  ].join('-')
