import type { customerPoints } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import type { DeepRequired } from '@beauty-salon-backend/utility'
import type { z } from 'zod'
import { uuidSchema } from '../shared'

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
