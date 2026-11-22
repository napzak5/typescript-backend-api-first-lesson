import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it } from 'vitest'
import {
  apiMedicalChart,
  dbMedicalChart,
  MEDICAL_CHART_ID,
  medicalChartCreateRequest,
  OTHER_MEDICAL_CHART_ID,
} from '../../__tests__/fixtures/medical-chart-fixtures'
import { medicalChartIdSchema } from '../../models/medical-chart'
import { medicalChartCreateRequestSchema } from '../../schemas/medical-chart.schema'
import { MedicalChartReadMapper } from '../read/medical-chart.mapper'
import { MedicalChartWriteMapper } from '../write/medical-chart.mapper'

describe('MedicalChartReadMapper.toApiMedicalChartPage', () => {
  it('answers with the charts of the list and where the list goes on', () => {
    const result = MedicalChartReadMapper.toApiMedicalChartPage(
      {
        type: 'listed',
        charts: [
          dbMedicalChart(),
          dbMedicalChart({ id: OTHER_MEDICAL_CHART_ID }),
        ],
        total: 6,
        hasMore: true,
      },
      { limit: 2, after: null },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: MEDICAL_CHART_ID }, { id: OTHER_MEDICAL_CHART_ID }],
        meta: {
          total: 6,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: OTHER_MEDICAL_CHART_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored chart is invalid', () => {
    const result = MedicalChartReadMapper.toApiMedicalChartPage(
      {
        type: 'listed',
        charts: [dbMedicalChart({ updatedAt: 'recently' })],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('MedicalChartWriteMapper.fromSearchRequest', () => {
  it('asks for the first 20 charts, by no filter, when the request names nothing', () => {
    expect(MedicalChartWriteMapper.fromSearchRequest({})).toStrictEqual({
      limit: 20,
      after: null,
      search: null,
      hasAllergies: null,
    })
  })

  it('takes the place and the filters the request names, a filter that says no too', () => {
    expect(
      MedicalChartWriteMapper.fromSearchRequest({
        limit: 7,
        cursor: medicalChartIdSchema.parse(MEDICAL_CHART_ID),
        search: '乾燥',
        hasAllergies: false,
      }),
    ).toStrictEqual({
      limit: 7,
      after: MEDICAL_CHART_ID,
      search: '乾燥',
      hasAllergies: false,
    })
  })
})

describe('MedicalChartReadMapper', () => {
  it('shows every column under its name, the times in ISO 8601', () => {
    expect(MedicalChartReadMapper.toApiMedicalChart(dbMedicalChart())).toEqual(
      Result.success(apiMedicalChart),
    )
  })

  it.each<[string, unknown]>([
    ['no list', {}],
    [
      'a treatment of a kind that is not one',
      [{ treatment: 'spa', date: '2026-03-14', salonName: null, notes: null }],
    ],
    [
      'a treatment without its notes',
      [{ treatment: 'cut', date: '2026-03-14', salonName: null }],
    ],
  ])(
    'tells a stored chart whose previous treatments are %s does not match the model',
    (_case, previousTreatments) => {
      expect(
        MedicalChartReadMapper.toApiMedicalChart(
          dbMedicalChart({ previousTreatments }),
        ),
      ).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored medical chart ${MEDICAL_CHART_ID} does not match the API model`,
        },
      })
    },
  )

  it('shows charts in their order, and stops at the first that does not match', () => {
    const other = dbMedicalChart({ id: OTHER_MEDICAL_CHART_ID })

    expect(
      MedicalChartReadMapper.toApiMedicalCharts([other, dbMedicalChart()]),
    ).toEqual(
      Result.success([
        { ...apiMedicalChart, id: OTHER_MEDICAL_CHART_ID },
        apiMedicalChart,
      ]),
    )
    expect(
      MedicalChartReadMapper.toApiMedicalCharts([
        dbMedicalChart(),
        dbMedicalChart({
          id: OTHER_MEDICAL_CHART_ID,
          previousTreatments: null,
        }),
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        message: `Stored medical chart ${OTHER_MEDICAL_CHART_ID} does not match the API model`,
      },
    })
  })
})

describe('MedicalChartWriteMapper', () => {
  it('writes every item of a creation under its column', () => {
    const request = medicalChartCreateRequestSchema.parse(
      medicalChartCreateRequest(),
    )

    expect(MedicalChartWriteMapper.fromCreateRequest(request)).toEqual(
      medicalChartCreateRequest(),
    )
  })

  it('writes what an update names, and nothing else', () => {
    expect(
      MedicalChartWriteMapper.fromUpdateRequest({
        medicalConditions: null,
        preferredProducts: ['A'],
      }),
    ).toEqual({ medicalConditions: null, preferredProducts: ['A'] })
  })
})
