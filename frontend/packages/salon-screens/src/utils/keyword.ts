import { tooLongError, tooLongOf } from '@beauty-salon-frontend/fields'
import { inJapaneseIfAny, writtenInJapanese } from '@beauty-salon-frontend/ui'

/*
 * A keyword that is searched for: kept in the query of the address, so a
 * reload and the way back show the same search.
 */

/** The longest keyword the API takes, of a salon and of a customer alike */
export const LONGEST_KEYWORD = 100

const KEYWORD_TOO_LONG = tooLongOf(
  writtenInJapanese('キーワード'),
  LONGEST_KEYWORD,
)

/**
 * What is wrong with the keyword of a search with other conditions, which
 * says at its control what it does not take: none when nothing is. A
 * keyword that was left empty is no keyword, and nothing is wrong with it.
 */
export const keywordError = (keyword: string): string | undefined =>
  inJapaneseIfAny(tooLongError(keyword, LONGEST_KEYWORD, KEYWORD_TOO_LONG))

const keywordFrom = (value: string | null): string | undefined => {
  const keyword = (value ?? '').trim()

  return keyword === '' || keywordError(keyword) !== undefined
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
