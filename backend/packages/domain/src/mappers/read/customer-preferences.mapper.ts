import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { CustomerId } from '../../models/customer'
import type {
  ApiCustomerPreferencesResponse,
  DbCustomerPreferences,
} from '../../models/customer-preferences'
import {
  storedStylePreferenceSchema,
  storedTimeSlotsSchema,
} from '../../schemas/customer-preferences.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'

/**
 * Database columns → API response. Property names are the column names, and
 * the columns are returned as they are stored. The two `jsonb` columns are
 * untyped in the database and are checked against the API model.
 */

const convertedColumnsSchema = z.object({
  preferredTimeSlots: storedTimeSlotsSchema,
  stylePreferences: storedStylePreferenceSchema.nullable(),
}) satisfies z.ZodType<
  Pick<
    ApiCustomerPreferencesResponse,
    'preferredTimeSlots' | 'stylePreferences'
  >
>

export const CustomerPreferencesReadMapper = {
  toApiPreferences(
    customerId: CustomerId,
    preferences: DbCustomerPreferences,
  ): Result<ApiCustomerPreferencesResponse, DomainError> {
    return Result.mapError(
      Result.map(
        parseWith(
          convertedColumnsSchema,
          preferences,
          'Invalid stored customer preferences',
        ),
        (converted) => ({ ...preferences, ...converted }),
      ),
      // The request was fine; the stored row is not.
      (error) =>
        DomainErrors.database(
          `Stored preferences of customer ${customerId} do not match the API model`,
          error,
        ),
    )
  },
}
