import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiServiceOption,
  ApiServiceResponse,
  DbService,
  DbServiceOption,
  ServiceWithOptions,
} from '../../models/service'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

/**
 * Database rows → API response. Property names are the column names; only
 * the timestamps change their representation, from PostgreSQL's text format
 * to ISO 8601. `deletedAt` and `requiredProducts` do not go out, and an
 * option goes out without what ties it to its service.
 */

const convertedColumnsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const toApiServiceOption = ({
  name,
  description,
  optionType,
  additionalTime,
  additionalPrice,
  maxQuantity,
  isRequired,
  sortOrder,
  isActive,
}: DbServiceOption): ApiServiceOption => ({
  name,
  description,
  optionType,
  additionalTime,
  additionalPrice,
  maxQuantity,
  isRequired,
  sortOrder,
  isActive,
})

const toApiService = (
  service: DbService,
  options: DbServiceOption[],
): Result<ApiServiceResponse, DomainError> => {
  const { deletedAt, requiredProducts, ...columns } = service

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, service, 'Invalid stored service'),
      (converted) => ({
        ...columns,
        ...converted,
        options: options.map(toApiServiceOption),
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored service ${service.id} does not match the API model`,
        error,
      ),
  )
}

export const ServiceReadMapper = {
  toApiService,

  toApiServices(
    services: ServiceWithOptions[],
  ): Result<ApiServiceResponse[], DomainError> {
    const apiServices: ApiServiceResponse[] = []
    for (const { service, options } of services) {
      const mapped = toApiService(service, options)
      if (mapped.type === 'error') {
        return mapped
      }
      apiServices.push(mapped.data)
    }
    return Result.success(apiServices)
  },
}
