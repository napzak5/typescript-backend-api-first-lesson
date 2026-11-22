import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiMedicalChartResponse,
  DbMedicalChart,
  MedicalChartId,
} from '../../models/medical-chart'
import type { ApiPage, Paging } from '../../models/page'
import type { MedicalChartListing } from '../../repositories/medical-chart.repository'
import { previousTreatmentSchema } from '../../schemas/medical-chart.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * A row of `medical_charts` → API response. Property names are the column
 * names; what changes is the representation of some columns:
 * - the previous treatments are a jsonb column, untyped in the database,
 *   and are checked against the API model
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 *
 * Every property is named: a column added to the table is not shown by
 * itself.
 */

const convertedChartSchema = z.object({
  previousTreatments: z.array(previousTreatmentSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiMedicalChartResponse,
    'previousTreatments' | 'createdAt' | 'updatedAt'
  >
>

const toApiMedicalChart = (
  chart: DbMedicalChart,
): Result<ApiMedicalChartResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(convertedChartSchema, chart, 'Invalid stored medical chart'),
      (converted) => ({
        id: chart.id,
        customerId: chart.customerId,
        previousTreatments: converted.previousTreatments,
        medicalConditions: chart.medicalConditions,
        preferredProducts: chart.preferredProducts,
        avoidProducts: chart.avoidProducts,
        notes: chart.notes,
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored medical chart ${chart.id} does not match the API model`,
        error,
      ),
  )

export const MedicalChartReadMapper = {
  toApiMedicalChart,

  toApiMedicalCharts(
    charts: DbMedicalChart[],
  ): Result<ApiMedicalChartResponse[], DomainError> {
    const apiCharts: ApiMedicalChartResponse[] = []
    for (const chart of charts) {
      const mapped = toApiMedicalChart(chart)
      if (mapped.type === 'error') {
        return mapped
      }
      apiCharts.push(mapped.data)
    }
    return Result.success(apiCharts)
  },

  /** The charts a list found as a page of it. */
  toApiMedicalChartPage(
    {
      charts,
      total,
      hasMore,
    }: Extract<MedicalChartListing, { type: 'listed' }>,
    paging: Paging<MedicalChartId>,
  ): Result<ApiPage<ApiMedicalChartResponse>, DomainError> {
    return Result.map(
      MedicalChartReadMapper.toApiMedicalCharts(charts),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },
}
