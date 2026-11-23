import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiTreatmentMaterial,
  ApiTreatmentPhotoBulkCreateResponse,
  ApiTreatmentPhotoResponse,
  ApiTreatmentRecordResponse,
  ApiTreatmentStatisticsResponse,
  DbTreatmentMaterial,
  DbTreatmentPhoto,
  TreatmentFigures,
  TreatmentRecordId,
  TreatmentRecordWithDetails,
} from '../../models/treatment-record'
import type { TreatmentRecordListing } from '../../repositories/treatment-record.repository'
import { type DomainError, parseStored } from '../../shared'
import { numericSchema, timestampSchema } from './columns'
import { toApiPage } from './page'

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

/** `description` says which material of which record the row is. */
const toApiMaterial = (
  material: DbTreatmentMaterial,
  description: string,
): Result<ApiTreatmentMaterial, DomainError> =>
  Result.map(
    parseStored(convertedMaterialSchema, material, description),
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
    const mapped = toApiMaterial(
      material,
      `Stored material ${material.id} of treatment record ${record.id} does not match the API model`,
    )
    if (mapped.type === 'error') {
      return mapped
    }
    apiMaterials.push(mapped.data)
  }

  return Result.map(
    parseStored(
      convertedRecordSchema,
      record,
      `Stored treatment record ${record.id} does not match the API model`,
    ),
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
  )
}

export const TreatmentRecordReadMapper = {
  toApiTreatmentRecord,

  /** What an addition of photos is answered with: the photos, in the order they are given. */
  toApiPhotoBulkCreate(
    photos: DbTreatmentPhoto[],
  ): ApiTreatmentPhotoBulkCreateResponse {
    return { created: photos.map(toApiPhoto) }
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

  /** The records a list found as a page of it. */
  toApiTreatmentRecordPage(
    {
      records,
      total,
      hasMore,
    }: Extract<TreatmentRecordListing, { type: 'listed' }>,
    paging: Paging<TreatmentRecordId>,
  ): Result<ApiPage<ApiTreatmentRecordResponse>, DomainError> {
    return Result.map(
      TreatmentRecordReadMapper.toApiTreatmentRecords(records),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },

  /**
   * The statistics of the records of a period, from what was counted. The
   * average processing time is that of the records that state one, in
   * minutes rounded half up to one decimal, and null when none does.
   */
  toApiStatistics({
    total,
    processingTimeSum,
    processingTimeCount,
    byCategory,
    topServices,
  }: TreatmentFigures): ApiTreatmentStatisticsResponse {
    return {
      totalTreatments: total,
      treatmentsByCategory: byCategory,
      averageProcessingTime:
        processingTimeCount === 0
          ? null
          : Math.round((processingTimeSum * 10) / processingTimeCount) / 10,
      topServices,
    }
  },
}
