import type {
  ModelsCustomerAllergyResponse,
  ModelsMedicalChartResponse,
} from '@beauty-salon-frontend/api-client'
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

/** An allergy of the customer of the examples, with what it changes. */
export const anAllergy = (
  changes: Partial<ModelsCustomerAllergyResponse> = {},
): ModelsCustomerAllergyResponse => ({
  id: 'a7c9e1f3-5b2d-4e6f-8a0c-2d4f6b8e0a13',
  allergyType: 'chemical',
  allergenName: 'パラフェニレンジアミン（PPD）',
  severityType: 'severe',
  symptoms: 'カラー剤で頭皮に赤みとかゆみが出た。',
  notes: 'ジアミンを含まないカラー剤を使う。\nパッチテストを先に。',
  confirmedDate: '2025-06-10',
  createdAt: '2025-06-10T03:00:00.000Z',
  updatedAt: '2025-06-10T03:00:00.000Z',
  ...changes,
})

/** The allergies of the customer of the examples, the heaviest first. */
export const allergies = (): ModelsCustomerAllergyResponse[] => [
  anAllergy({
    id: 'b8d0f2a4-6c3e-4f7a-9b1d-3e5a7c9f1b24',
    allergyType: 'latex',
    allergenName: 'ラテックス',
    severityType: 'life_threatening',
    symptoms: '手袋が触れたところに、じんましんと息苦しさが出た。',
    notes: 'ラテックスの手袋は使わない。',
    confirmedDate: null,
  }),
  anAllergy(),
  anAllergy({
    id: 'c9e1a3b5-7d4f-4a8b-8c2e-4f6b8d0a2c35',
    allergyType: 'fragrance',
    allergenName: '強い香料',
    severityType: 'mild',
    symptoms: null,
    notes: null,
    confirmedDate: null,
  }),
]
