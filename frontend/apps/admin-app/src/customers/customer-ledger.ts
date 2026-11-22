import type {
  CustomerCrudListParams,
  ModelsCustomerStatusType,
  ModelsMembershipTierType,
} from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/fields'
import {
  dayAfter,
  daysErrorsOf,
  keywordIn,
  LONGEST_KEYWORD,
  startOfDayAt,
} from '@beauty-salon-frontend/salon-screens'
import { type FormRead, textOf } from '@beauty-salon-frontend/ui'
import { CUSTOMER_STATUSES, TIERS } from './customer-format'

/**
 * Which customers the ledger shows. The names are those of the query of
 * the address the ledger is kept in; the days are those of the clock of
 * the salon.
 */
export type CustomerConditions = {
  /** Part of a name, of the kana, of an address of mail or of a phone number */
  search?: string
  /** The tags a customer has every one of; none narrows nothing */
  tags: string[]
  /** The first day a customer was registered on */
  from?: string
  /** The last day a customer was registered on; not before the first */
  to?: string
  customerStatus?: ModelsCustomerStatusType
  membershipTier?: ModelsMembershipTierType
}

const statusFrom = (value: string): ModelsCustomerStatusType | undefined =>
  CUSTOMER_STATUSES.find((status) => status === value)

const tierFrom = (value: string): ModelsMembershipTierType | undefined =>
  TIERS.find((tier) => tier === value)

/** Tags as they are written, each once and in the order they came: the API takes a tag once. */
const distinctTags = (tags: readonly string[]): string[] => [
  ...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag !== '')),
]

/**
 * The tags of a text that holds them: separated by commas, of either
 * width. Nothing between two commas is no tag, and a tag written twice is
 * one.
 */
export const tagsIn = (text: string): string[] =>
  distinctTags(text.split(/[,、，]/))

/** The tags as a person writes them, the way they are read: 「VIP、常連」. */
export const tagsTextOf = (tags: readonly string[]): string => tags.join('、')

/** The days of a range that are days, the end not before the start. */
const rangeOf = (
  from: string | undefined,
  to: string | undefined,
): Pick<CustomerConditions, 'from' | 'to'> => ({
  ...(from === undefined ? {} : { from }),
  ...(to === undefined || (from !== undefined && to < from) ? {} : { to }),
})

const dayOrNothing = (text: string | null): string | undefined =>
  text !== null && isDay(text) ? text : undefined

/**
 * The conditions in the query of an address. What the API does not take is
 * no condition: a day that is none, an end before the start, a state that
 * is none. An address that somebody changed by hand shows what is left of
 * it.
 */
export const customerConditionsIn = (
  query: URLSearchParams,
): CustomerConditions => {
  const search = keywordIn(query, 'search')
  const customerStatus = statusFrom(query.get('customerStatus') ?? '')
  const membershipTier = tierFrom(query.get('membershipTier') ?? '')

  return {
    ...(search === undefined ? {} : { search }),
    tags: distinctTags(query.getAll('tags')),
    ...rangeOf(dayOrNothing(query.get('from')), dayOrNothing(query.get('to'))),
    ...(customerStatus === undefined ? {} : { customerStatus }),
    ...(membershipTier === undefined ? {} : { membershipTier }),
  }
}

const KEYWORD_ERROR = `キーワードは ${LONGEST_KEYWORD} 文字以内で入力してください。`

/** The conditions that were filled in: every one may be left empty, and the end comes not before the start. */
export const readCustomerConditions = (
  values: FormData,
): FormRead<CustomerConditions> => {
  const search = textOf(values, 'search').trim()
  const from = textOf(values, 'from').trim()
  const to = textOf(values, 'to').trim()
  const errors: Record<string, string> = {
    ...(search.length > LONGEST_KEYWORD ? { search: KEYWORD_ERROR } : {}),
    ...daysErrorsOf(from, to, 'optional'),
  }
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  const customerStatus = statusFrom(textOf(values, 'customerStatus'))
  const membershipTier = tierFrom(textOf(values, 'membershipTier'))

  return {
    type: 'valid',
    value: {
      ...(search === '' ? {} : { search }),
      tags: tagsIn(textOf(values, 'tags')),
      ...rangeOf(from === '' ? undefined : from, to === '' ? undefined : to),
      ...(customerStatus === undefined ? {} : { customerStatus }),
      ...(membershipTier === undefined ? {} : { membershipTier }),
    },
  }
}

/**
 * The query that keeps conditions in an address: the same conditions are
 * the same address, whatever order they were filled in.
 */
export const customerQueryOf = ({
  search,
  tags,
  from,
  to,
  customerStatus,
  membershipTier,
}: CustomerConditions): URLSearchParams =>
  new URLSearchParams([
    ...(search === undefined ? [] : [['search', search]]),
    ...tags.map((tag) => ['tags', tag]),
    ...(from === undefined ? [] : [['from', from]]),
    ...(to === undefined ? [] : [['to', to]]),
    ...(customerStatus === undefined
      ? []
      : [['customerStatus', customerStatus]]),
    ...(membershipTier === undefined
      ? []
      : [['membershipTier', membershipTier]]),
  ])

/** Whether the conditions narrow the ledger at all. */
export const isNarrowed = (conditions: CustomerConditions): boolean =>
  customerQueryOf(conditions).toString() !== ''

/** The first and the last moment the API takes for a registration */
const EARLIEST_MOMENT = '1900-01-01T00:00:00.000Z'
const LATEST_MOMENT = '2999-12-31T23:59:59.999Z'

/**
 * What the API is asked for: the days of the salon as the moments they
 * begin and end. The API compares the moments of the registrations to the
 * millisecond, so a day ends a millisecond before the next begins. A
 * moment the API does not take is the nearest one it does.
 */
export const customerListParamsOf = (
  {
    search,
    tags,
    from,
    to,
    customerStatus,
    membershipTier,
  }: CustomerConditions,
  timezone: string,
): Omit<CustomerCrudListParams, 'cursor' | 'limit'> => {
  const start = from === undefined ? undefined : startOfDayAt(from, timezone)
  const next =
    to === undefined ? undefined : startOfDayAt(dayAfter(to, 1), timezone)
  const end =
    next === undefined
      ? undefined
      : new Date(Date.parse(next) - 1).toISOString()

  return {
    ...(search === undefined ? {} : { search }),
    ...(tags.length === 0 ? {} : { tags }),
    ...(start === undefined
      ? {}
      : { registeredFrom: start < EARLIEST_MOMENT ? EARLIEST_MOMENT : start }),
    ...(end === undefined
      ? {}
      : { registeredTo: end > LATEST_MOMENT ? LATEST_MOMENT : end }),
    ...(customerStatus === undefined ? {} : { customerStatus }),
    ...(membershipTier === undefined ? {} : { membershipTier }),
  }
}
