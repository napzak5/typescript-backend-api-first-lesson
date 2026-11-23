import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { CalculatedSale } from '../../business-logic/sale/_shared/calculation'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiSaleCalculateResponse,
  ApiSaleReceiptResponse,
  ApiSaleResponse,
  ApiSalesDetail,
  DbSalesDetail,
  SaleId,
  SaleWithDetails,
} from '../../models/sale'
import type { SaleList } from '../../repositories/sale.repository'
import { type DomainError, parseStored } from '../../shared'
import { numericSchema, timestampSchema } from './columns'
import { toApiPage } from './page'
import { toApiPayment } from './payment.mapper'

/**
 * Database rows → API response. Property names are the column names; what
 * changes is the representation of the `timestamptz` columns, which are
 * read in PostgreSQL's text format and returned as ISO 8601, and of the
 * `numeric` commission rate, which is read as text and returned as a
 * number.
 *
 * Every property is named, so a column added to one of the tables is not
 * shown by itself. The payments of a sale are mapped as a payment is
 * (`payment.mapper.ts`).
 *
 * What is made of a sale and stored nowhere is an answer of this mapper
 * too: the receipt of a sale, and what a sale would come to before it is
 * entered.
 */

const convertedDetailColumnsSchema = z.object({
  commissionRate: numericSchema.nullable(),
}) satisfies z.ZodType<Pick<ApiSalesDetail, 'commissionRate'>>

const convertedSaleColumnsSchema = z.object({
  saleTime: timestampSchema,
  voidedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiSaleResponse, 'saleTime' | 'voidedAt' | 'createdAt' | 'updatedAt'>
>

/** `description` says which sale the line is read with. */
const toApiSalesDetail = (
  detail: DbSalesDetail,
  description: string,
): Result<ApiSalesDetail, DomainError> =>
  Result.map(
    parseStored(convertedDetailColumnsSchema, detail, description),
    (converted) => ({
      itemType: detail.itemType,
      itemId: detail.itemId,
      itemName: detail.itemName,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      discountAmount: detail.discountAmount,
      taxAmount: detail.taxAmount,
      totalAmount: detail.totalAmount,
      staffId: detail.staffId,
      commissionRate: converted.commissionRate,
      commissionAmount: detail.commissionAmount,
      notes: detail.notes,
      sortOrder: detail.sortOrder,
    }),
  )

/** Maps the rows one after the other; the first that does not match is the answer. */
const each = <Row, Mapped>(
  rows: readonly Row[],
  map: (row: Row) => Result<Mapped, DomainError>,
): Result<Mapped[], DomainError> => {
  const all: Mapped[] = []
  for (const row of rows) {
    const mapped = map(row)
    if (mapped.type === 'error') {
      return mapped
    }
    all.push(mapped.data)
  }
  return Result.success(all)
}

const toApiSale = ({
  sale,
  details,
  payments,
}: SaleWithDetails): Result<ApiSaleResponse, DomainError> => {
  // The lines and the payments are read with the sale: what does not match is told of the sale.
  const description = `Stored sale ${sale.id} does not match the API model`

  return Result.flatMap(
    parseStored(convertedSaleColumnsSchema, sale, description),
    (converted) =>
      Result.flatMap(
        each(details, (detail) => toApiSalesDetail(detail, description)),
        (apiDetails) =>
          Result.map(
            each(payments, (payment) => toApiPayment(payment, description)),
            (apiPayments) => ({
              id: sale.id,
              saleNumber: sale.saleNumber,
              salonId: sale.salonId,
              customerId: sale.customerId,
              staffId: sale.staffId,
              bookingId: sale.bookingId,
              saleDate: sale.saleDate,
              saleTime: converted.saleTime,
              subtotal: sale.subtotal,
              discountAmount: sale.discountAmount,
              taxAmount: sale.taxAmount,
              totalAmount: sale.totalAmount,
              pointsUsed: sale.pointsUsed,
              pointsEarned: sale.pointsEarned,
              paymentStatus: sale.paymentStatus,
              isVoid: sale.isVoid,
              voidedAt: converted.voidedAt,
              voidReason: sale.voidReason,
              notes: sale.notes,
              details: apiDetails,
              payments: apiPayments,
              createdAt: converted.createdAt,
              updatedAt: converted.updatedAt,
            }),
          ),
      ),
  )
}

export const SaleReadMapper = {
  toApiSale,

  toApiSales(sales: SaleWithDetails[]): Result<ApiSaleResponse[], DomainError> {
    return each(sales, toApiSale)
  },

  /** The sales a list found as a page of it. */
  toApiSalePage(
    { sales, total, hasMore }: SaleList,
    paging: Paging<SaleId>,
  ): Result<ApiPage<ApiSaleResponse>, DomainError> {
    return Result.map(SaleReadMapper.toApiSales(sales), (data) =>
      toApiPage(data, { total, hasMore }, paging),
    )
  },

  /**
   * The receipt of a sale: the sale under its own number, and the moment
   * the receipt was made, which is another one whenever it is asked for.
   */
  toApiSaleReceipt(
    sale: SaleWithDetails,
    issuedAt: Date,
  ): Result<ApiSaleReceiptResponse, DomainError> {
    return Result.map(toApiSale(sale), (apiSale) => ({
      receiptNumber: apiSale.saleNumber,
      sale: apiSale,
      issuedAt: issuedAt.toISOString(),
    }))
  },

  /** What a sale would come to, as it was calculated. */
  toApiSaleCalculation({
    salonId,
    bookingId,
    breakdown,
    recommendedMethods,
  }: CalculatedSale): ApiSaleCalculateResponse {
    return {
      salonId,
      bookingId,
      breakdown: {
        subtotal: breakdown.subtotal,
        discountAmount: breakdown.discountAmount,
        taxAmount: breakdown.taxAmount,
        totalAmount: breakdown.totalAmount,
      },
      recommendedMethods,
    }
  },
}
