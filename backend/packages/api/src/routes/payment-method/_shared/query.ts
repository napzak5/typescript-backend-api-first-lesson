import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
} from '../../../shared/query-parameters'

/** The parameters of the payment method list that are not text, as their types. */
const paymentMethodSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  isActive: booleanParameter.exactOptional(),
})

export const decodePaymentMethodSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    paymentMethodSearchQuerySchema,
    query,
    'Invalid payment method search',
  )
