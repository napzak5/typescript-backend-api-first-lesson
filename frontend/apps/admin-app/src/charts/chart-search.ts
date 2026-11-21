import {
  keywordIn,
  LONGEST_KEYWORD,
  type Read,
  textOf,
} from '@beauty-salon-frontend/salon-screens'
import type { SelectOption } from '@beauty-salon-frontend/ui'
import type { ChartConditions } from './charts-api'

/*
 * Which charts the search shows, kept in the query of the address: a
 * reload, the way back from a chart and an address that is passed on show
 * the same charts.
 */

type Allergies = NonNullable<ChartConditions['allergies']>

const ALLERGIES: readonly Allergies[] = ['with', 'without']

/** The choices of the allergies recorded of the customer */
export const ALLERGY_OPTIONS: readonly SelectOption[] = [
  { value: 'with', label: 'ある' },
  { value: 'without', label: 'ない' },
]

const allergiesFrom = (value: string | null): Allergies | undefined =>
  ALLERGIES.find((allergies) => allergies === value)

/** The conditions in the query of an address: what the API does not take is no condition. */
export const chartConditionsIn = (query: URLSearchParams): ChartConditions => {
  const search = keywordIn(query, 'search')
  const allergies = allergiesFrom(query.get('allergies'))

  return {
    ...(search === undefined ? {} : { search }),
    ...(allergies === undefined ? {} : { allergies }),
  }
}

const KEYWORD_ERROR = `キーワードは ${LONGEST_KEYWORD} 文字以内で入力してください。`

/** The conditions that were filled in: each may be left empty. */
export const readChartConditions = (
  values: FormData,
): Read<ChartConditions> => {
  const search = textOf(values, 'search').trim()
  if (search.length > LONGEST_KEYWORD) {
    return { type: 'invalid', errors: { search: KEYWORD_ERROR } }
  }
  const allergies = allergiesFrom(textOf(values, 'allergies'))

  return {
    type: 'valid',
    request: {
      ...(search === '' ? {} : { search }),
      ...(allergies === undefined ? {} : { allergies }),
    },
  }
}

/** The query that keeps conditions in an address: the same conditions are the same address. */
export const chartQueryOf = ({
  search,
  allergies,
}: ChartConditions): URLSearchParams =>
  new URLSearchParams([
    ...(search === undefined ? [] : [['search', search]]),
    ...(allergies === undefined ? [] : [['allergies', allergies]]),
  ])
