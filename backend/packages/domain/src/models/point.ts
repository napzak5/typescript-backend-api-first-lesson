import type { customerPoints } from '@beauty-salon-backend/database'
import type {
  components,
  operations,
  PointMovementReferenceType,
} from '@beauty-salon-backend/generated'
import type { DeepRequired } from '@beauty-salon-backend/utility'
import type { z } from 'zod'
import { uuidSchema } from '../shared'
import type { CustomerId } from './customer'

// ID: a UUID that has been checked.
export const pointTransactionIdSchema = uuidSchema.brand<'PointTransactionId'>()
export type PointTransactionId = z.infer<typeof pointTransactionIdSchema>

// API types, generated from TypeSpec
export type ApiPointTransactionResponse =
  components['schemas']['Models.PointTransactionResponse']
export type ApiPointBalanceResponse =
  components['schemas']['Models.PointBalanceResponse']
export type ApiPointEarnRequest =
  components['schemas']['Models.PointEarnRequest']
export type ApiPointUseRequest = components['schemas']['Models.PointUseRequest']
export type ApiPointAdjustRequest =
  components['schemas']['Models.PointAdjustRequest']
export type ApiPointTransactionSearchRequest = NonNullable<
  operations['PointCrud_listTransactions']['parameters']['query']
>
export type ApiPointExpiringResponse =
  components['schemas']['Models.PointExpiringResponse']
export type ApiPointExpiringSearchRequest = NonNullable<
  operations['PointCrud_getExpiring']['parameters']['query']
>
export type ApiPointExpireRequest =
  components['schemas']['Models.PointExpireRequest']
export type ApiPointExpireResponse =
  components['schemas']['Models.PointExpireResponse']

// Database types, inferred from the Drizzle schema
export type DbPointTransaction = DeepRequired<
  typeof customerPoints.$inferSelect
>

/**
 * What a movement of points writes: the point transaction without its ID
 * and its time, which are the database's when the row is written. The
 * balance after it is written to the customer as well.
 */
export type PointWrite = Pick<
  DbPointTransaction,
  | 'customerId'
  | 'transactionType'
  | 'points'
  | 'balance'
  | 'description'
  | 'referenceType'
  | 'referenceId'
  | 'expiryDate'
>

/**
 * The points a request moves: whose, how many, and the record they come
 * from, if any. An adjustment may take points away; no movement is of 0.
 */
export type RequestedPoints = {
  customerId: CustomerId
  points: number
  description: string | null
  referenceType: PointMovementReferenceType | null
  referenceId: string | null
}

/** The points a request gives a customer, with the day they lapse, if any. */
export type RequestedPointEarning = RequestedPoints & {
  expiryDate: string | null
}

/**
 * The expiry a request asks for: of one customer or of every customer
 * (null), for the points that lapsed before a day or before the latest
 * day there is (null).
 */
export type RequestedPointExpiry = {
  customerId: CustomerId | null
  processBefore: string | null
}
