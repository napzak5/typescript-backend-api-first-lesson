import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiTreatmentMaterial,
  ApiTreatmentPhotoResponse,
  ApiTreatmentRecordResponse,
  DbTreatmentMaterial,
  DbTreatmentPhoto,
  TreatmentRecordWithDetails,
} from '../../models/treatment-record'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

/**
 * A row of `treatment_records` with its rows of `treatment_materials` and
 * `treatment_photos` → API response. Property names are the column names;
 * what changes is the representation of some columns:
 * - the lists of a record are jsonb arrays, of IDs and of names
 * - the `numeric` quantity of a material is read as text and returned as a
 *   number
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 *
 * A material is shown without its own ID, its record and its place, which
 * is the place it has in its list. A photo is shown with its ID, which
 * removes it, and its place, which the request that added it stated.
 *
 * Every property is named: a column added to a table is not shown by
 * itself.
 */

const convertedRecordSchema = z.object({
  services: z.array(z.string()),
  techniques: z.array(z.string()),
  nextRecommendedServices: z.array(z.string()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiTreatmentRecordResponse,
    | 'services'
    | 'techniques'
    | 'nextRecommendedServices'
    | 'createdAt'
    | 'updatedAt'
  >
>

const convertedMaterialSchema = z.object({
  quantity: numericSchema,
}) satisfies z.ZodType<Pick<ApiTreatmentMaterial, 'quantity'>>

const MESSAGE = 'Invalid stored treatment record'

const toApiMaterial = (
  material: DbTreatmentMaterial,
): Result<ApiTreatmentMaterial, DomainError> =>
  Result.map(
    parseWith(convertedMaterialSchema, material, MESSAGE),
    ({ quantity }) => ({
      productId: material.productId,
      quantity,
      unit: material.unit,
      lotNumber: material.lotNumber,
      notes: material.notes,
    }),
  )

const toApiPhoto = (photo: DbTreatmentPhoto): ApiTreatmentPhotoResponse => ({
  id: photo.id,
  photoType: photo.photoType,
  photoUrl: photo.photoUrl,
  thumbnailUrl: photo.thumbnailUrl,
  angle: photo.angle,
  description: photo.description,
  isPublic: photo.isPublic,
  customerConsent: photo.customerConsent,
  sortOrder: photo.sortOrder,
})

const toApiTreatmentRecord = ({
  record,
  materials,
  photos,
}: TreatmentRecordWithDetails): Result<
  ApiTreatmentRecordResponse,
  DomainError
> => {
  const apiMaterials: ApiTreatmentMaterial[] = []
  for (const material of materials) {
    const mapped = toApiMaterial(material)
    if (mapped.type === 'error') {
      return Result.error(
        DomainErrors.database(
          `Stored material ${material.id} of treatment record ${record.id} does not match the API model`,
          mapped.error,
        ),
      )
    }
    apiMaterials.push(mapped.data)
  }

  return Result.mapError(
    Result.map(
      parseWith(convertedRecordSchema, record, MESSAGE),
      (converted) => ({
        id: record.id,
        bookingId: record.bookingId,
        customerId: record.customerId,
        staffId: record.staffId,
        services: converted.services,
        techniques: converted.techniques,
        consultationNotes: record.consultationNotes,
        scalpCondition: record.scalpCondition,
        hairCondition: record.hairCondition,
        colorFormula: record.colorFormula,
        processingTime: record.processingTime,
        resultNotes: record.resultNotes,
        nextRecommendedDate: record.nextRecommendedDate,
        nextRecommendedServices: converted.nextRecommendedServices,
        homeCareSuggestions: record.homeCareSuggestions,
        customerSatisfaction: record.customerSatisfaction,
        staffEvaluation: record.staffEvaluation,
        materials: apiMaterials,
        photos: photos.map(toApiPhoto),
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored treatment record ${record.id} does not match the API model`,
        error,
      ),
  )
}

export const TreatmentRecordReadMapper = {
  toApiTreatmentRecord,

  /** The photos of an addition, in the order they are given. */
  toApiPhotos(photos: DbTreatmentPhoto[]): ApiTreatmentPhotoResponse[] {
    return photos.map(toApiPhoto)
  },

  toApiTreatmentRecords(
    records: TreatmentRecordWithDetails[],
  ): Result<ApiTreatmentRecordResponse[], DomainError> {
    const apiRecords: ApiTreatmentRecordResponse[] = []
    for (const record of records) {
      const mapped = toApiTreatmentRecord(record)
      if (mapped.type === 'error') {
        return mapped
      }
      apiRecords.push(mapped.data)
    }
    return Result.success(apiRecords)
  },
}
