import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiCustomerAllergyResponse,
  CustomerAllergyId,
  DbCustomerAllergy,
} from '../../models/customer-allergy'
import type { ApiPage, Paging } from '../../models/page'
import type { CustomerAllergyListing } from '../../repositories/customer-allergy.repository'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * A row of `customer_allergies` → API response. Property names are the
 * column names; the customer is the one of the path and is not shown, and
 * `timestamptz` is read in PostgreSQL's text format and returned as
 * ISO 8601.
 *
 * Every property is named: a column added to the table is not shown by
 * itself.
 */

const convertedAllergySchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiCustomerAllergyResponse, 'createdAt' | 'updatedAt'>
>

const toApiCustomerAllergy = (
  allergy: DbCustomerAllergy,
): Result<ApiCustomerAllergyResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(
        convertedAllergySchema,
        allergy,
        'Invalid stored customer allergy',
      ),
      (converted) => ({
        id: allergy.id,
        allergyType: allergy.allergyType,
        allergenName: allergy.allergenName,
        severityType: allergy.severityType,
        symptoms: allergy.symptoms,
        notes: allergy.notes,
        confirmedDate: allergy.confirmedDate,
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored customer allergy ${allergy.id} does not match the API model`,
        error,
      ),
  )

export const CustomerAllergyReadMapper = {
  toApiCustomerAllergy,

  toApiCustomerAllergies(
    allergies: DbCustomerAllergy[],
  ): Result<ApiCustomerAllergyResponse[], DomainError> {
    const apiAllergies: ApiCustomerAllergyResponse[] = []
    for (const allergy of allergies) {
      const mapped = toApiCustomerAllergy(allergy)
      if (mapped.type === 'error') {
        return mapped
      }
      apiAllergies.push(mapped.data)
    }
    return Result.success(apiAllergies)
  },

  /** The allergies a list found as a page of it. */
  toApiCustomerAllergyPage(
    {
      allergies,
      total,
      hasMore,
    }: Extract<CustomerAllergyListing, { type: 'listed' }>,
    paging: Paging<CustomerAllergyId>,
  ): Result<ApiPage<ApiCustomerAllergyResponse>, DomainError> {
    return Result.map(
      CustomerAllergyReadMapper.toApiCustomerAllergies(allergies),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },
}
