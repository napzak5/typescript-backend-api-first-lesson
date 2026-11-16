import type {
  paymentTransactions,
  sales,
  salesDetails,
} from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const saleIdSchema = uuidSchema.brand<'SaleId'>()
export type SaleId = z.infer<typeof saleIdSchema>

const saleIdParameterSchema = z.object({ id: saleIdSchema })

export const parseSaleId = (id: unknown): Result<SaleId, DomainError> =>
  Result.map(
    parseWith(saleIdParameterSchema, { id }, 'Invalid sale ID'),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiSaleResponse = components['schemas']['Models.SaleResponse']
export type ApiSalesDetail = components['schemas']['Models.SalesDetail']
export type ApiPaymentResponse = components['schemas']['Models.PaymentResponse']
export type ApiSaleCreateRequest =
  components['schemas']['Models.SaleCreateRequest']
export type ApiSaleUpdateRequest =
  components['schemas']['Models.SaleUpdateRequest']
export type ApiSaleVoidRequest = components['schemas']['Models.SaleVoidRequest']
export type ApiSaleReceiptResponse =
  components['schemas']['Models.SaleReceiptResponse']
export type ApiSaleCalculateRequest =
  components['schemas']['Models.SaleCalculateRequest']
export type ApiSaleCalculateResponse =
  components['schemas']['Models.SaleCalculateResponse']
export type ApiSaleSearchRequest = NonNullable<
  operations['SaleCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbSale = DeepRequired<typeof sales.$inferSelect>
export type DbSalesDetail = DeepRequired<typeof salesDetails.$inferSelect>
export type DbPaymentTransaction = DeepRequired<
  typeof paymentTransactions.$inferSelect
>

/**
 * A new sale: every column but the ones the database assigns. Nothing is
 * left to a default, so whoever writes a sale states all of it.
 */
export type DbNewSale = DeepRequired<
  Omit<typeof sales.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
>

/**
 * A new line of a sale. Its sale is missing: the lines are written with
 * their sale, which has no ID before that.
 */
export type DbNewSalesDetail = DeepRequired<
  Omit<typeof salesDetails.$inferInsert, 'id' | 'saleId' | 'createdAt'>
>

/**
 * A sale with its lines, in their order, and the payments made for it, in
 * the order they were made.
 */
export type SaleWithDetails = {
  sale: DbSale
  details: DbSalesDetail[]
  payments: DbPaymentTransaction[]
}

/** What the entry of a sale writes. */
export type SaleWrite = {
  sale: DbNewSale
  details: DbNewSalesDetail[]
}

/**
 * What a correction of a sale writes: the columns that change, and the
 * lines that take the place of every line the sale has, or null when its
 * lines stay. The salon, the number, the payment status and what makes a
 * sale void are not among the columns: no correction changes them.
 */
export type SaleChange = {
  sale: Partial<
    Pick<
      DbNewSale,
      | 'customerId'
      | 'staffId'
      | 'bookingId'
      | 'saleDate'
      | 'saleTime'
      | 'subtotal'
      | 'discountAmount'
      | 'taxAmount'
      | 'totalAmount'
      | 'pointsUsed'
      | 'pointsEarned'
      | 'notes'
    >
  >
  details: DbNewSalesDetail[] | null
}
