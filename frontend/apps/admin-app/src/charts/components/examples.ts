import type { ModelsMedicalChartResponse } from '@beauty-salon-frontend/api-client'
import { aCustomer } from '../../bookings/components/examples'

/** A chart of the customer of the examples, with what it changes. */
export const aChart = (
  changes: Partial<ModelsMedicalChartResponse> = {},
): ModelsMedicalChartResponse => ({
  id: 'd4b6f8a0-2c3e-4b5d-9f7a-1e3c5a7b9d02',
  customerId: aCustomer().id,
  previousTreatments: [
    {
      treatment: 'color',
      date: '2026-03-14',
      salonName: 'ヘアサロン 青山',
      notes: '根元から明るめのブラウン。',
    },
    {
      treatment: 'perm',
      date: '2025-11-02',
      salonName: null,
      notes: null,
    },
  ],
  medicalConditions: '頭皮が乾燥しやすく、かゆみが出ることがあります。',
  preferredProducts: ['オーガニックシャンプー', '無香料のオイル'],
  avoidProducts: ['香りの強い整髪料'],
  notes: 'シャンプーはぬるめのお湯で。\n施術中の会話は控えめを希望。',
  createdAt: '2026-04-01T01:00:00.000Z',
  updatedAt: '2026-11-18T05:30:00.000Z',
  ...changes,
})
