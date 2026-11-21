import type { ModelsReviewSortType } from '@beauty-salon-frontend/api-client'
import { type Read, textOf } from '@beauty-salon-frontend/salon-screens'
import * as z from 'zod'
import type { ReviewListParams } from './reviews-api'

/*
 * Which reviews of a salon the list shows, and in what order, kept in the
 * query of the address: a reload, the way back from a review and an
 * address that is passed on show the same reviews.
 */

/** The orders other than the latest first, which is the order of the list when none is asked for */
type ReviewOrder = Exclude<ModelsReviewSortType, 'recent'>

export type ReviewConditions = {
  /** The lowest overall rating, from 1 to 5 */
  minRating?: number
  /** The highest overall rating, from 1 to 5 */
  maxRating?: number
  /** The member of the staff the reviews rate */
  staff?: string
  order?: ReviewOrder
}

/** The ratings a review gives, the highest first */
export const RATINGS: readonly number[] = [5, 4, 3, 2, 1]

const ORDERS: readonly ReviewOrder[] = ['rating', 'helpful']

const idSchema = z.uuid()

const ratingFrom = (value: string): number | undefined =>
  RATINGS.find((rating) => `${rating}` === value)

const orderFrom = (value: string): ReviewOrder | undefined =>
  ORDERS.find((order) => order === value)

const staffFrom = (value: string): string | undefined =>
  idSchema.safeParse(value).success ? value.toLowerCase() : undefined

/**
 * The conditions in the query of an address. What the API does not take is
 * no condition: a rating that is none, a member that is no ID, and a
 * highest rating below the lowest.
 */
export const reviewConditionsIn = (
  query: URLSearchParams,
): ReviewConditions => {
  const minRating = ratingFrom(query.get('min') ?? '')
  const highest = ratingFrom(query.get('max') ?? '')
  const maxRating =
    highest !== undefined && (minRating === undefined || highest >= minRating)
      ? highest
      : undefined
  const staff = staffFrom(query.get('staff') ?? '')
  const order = orderFrom(query.get('sort') ?? '')

  return {
    ...(minRating === undefined ? {} : { minRating }),
    ...(maxRating === undefined ? {} : { maxRating }),
    ...(staff === undefined ? {} : { staff }),
    ...(order === undefined ? {} : { order }),
  }
}

const RANGE_ERROR = '評価の上限は、下限と同じか、それより高くしてください。'

/** The conditions that were chosen: each may be left as it is, for every review. */
export const readReviewConditions = (
  values: FormData,
): Read<ReviewConditions> => {
  const minRating = ratingFrom(textOf(values, 'min'))
  const maxRating = ratingFrom(textOf(values, 'max'))
  if (
    minRating !== undefined &&
    maxRating !== undefined &&
    maxRating < minRating
  ) {
    return { type: 'invalid', errors: { max: RANGE_ERROR } }
  }
  const staff = staffFrom(textOf(values, 'staff'))
  const order = orderFrom(textOf(values, 'sort'))

  return {
    type: 'valid',
    request: {
      ...(minRating === undefined ? {} : { minRating }),
      ...(maxRating === undefined ? {} : { maxRating }),
      ...(staff === undefined ? {} : { staff }),
      ...(order === undefined ? {} : { order }),
    },
  }
}

/**
 * The query that keeps conditions in an address: the same conditions are
 * the same address, whatever order they were chosen in.
 */
export const reviewQueryOf = ({
  minRating,
  maxRating,
  staff,
  order,
}: ReviewConditions): URLSearchParams =>
  new URLSearchParams([
    ...(minRating === undefined ? [] : [['min', `${minRating}`]]),
    ...(maxRating === undefined ? [] : [['max', `${maxRating}`]]),
    ...(staff === undefined ? [] : [['staff', staff]]),
    ...(order === undefined ? [] : [['sort', order]]),
  ])

/** Whether the conditions narrow the list: an order alone narrows nothing. */
export const isNarrowed = ({
  minRating,
  maxRating,
  staff,
}: ReviewConditions): boolean =>
  minRating !== undefined || maxRating !== undefined || staff !== undefined

/** What the API is asked for. */
export const reviewListParamsOf = ({
  minRating,
  maxRating,
  staff,
  order,
}: ReviewConditions): ReviewListParams => ({
  ...(minRating === undefined ? {} : { minRating }),
  ...(maxRating === undefined ? {} : { maxRating }),
  ...(staff === undefined ? {} : { staffId: staff }),
  ...(order === undefined ? {} : { sortBy: order }),
})
