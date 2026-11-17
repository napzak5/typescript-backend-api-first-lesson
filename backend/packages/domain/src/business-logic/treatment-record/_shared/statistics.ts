import type {
  ApiTreatmentStatisticsResponse,
  TreatmentFigures,
} from '../../../models/treatment-record'

/**
 * The statistics of the records of a period. The average processing time
 * is that of the records that state one, in minutes rounded half up to one
 * decimal, and null when none does.
 */
export const statisticsOf = ({
  total,
  processingTimeSum,
  processingTimeCount,
  byCategory,
  topServices,
}: TreatmentFigures): ApiTreatmentStatisticsResponse => ({
  totalTreatments: total,
  treatmentsByCategory: byCategory,
  averageProcessingTime:
    processingTimeCount === 0
      ? null
      : Math.round((processingTimeSum * 10) / processingTimeCount) / 10,
  topServices,
})
