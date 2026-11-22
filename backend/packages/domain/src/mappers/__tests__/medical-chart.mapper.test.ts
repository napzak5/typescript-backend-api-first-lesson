import { describe, expect, it } from 'vitest'
import {
  dbMedicalChart,
  MEDICAL_CHART_ID,
  OTHER_MEDICAL_CHART_ID,
} from '../../__tests__/fixtures/medical-chart-fixtures'
import { medicalChartIdSchema } from '../../models/medical-chart'
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
