import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiSaleResponse,
  ApiSalesDetail,
  DbSalesDetail,
  SaleWithDetails,
} from '../../models/sale'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'
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
 */

const convertedDetailColumnsSchema = z.object({
  commissionRate: numericSchema.nullable(),
})

const convertedSaleColumnsSchema = z.object({
  saleTime: timestampSchema,
  voidedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const toApiSalesDetail = (
  detail: DbSalesDetail,
): Result<ApiSalesDetail, DomainError> =>
  Result.map(
    parseWith(
      convertedDetailColumnsSchema,
      detail,
      'Invalid stored sales detail',
    ),
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
}: SaleWithDetails): Result<ApiSaleResponse, DomainError> =>
  Result.mapError(
    Result.flatMap(
      parseWith(convertedSaleColumnsSchema, sale, 'Invalid stored sale'),
      (converted) =>
        Result.flatMap(each(details, toApiSalesDetail), (apiDetails) =>
          Result.map(each(payments, toApiPayment), (apiPayments) => ({
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
          })),
        ),
    ),
    // The request was fine; the stored rows are not.
    (error) =>
      DomainErrors.database(
        `Stored sale ${sale.id} does not match the API model`,
        error,
      ),
  )

export const SaleReadMapper = {
  toApiSale,

  toApiSales(sales: SaleWithDetails[]): Result<ApiSaleResponse[], DomainError> {
    return each(sales, toApiSale)
  },
}
