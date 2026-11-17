import type {
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'
import type { ProductId } from './product'
import type { ServiceId } from './service'

// ID: a UUID that has been checked.
export const treatmentRecordIdSchema = uuidSchema.brand<'TreatmentRecordId'>()
export type TreatmentRecordId = z.infer<typeof treatmentRecordIdSchema>

const treatmentRecordIdParameterSchema = z.object({
  id: treatmentRecordIdSchema,
})

export const parseTreatmentRecordId = (
  id: unknown,
): Result<TreatmentRecordId, DomainError> =>
  Result.map(
    parseWith(
      treatmentRecordIdParameterSchema,
      { id },
      'Invalid treatment record ID',
    ),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiTreatmentRecordResponse =
  components['schemas']['Models.TreatmentRecordResponse']
export type ApiTreatmentMaterial =
  components['schemas']['Models.TreatmentMaterial']
export type ApiTreatmentPhotoResponse =
  components['schemas']['Models.TreatmentPhotoResponse']
export type ApiTreatmentRecordCreateRequest =
  components['schemas']['Models.TreatmentRecordCreateRequest']
export type ApiTreatmentRecordUpdateRequest =
  components['schemas']['Models.TreatmentRecordUpdateRequest']
export type ApiTreatmentRecordSearchRequest = NonNullable<
  operations['TreatmentRecordCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbTreatmentRecord = DeepRequired<
  typeof treatmentRecords.$inferSelect
>
export type DbTreatmentMaterial = DeepRequired<
  typeof treatmentMaterials.$inferSelect
>
export type DbTreatmentPhoto = DeepRequired<typeof treatmentPhotos.$inferSelect>

/**
 * A record with its materials, in the order of the request that wrote
 * them, and its photos, in the order they are shown.
 */
export type TreatmentRecordWithDetails = {
  record: DbTreatmentRecord
  materials: DbTreatmentMaterial[]
  photos: DbTreatmentPhoto[]
}

/**
 * What a request writes of a record besides its lists, which are jsonb
 * columns: the database assigns the ID and the times.
 */
type TreatmentRecordStatedColumns = DeepRequired<
  Omit<
    typeof treatmentRecords.$inferInsert,
    | 'id'
    | 'services'
    | 'techniques'
    | 'nextRecommendedServices'
    | 'createdAt'
    | 'updatedAt'
  >
>

/** The lists of a record, as the request states them. */
type TreatmentRecordLists = {
  services: ServiceId[]
  techniques: string[]
  nextRecommendedServices: ServiceId[]
}

/** What the creation of a record writes of it. */
export type DbNewTreatmentRecord = TreatmentRecordStatedColumns &
  TreatmentRecordLists

/**
 * What a request writes of a material besides its record and its place in
 * the list, which is the place it has in the request.
 */
export type DbNewTreatmentMaterial = DeepRequired<
  Omit<
    typeof treatmentMaterials.$inferInsert,
    'id' | 'treatmentRecordId' | 'productId' | 'sortOrder' | 'createdAt'
  >
> & { productId: ProductId }

/**
 * What an update can write of a record: neither its booking, its customer
 * nor its staff member.
 */
export type DbTreatmentRecordChanges = Partial<
  Omit<DbNewTreatmentRecord, 'bookingId' | 'customerId' | 'staffId'>
>
