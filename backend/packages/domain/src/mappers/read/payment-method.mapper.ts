import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiPaymentMethodResponse,
  DbPaymentMethod,
} from '../../models/payment-method'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

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
})

const toApiPaymentMethod = (
  paymentMethod: DbPaymentMethod,
): Result<ApiPaymentMethodResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(
        convertedColumnsSchema,
        paymentMethod,
        'Invalid stored payment method',
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
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored payment method ${paymentMethod.id} does not match the API model`,
        error,
      ),
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
}
