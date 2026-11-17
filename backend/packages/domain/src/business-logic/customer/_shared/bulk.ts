import {
  type DomainError,
  DomainErrors,
  type ValidationIssue,
} from '../../../shared'
import { referrerMissing } from './rules'

/**
 * What the requests that name several customers at once share: all of them
 * or none of them are taken, and a fault is reported at the place in the
 * request where it is.
 */

/** The issues of one part of a request, at its place (`path`) in the request. */
export const atPlace = (
  path: string,
  issues: readonly ValidationIssue[],
): ValidationIssue[] =>
  issues.map((issue) => ({
    ...issue,
    field: issue.field === '' ? path : `${path}.${issue.field}`,
  }))

/**
 * The customer that the request names first among some customers. The
 * repository reports only customers the request names; the list of them
 * stands in, should it ever report another.
 */
export const firstAmong = (
  ids: readonly string[],
  among: readonly string[],
): string => ids.find((id) => among.includes(id)) ?? among.join(', ')

/** The customer the request names first among the missing is not found. */
export const customerNotFound = (
  ids: readonly string[],
  missing: readonly string[],
): DomainError => DomainErrors.notFound('Customer', firstAmong(ids, missing))

/**
 * Every part of a request whose referrer is missing, each at its place
 * (`pathOf` the index of the part).
 */
export const referrersNotFound = (
  message: string,
  referrers: readonly (string | null | undefined)[],
  missing: readonly string[],
  pathOf: (index: number) => string,
): DomainError =>
  DomainErrors.validation(
    message,
    referrers.flatMap((referrer, index) =>
      referrer !== undefined && referrer !== null && missing.includes(referrer)
        ? atPlace(pathOf(index), [referrerMissing])
        : [],
    ),
  )

/** The rows in the order of the IDs; an ID without a row is left out. */
export const inOrderOf = <T extends { id: string }>(
  ids: readonly string[],
  rows: readonly T[],
): T[] => {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row === undefined ? [] : [row]
  })
}
