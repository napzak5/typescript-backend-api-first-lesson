import type { openingHours, salons } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith } from '../shared'

// ID: a UUID that has been checked, so that an unchecked string cannot be
// passed where a salon ID is expected.
export const salonIdSchema = z.uuid().brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

const salonIdParameterSchema = z.object({ id: salonIdSchema })

export const parseSalonId = (id: unknown): Result<SalonId, DomainError> =>
  Result.map(
    parseWith(salonIdParameterSchema, { id }, 'Invalid salon ID'),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiSalonResponse = components['schemas']['Models.SalonResponse']
export type ApiSalonCreateRequest =
  components['schemas']['Models.SalonCreateRequest']
export type ApiSalonUpdateRequest =
  components['schemas']['Models.SalonUpdateRequest']
export type ApiSalonSearchRequest = NonNullable<
  operations['SalonCrud_list']['parameters']['query']
>
export type ApiOpeningHours = components['schemas']['Models.OpeningHours']
export type ApiBusinessHours = components['schemas']['Models.BusinessHours']
export type ApiPaginationMeta = components['schemas']['Models.PaginationMeta']

// Database types, inferred from the Drizzle schema
export type DbSalon = DeepRequired<typeof salons.$inferSelect>
export type DbOpeningHours = DeepRequired<typeof openingHours.$inferSelect>

/**
 * Columns of `salons` that are never written from a request: the database
 * assigns them (`id`, timestamps), other features maintain them (`rating`,
 * `reviewCount`), or the API does not expose them yet (the policy columns).
 */
type SalonManagedColumn =
  | 'id'
  | 'rating'
  | 'reviewCount'
  | 'cancellationPolicy'
  | 'bookingPolicy'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewSalon = DeepRequired<
  Omit<typeof salons.$inferInsert, SalonManagedColumn>
>
export type DbSalonChanges = Partial<DbNewSalon>

/** A row of `opening_hours` before it is attached to a salon. */
export type DbNewOpeningHours = DeepRequired<
  Omit<
    typeof openingHours.$inferInsert,
    'id' | 'salonId' | 'createdAt' | 'updatedAt'
  >
>

/** A salon together with its calendar, as the API presents it. */
export type SalonWithOpeningHours = {
  salon: DbSalon
  openingHours: DbOpeningHours[]
}

/** What an update does to the calendar of a salon. */
export type OpeningHoursChange =
  | { type: 'keep' }
  | { type: 'replace'; openingHours: DbNewOpeningHours[] }
