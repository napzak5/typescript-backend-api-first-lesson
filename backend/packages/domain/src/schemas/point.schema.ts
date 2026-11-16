import { PointReferenceTypeSchema } from '@beauty-salon-backend/generated'
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
import { MAX_INTEGER, momentInUtc, nonBlankText } from './rules'

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
  referenceType: PointReferenceTypeSchema.nullable(),
  referenceId: uuidSchema.nullable(),
}

/**
 * A reference is a kind and an ID together, or neither: an ID alone does
 * not say which table it is of. The one that is missing is reported.
 */
const referenceInPairs = (
  context: z.core.ParsePayload<{
    referenceType: string | null
    referenceId: string | null
  }>,
): void => {
  const { referenceType, referenceId } = context.value
  if ((referenceType === null) === (referenceId === null)) {
    return
  }
  const [field, other] =
    referenceType === null
      ? ['referenceType', 'referenceId']
      : ['referenceId', 'referenceType']
  context.issues.push({
    code: 'custom',
    path: [field],
    message: `Must not be null when ${other} is given`,
    input: null,
    continue: true,
  })
}

export const pointEarnRequestSchema = z
  .strictObject({
    customerId: customerIdSchema,
    points: pointsToMove,
    ...reference,
    expiryDate: z.iso.date().nullable(),
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
      .refine((points) => points !== 0, 'Must not be 0'),
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
  { path: ['endDate'], message: 'Must not be earlier than startDate' },
) satisfies z.ZodType<ApiPointTransactionSearchRequest>

export const pointExpiringSearchRequestSchema = z.strictObject({
  days: z.number().int().min(1).max(365).exactOptional(),
}) satisfies z.ZodType<ApiPointExpiringSearchRequest>

export const pointExpireRequestSchema = z.strictObject({
  customerId: customerIdSchema.nullable(),
  processBefore: z.iso.date().nullable(),
}) satisfies z.ZodType<ApiPointExpireRequest>

export type PointExpireRequest = z.infer<typeof pointExpireRequestSchema>
