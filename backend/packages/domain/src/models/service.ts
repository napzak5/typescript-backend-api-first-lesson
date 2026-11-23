import type { serviceOptions, services } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { serviceMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const serviceIdSchema = uuidSchema.brand<'ServiceId'>()
export type ServiceId = z.infer<typeof serviceIdSchema>

const serviceIdParameterSchema = z.object({ id: serviceIdSchema })

export const parseServiceId = (id: unknown): Result<ServiceId, DomainError> =>
  Result.map(
    parseWith(
      serviceIdParameterSchema,
      { id },
      serviceMessages.invalidServiceId,
    ),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiServiceResponse = components['schemas']['Models.ServiceResponse']
export type ApiServiceCreateRequest =
  components['schemas']['Models.ServiceCreateRequest']
export type ApiServiceUpdateRequest =
  components['schemas']['Models.ServiceUpdateRequest']
export type ApiServiceSearchRequest = NonNullable<
  operations['ServiceCrud_list']['parameters']['query']
>
export type ApiServiceBulkUpdateRequest =
  components['schemas']['Models.ServiceBulkUpdateRequest']
export type ApiServiceBulkUpdateResponse =
  components['schemas']['Models.ServiceBulkUpdateResponse']
export type ApiServiceOption = components['schemas']['Models.ServiceOption']

// Database types, inferred from the Drizzle schema
export type DbService = DeepRequired<typeof services.$inferSelect>
export type DbServiceOption = DeepRequired<typeof serviceOptions.$inferSelect>

/**
 * Columns of `services` that a request never writes: the database assigns
 * `id` and the timestamps, the salon comes from the path, and a delete sets
 * `deletedAt`.
 *
 * Every other column has the same representation in the database as in the
 * API.
 */
type ServiceManagedColumn =
  | 'id'
  | 'salonId'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewService = DeepRequired<
  Omit<typeof services.$inferInsert, ServiceManagedColumn>
>
export type DbServiceChanges = Partial<DbNewService>

/** A row of `service_options` before it is attached to a service. */
export type DbNewServiceOption = DeepRequired<
  Omit<
    typeof serviceOptions.$inferInsert,
    'id' | 'serviceId' | 'createdAt' | 'updatedAt'
  >
>

/** A service together with its options, as the API presents it. */
export type ServiceWithOptions = {
  service: DbService
  options: DbServiceOption[]
}

/** What an update does to the options of a service. */
export type ServiceOptionsChange =
  | { type: 'keep' }
  | { type: 'replace'; options: DbNewServiceOption[] }
