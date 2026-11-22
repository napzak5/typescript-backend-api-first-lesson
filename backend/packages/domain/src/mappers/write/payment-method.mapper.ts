import type {
  ApiPaymentMethodCreateRequest,
  ApiPaymentMethodUpdateRequest,
  DbNewPaymentMethod,
  DbPaymentMethodChanges,
} from '../../models/payment-method'
import type { SalonId } from '../../models/salon'
import type { PaymentMethodListCriteria } from '../../repositories/payment-method.repository'
import type { PaymentMethodSearchRequest } from '../../schemas/payment-method.schema'
import { toPaging } from './page'

/**
 * API request → what the repository takes: a row, the changes of one, the
 * criteria of a list. Property names are the column names, so the
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

  /** The payment methods of the salon of the path; a filter the request does not name is none. */
  fromSearchRequest(
    request: PaymentMethodSearchRequest,
    salonId: SalonId,
  ): PaymentMethodListCriteria {
    const { method, isActive } = request

    return {
      salonId,
      ...toPaging(request),
      method: method ?? null,
      isActive: isActive ?? null,
    }
  },
}
