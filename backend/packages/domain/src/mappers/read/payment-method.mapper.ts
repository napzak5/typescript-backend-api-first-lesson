import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiPaymentMethodResponse,
  DbPaymentMethod,
  PaymentMethodId,
} from '../../models/payment-method'
import type { PaymentMethodList } from '../../repositories/payment-method.repository'
import { type DomainError, parseStored } from '../../shared'
import { numericSchema, timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * A row of `payment_methods` → API response. Property names are the column
 * names; what changes is the representation of the `numeric` fee, which is
 * read as text and returned as a number, and of the timestamps, from
 * PostgreSQL's text format to ISO 8601.
 *
 * Every property is named: the settings of a payment processor
 * (`processorConfig`) are not shown, and a column added to the table is not
 * shown by itself.
 */

const convertedColumnsSchema = z.object({
  fee: numericSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiPaymentMethodResponse, 'fee' | 'createdAt' | 'updatedAt'>
>

const toApiPaymentMethod = (
  paymentMethod: DbPaymentMethod,
): Result<ApiPaymentMethodResponse, DomainError> =>
  Result.map(
    parseStored(
      convertedColumnsSchema,
      paymentMethod,
      `Stored payment method ${paymentMethod.id} does not match the API model`,
    ),
    (converted) => ({
      id: paymentMethod.id,
      salonId: paymentMethod.salonId,
      method: paymentMethod.method,
      displayName: paymentMethod.displayName,
      description: paymentMethod.description,
      processorName: paymentMethod.processorName,
      fee: converted.fee,
      minimumAmount: paymentMethod.minimumAmount,
      maximumAmount: paymentMethod.maximumAmount,
      isOnlineEnabled: paymentMethod.isOnlineEnabled,
      isOfflineEnabled: paymentMethod.isOfflineEnabled,
      sortOrder: paymentMethod.sortOrder,
      isActive: paymentMethod.isActive,
      createdAt: converted.createdAt,
      updatedAt: converted.updatedAt,
    }),
  )

export const PaymentMethodReadMapper = {
  toApiPaymentMethod,

  toApiPaymentMethods(
    paymentMethods: DbPaymentMethod[],
  ): Result<ApiPaymentMethodResponse[], DomainError> {
    const apiPaymentMethods: ApiPaymentMethodResponse[] = []
    for (const paymentMethod of paymentMethods) {
      const mapped = toApiPaymentMethod(paymentMethod)
      if (mapped.type === 'error') {
        return mapped
      }
      apiPaymentMethods.push(mapped.data)
    }
    return Result.success(apiPaymentMethods)
  },

  /** The payment methods of a list as a page of it. */
  toApiPaymentMethodPage(
    { paymentMethods, total, hasMore }: PaymentMethodList,
    paging: Paging<PaymentMethodId>,
  ): Result<ApiPage<ApiPaymentMethodResponse>, DomainError> {
    return Result.map(
      PaymentMethodReadMapper.toApiPaymentMethods(paymentMethods),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },
}
