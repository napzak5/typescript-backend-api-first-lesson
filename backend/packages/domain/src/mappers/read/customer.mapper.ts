import { CustomerGenderTypeSchema } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiCustomerResponse, DbCustomer } from '../../models/customer'
import { storedCustomerPreferencesSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

/**
 * Database row → API response. Property names are the column names; what
 * changes is the representation of three kinds of column:
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 * - `jsonb` is untyped in the database and is checked against the API model
 * - `gender` is text in the database and one of the values of the API
 */

const convertedColumnsSchema = z.object({
  gender: CustomerGenderTypeSchema.nullable(),
  preferences: storedCustomerPreferencesSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiCustomerResponse,
    'gender' | 'preferences' | 'createdAt' | 'updatedAt'
  >
>

const toApiCustomer = (
  customer: DbCustomer,
): Result<ApiCustomerResponse, DomainError> => {
  const { deletedAt, ...columns } = customer

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, customer, 'Invalid stored customer'),
      (converted) => ({ ...columns, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored customer ${customer.id} does not match the API model`,
        error,
      ),
  )
}

export const CustomerReadMapper = {
  toApiCustomer,

  toApiCustomers(
    customers: DbCustomer[],
  ): Result<ApiCustomerResponse[], DomainError> {
    const apiCustomers: ApiCustomerResponse[] = []
    for (const customer of customers) {
      const mapped = toApiCustomer(customer)
      if (mapped.type === 'error') {
        return mapped
      }
      apiCustomers.push(mapped.data)
    }
    return Result.success(apiCustomers)
  },
}
