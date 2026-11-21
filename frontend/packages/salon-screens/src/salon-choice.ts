/** The parameter of the address that holds the keyword of the salons */
export const KEYWORD = 'keyword'

/** The query that keeps a keyword in an address. */
export const queryOfKeyword = (keyword: string | undefined): URLSearchParams =>
  new URLSearchParams(keyword === undefined ? [] : [[KEYWORD, keyword]])
