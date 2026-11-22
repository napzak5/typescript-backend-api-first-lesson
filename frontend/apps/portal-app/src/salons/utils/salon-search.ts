import { lengthOf } from '@beauty-salon-frontend/fields'
/**
 * What a visitor looks for. A condition that is absent narrows nothing. The
 * names are those of the parameters of the API, and of the query of the
 * address the search is kept in.
 */
export type SalonConditions = {
  /** Part of the name or of the description */
  keyword?: string
  /** The whole name of the prefecture, as the salon wrote it */
  prefecture?: string
  /** The whole name of the city, as the salon wrote it */
  city?: string
  /** The lowest mean of the ratings; a salon nobody rated is left out */
  minRating?: number
}

/** The longest value the API takes for each text */
export const LONGEST = { keyword: 100, prefecture: 50, city: 100 }

/** The ratings a visitor can ask for at least */
export const MIN_RATINGS: readonly number[] = [3, 3.5, 4, 4.5]

const boundedTextOf = (
  value: string | null,
  longest: number,
): string | undefined => {
  const text = (value ?? '').trim()

  return text === '' || lengthOf(text) > longest ? undefined : text
}

const minRatingOf = (value: string | null): number | undefined =>
  MIN_RATINGS.find((rating) => String(rating) === value)

/**
 * Reads conditions from where they are written, and keeps what the API
 * takes: a value that is empty, too long or no rating on offer is no
 * condition. An address that somebody changed by hand is searched for what
 * is left of it, and not answered with an error.
 */
const conditionsFrom = (
  read: (name: keyof SalonConditions) => string | null,
): SalonConditions => {
  const keyword = boundedTextOf(read('keyword'), LONGEST.keyword)
  const prefecture = boundedTextOf(read('prefecture'), LONGEST.prefecture)
  const city = boundedTextOf(read('city'), LONGEST.city)
  const minRating = minRatingOf(read('minRating'))

  return {
    ...(keyword === undefined ? {} : { keyword }),
    ...(prefecture === undefined ? {} : { prefecture }),
    ...(city === undefined ? {} : { city }),
    ...(minRating === undefined ? {} : { minRating }),
  }
}

/** The conditions in the query of an address. */
export const conditionsIn = (query: URLSearchParams): SalonConditions =>
  conditionsFrom((name) => query.get(name))

/** The conditions a visitor filled in. */
export const conditionsOf = (values: FormData): SalonConditions =>
  conditionsFrom((name) => {
    const value = values.get(name)

    return typeof value === 'string' ? value : null
  })

/**
 * The query that keeps the conditions in an address: the same conditions
 * are the same address, whatever order they were filled in.
 */
export const queryOf = (conditions: SalonConditions): URLSearchParams =>
  new URLSearchParams(
    Object.entries({
      keyword: conditions.keyword,
      prefecture: conditions.prefecture,
      city: conditions.city,
      minRating: conditions.minRating,
    }).flatMap(([name, value]) =>
      value === undefined ? [] : [[name, String(value)]],
    ),
  )

/** Whether anything narrows the search. */
export const narrows = (conditions: SalonConditions): boolean =>
  Object.keys(conditions).length > 0
