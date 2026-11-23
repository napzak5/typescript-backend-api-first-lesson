import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiServiceBulkUpdateResponse,
  ApiServiceOption,
  ApiServiceResponse,
  DbService,
  DbServiceOption,
  ServiceId,
  ServiceWithOptions,
} from '../../models/service'
import type { ServiceList } from '../../repositories/service.repository'
import { type DomainError, parseStored } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * Database rows → API response. Property names are the column names; only
 * the timestamps change their representation, from PostgreSQL's text format
 * to ISO 8601. `deletedAt` does not go out, and an option goes out without
 * what ties it to its service.
 */

const convertedColumnsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<Pick<ApiServiceResponse, 'createdAt' | 'updatedAt'>>

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
  const { deletedAt, ...columns } = service

  return Result.map(
    parseStored(
      convertedColumnsSchema,
      service,
      `Stored service ${service.id} does not match the API model`,
    ),
    (converted) => ({
      ...columns,
      ...converted,
      options: options.map(toApiServiceOption),
    }),
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

  /** The services of a list as a page of it. */
  toApiServicePage(
    { services, total, hasMore }: ServiceList,
    paging: Paging<ServiceId>,
  ): Result<ApiPage<ApiServiceResponse>, DomainError> {
    return Result.map(ServiceReadMapper.toApiServices(services), (data) =>
      toApiPage(data, { total, hasMore }, paging),
    )
  },

  /** What a bulk update answers with: the services it changed. */
  toApiServiceBulkUpdate(updated: ServiceId[]): ApiServiceBulkUpdateResponse {
    return { updated }
  },
}
