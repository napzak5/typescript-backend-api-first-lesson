import type {
  ApiPaymentMethodCreateRequest,
  ApiPaymentMethodUpdateRequest,
  DbNewPaymentMethod,
  DbPaymentMethodChanges,
} from '../../models/payment-method'

/**
 * API request → database row. Property names are the column names, so the
 * only conversion is the representation of the `numeric` column (`fee`),
 * which the driver reads and writes as a string to keep its precision.
 */

const toNumeric = (value: number): string => String(value)

export const PaymentMethodWriteMapper = {
  fromCreateRequest(
    request: ApiPaymentMethodCreateRequest,
  ): DbNewPaymentMethod {
    const { fee, ...columns } = request

    return { ...columns, fee: fee === null ? null : toNumeric(fee) }
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(
    request: ApiPaymentMethodUpdateRequest,
  ): DbPaymentMethodChanges {
    const { fee, ...columns } = request

    return {
      ...columns,
      ...(fee === undefined
        ? {}
        : { fee: fee === null ? null : toNumeric(fee) }),
    }
  },
}
