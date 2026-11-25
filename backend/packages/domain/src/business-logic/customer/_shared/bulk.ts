import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
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

/**
 * The issues of one part of a request, at its place (`path`) in the
 * request. Each of them is of a property of the part.
 */
export const atPlace = (
  path: string,
  issues: readonly ValidationIssue[],
): ValidationIssue[] =>
  issues.map((issue) => ({ ...issue, field: `${path}.${issue.field}` }))

/** The customer of the ID is not found. */
export const customerNotFound = (id: string): DomainError =>
  DomainErrors.notFound(entityMessages.customer, id)

/**
 * Every part of a request whose referrer is missing, each at its place
 * (`pathOf` the index of the part).
 */
export const referrersNotFound = (
  message: LocalizedText,
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

/** The rows of the IDs, in the order of the IDs. */
export const inOrderOf = <T extends { id: string }>(
  ids: readonly string[],
  rows: readonly T[],
): T[] => rows.toSorted((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
