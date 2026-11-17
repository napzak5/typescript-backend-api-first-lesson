import type {
  DbNewTreatmentMaterial,
  DbNewTreatmentPhoto,
  DbNewTreatmentRecord,
} from '../../models/treatment-record'
import type { TreatmentRecordUpdateCriteria } from '../../repositories/treatment-record.repository'
import type { TreatmentPhotoBulkCreateRequest } from '../../schemas/treatment-photo.schema'
import type {
  TreatmentRecordCreateRequest,
  TreatmentRecordUpdateRequest,
} from '../../schemas/treatment-record.schema'

type MaterialOfRequest = TreatmentRecordCreateRequest['materials'][number]

/** A quantity is written as the text of a `numeric` with two decimals. */
const toMaterial = (material: MaterialOfRequest): DbNewTreatmentMaterial => ({
  productId: material.productId,
  quantity: material.quantity.toFixed(2),
  unit: material.unit,
  lotNumber: material.lotNumber,
  notes: material.notes,
})

/**
 * API request → database rows of a treatment record. Property names are the
 * column names; the lists are written as the jsonb arrays they are, and the
 * materials in the order of the request.
 */
export const TreatmentRecordWriteMapper = {
  fromCreateRequest(request: TreatmentRecordCreateRequest): {
    record: DbNewTreatmentRecord
    materials: DbNewTreatmentMaterial[]
  } {
    return {
      record: {
        bookingId: request.bookingId,
        customerId: request.customerId,
        staffId: request.staffId,
        services: request.services,
        techniques: request.techniques,
        consultationNotes: request.consultationNotes,
        scalpCondition: request.scalpCondition,
        hairCondition: request.hairCondition,
        colorFormula: request.colorFormula,
        processingTime: request.processingTime,
        resultNotes: request.resultNotes,
        nextRecommendedDate: request.nextRecommendedDate,
        nextRecommendedServices: request.nextRecommendedServices,
        homeCareSuggestions: request.homeCareSuggestions,
        customerSatisfaction: request.customerSatisfaction,
        staffEvaluation: request.staffEvaluation,
      },
      materials: request.materials.map(toMaterial),
    }
  },

  /** What the update states, and nothing else; materials replace all or none. */
  fromUpdateRequest(
    request: TreatmentRecordUpdateRequest,
  ): TreatmentRecordUpdateCriteria {
    const { materials, ...changes } = request
    return {
      changes,
      materials: materials === undefined ? null : materials.map(toMaterial),
    }
  },

  /** The photos of an addition, in the order of the request. */
  fromPhotoBulkCreateRequest(
    request: TreatmentPhotoBulkCreateRequest,
  ): DbNewTreatmentPhoto[] {
    return request.photos.map((photo) => ({
      photoType: photo.photoType,
      photoUrl: photo.photoUrl,
      thumbnailUrl: photo.thumbnailUrl,
      angle: photo.angle,
      description: photo.description,
      isPublic: photo.isPublic,
      customerConsent: photo.customerConsent,
      sortOrder: photo.sortOrder,
    }))
  },
}
