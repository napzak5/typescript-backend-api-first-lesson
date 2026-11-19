/** The longest keyword the API takes */
export const LONGEST_KEYWORD = 100

const keywordFrom = (value: string | null): string | undefined => {
  const keyword = (value ?? '').trim()

  return keyword === '' || keyword.length > LONGEST_KEYWORD
    ? undefined
    : keyword
}

/**
 * The keyword in the query of an address. A value the API does not take
 * (empty, or too long) is no keyword: every salon is listed.
 */
export const keywordIn = (query: URLSearchParams): string | undefined =>
  keywordFrom(query.get('keyword'))

/** The keyword that was filled in. */
export const keywordOf = (values: FormData): string | undefined => {
  const value = values.get('keyword')

  return keywordFrom(typeof value === 'string' ? value : null)
}

/** The query that keeps a keyword in an address. */
export const queryOfKeyword = (keyword: string | undefined): URLSearchParams =>
  new URLSearchParams(keyword === undefined ? [] : [['keyword', keyword]])
