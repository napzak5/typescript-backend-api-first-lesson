import { PointMovementReferenceTypeSchema } from '@beauty-salon-backend/generated'
import { asOneString } from '@beauty-salon-shared/i18n'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { customerIdSchema } from '../models/customer'
import {
  type ApiPointAdjustRequest,
  type ApiPointEarnRequest,
  type ApiPointExpireRequest,
  type ApiPointExpiringSearchRequest,
  type ApiPointTransactionSearchRequest,
  type ApiPointUseRequest,
  pointTransactionIdSchema,
} from '../models/point'
import { uuidSchema } from '../shared'
import {
  calendarDate,
  MAX_INTEGER,
  momentInUtc,
  nonBlankText,
  referenceInPairs,
} from './rules'

/**
 * Validation of the requests of the points ledger. The shapes are checked
 * against the generated API types, the limits are those of the database
 * columns, and the remaining rules are business rules.
 *
 * What a request is held to by the customer and by the record it refers
 * to (the balance, whose record it is, whether points were earned on it
 * already) is looked at where the point transaction is written. Whether an
 * expiry date has passed, and how late `processBefore` may be, need the
 * clock (`issuesOfExpiry`, `issuesOfProcessBefore`).
 */

/** The smallest value of an `integer` column. */
const MIN_INTEGER = -2_147_483_648

/** Points that are earned or used: never none. */
const pointsToMove = z.number().int().min(1).max(MAX_INTEGER)

/** The record a movement of points comes from, if any. */
const reference = {
  description: nonBlankText.nullable(),
  referenceType: PointMovementReferenceTypeSchema.nullable(),
  referenceId: uuidSchema.nullable(),
}

export const pointEarnRequestSchema = z
  .strictObject({
    customerId: customerIdSchema,
    points: pointsToMove,
    ...reference,
    expiryDate: calendarDate.nullable(),
  })
  .check(referenceInPairs) satisfies z.ZodType<ApiPointEarnRequest>

/** A request to earn points that passed the rules of its own. */
export type PointEarnRequest = z.infer<typeof pointEarnRequestSchema>

export const pointUseRequestSchema = z
  .strictObject({
    customerId: customerIdSchema,
    points: pointsToMove,
    ...reference,
  })
  .check(referenceInPairs) satisfies z.ZodType<ApiPointUseRequest>

/** A request to use points that passed the rules of its own. */
export type PointUseRequest = z.infer<typeof pointUseRequestSchema>

export const pointAdjustRequestSchema = z
  .strictObject({
    customerId: customerIdSchema,
    points: z
      .number()
      .int()
      .min(MIN_INTEGER)
      .max(MAX_INTEGER)
      .refine((points) => points !== 0, asOneString(ruleMessages.notZero)),
    ...reference,
  })
  .check(referenceInPairs) satisfies z.ZodType<ApiPointAdjustRequest>

/** A request to adjust points that passed the rules of its own. */
export type PointAdjustRequest = z.infer<typeof pointAdjustRequestSchema>

const pointSearch = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: pointTransactionIdSchema.exactOptional(),
  startDate: momentInUtc.exactOptional(),
  endDate: momentInUtc.exactOptional(),
})

/** Two moments in the spelling of `toISOString` compare as text. */
export const pointTransactionSearchRequestSchema = pointSearch.refine(
  ({ startDate, endDate }) =>
    startDate === undefined || endDate === undefined || startDate <= endDate,
  {
    path: ['endDate'],
    message: asOneString(ruleMessages.notEarlierThan('startDate')),
  },
) satisfies z.ZodType<ApiPointTransactionSearchRequest>

/** A search of point transactions that passed the rules of its own. */
export type PointTransactionSearchRequest = z.infer<
  typeof pointTransactionSearchRequestSchema
>

export const pointExpiringSearchRequestSchema = z.strictObject({
  days: z.number().int().min(1).max(365).exactOptional(),
}) satisfies z.ZodType<ApiPointExpiringSearchRequest>

export const pointExpireRequestSchema = z.strictObject({
  customerId: customerIdSchema.nullable(),
  processBefore: calendarDate.nullable(),
}) satisfies z.ZodType<ApiPointExpireRequest>

/** A request to expire points that passed the rules of its own. */
export type PointExpireRequest = z.infer<typeof pointExpireRequestSchema>
