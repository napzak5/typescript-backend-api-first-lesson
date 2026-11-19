/*
 * A keyword that is searched for: kept in the query of the address, so a
 * reload and the way back show the same search.
 */

/** The longest keyword the API takes, of a salon and of a customer alike */
export const LONGEST_KEYWORD = 100

const keywordFrom = (value: string | null): string | undefined => {
  const keyword = (value ?? '').trim()

  return keyword === '' || keyword.length > LONGEST_KEYWORD
    ? undefined
    : keyword
}

/**
 * The keyword in a parameter of the query of an address. A value the API
 * does not take (empty, or too long) is no keyword.
 */
export const keywordIn = (
  query: URLSearchParams,
  parameter: string,
): string | undefined => keywordFrom(query.get(parameter))

/** The keyword that was filled in (the control `keyword` of `KeywordSearch`). */
export const keywordOf = (values: FormData): string | undefined => {
  const value = values.get('keyword')

  return keywordFrom(typeof value === 'string' ? value : null)
}
