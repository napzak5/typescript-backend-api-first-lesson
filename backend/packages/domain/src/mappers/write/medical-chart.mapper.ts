import type {
  DbMedicalChartChanges,
  DbNewMedicalChart,
} from '../../models/medical-chart'
import type { MedicalChartListCriteria } from '../../repositories/medical-chart.repository'
import type {
  MedicalChartCreateRequest,
  MedicalChartSearchRequest,
  MedicalChartUpdateRequest,
} from '../../schemas/medical-chart.schema'
import { toPaging } from './page'

/**
 * API request → database row of a medical chart. Property names are the
 * column names; the previous treatments are written as the jsonb array they
 * are, in the order of the request.
 */
export const MedicalChartWriteMapper = {
  fromCreateRequest(request: MedicalChartCreateRequest): DbNewMedicalChart {
    return {
      customerId: request.customerId,
      previousTreatments: request.previousTreatments,
      medicalConditions: request.medicalConditions,
      preferredProducts: request.preferredProducts,
      avoidProducts: request.avoidProducts,
      notes: request.notes,
    }
  },

  /** What the update states, and nothing else. */
  fromUpdateRequest(request: MedicalChartUpdateRequest): DbMedicalChartChanges {
    return request
  },

  /** A filter the request does not name is none. */
  fromSearchRequest(
    request: MedicalChartSearchRequest,
  ): MedicalChartListCriteria {
    return {
      ...toPaging(request),
      search: request.search ?? null,
      hasAllergies: request.hasAllergies ?? null,
    }
  },
}
