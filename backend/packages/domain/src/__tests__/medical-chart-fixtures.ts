import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { MedicalChartUseCaseDependencies } from '../business-logic/medical-chart'
import type {
  ApiMedicalChartCreateRequest,
  DbMedicalChart,
} from '../models/medical-chart'
import type {
  IMedicalChartRepository,
  MedicalChartChange,
  MedicalChartCreation,
  MedicalChartListing,
  MedicalChartOfCustomer,
} from '../repositories/medical-chart.repository'
import { CUSTOMER_ID, NOW } from './auth-fixtures'

export const MEDICAL_CHART_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6d01'
export const OTHER_MEDICAL_CHART_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6d02'

/**
 * A request that satisfies every rule: two treatments at other salons,
 * the conditions, the products and notes written down.
 */
export const medicalChartCreateRequest = (
  overrides: Partial<ApiMedicalChartCreateRequest> = {},
): ApiMedicalChartCreateRequest => ({
  customerId: CUSTOMER_ID,
  previousTreatments: [
    {
      treatment: 'color',
      date: '2026-03-14',
      salonName: 'Hair Studio Ginza',
      notes: 'ブリーチ 1 回',
    },
    { treatment: 'perm', date: '2025-11-02', salonName: null, notes: null },
  ],
  medicalConditions: '頭皮が乾燥しやすい',
  preferredProducts: ['Aveda', 'オーガニックシャンプー'],
  avoidProducts: ['強い香料の整髪料'],
  notes: 'ぬるめのお湯を希望',
  ...overrides,
})

/** A row of `medical_charts` as the driver returns it: the chart above. */
export const dbMedicalChart = (
  overrides: Partial<DbMedicalChart> = {},
): DbMedicalChart => {
  const request = medicalChartCreateRequest()
  return {
    id: MEDICAL_CHART_ID,
    customerId: request.customerId,
    previousTreatments: request.previousTreatments,
    medicalConditions: request.medicalConditions,
    preferredProducts: request.preferredProducts,
    avoidProducts: request.avoidProducts,
    notes: request.notes,
    createdAt: '2026-11-18 10:00:00.123456+09',
    updatedAt: '2026-11-18 10:30:00+09',
    ...overrides,
  }
}

/**
 * A repository that holds the one chart above, in which every write
 * succeeds; a test overrides what it needs.
 */
const medicalChartRepositoryWith = (
  overrides: Partial<IMedicalChartRepository> = {},
): IMedicalChartRepository => ({
  create: vi.fn(async () =>
    Result.success<MedicalChartCreation>({
      type: 'created',
      chart: dbMedicalChart(),
    }),
  ),
  findByCustomer: vi.fn(async () =>
    Result.success<MedicalChartOfCustomer>({
      type: 'found',
      chart: dbMedicalChart(),
    }),
  ),
  update: vi.fn(async () =>
    Result.success<MedicalChartChange>({
      type: 'changed',
      chart: dbMedicalChart(),
    }),
  ),
  list: vi.fn(async () =>
    Result.success<MedicalChartListing>({
      type: 'listed',
      charts: [dbMedicalChart()],
      total: 1,
      hasMore: false,
    }),
  ),
  ...overrides,
})

/** Everything the medical chart use cases need: the repository above, and `NOW`. */
export const medicalChartDependencies = (
  charts: Partial<IMedicalChartRepository> = {},
): MedicalChartUseCaseDependencies => ({
  medicalChartRepository: medicalChartRepositoryWith(charts),
  clock: () => NOW,
})
