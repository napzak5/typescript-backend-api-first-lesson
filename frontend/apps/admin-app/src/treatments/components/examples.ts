import type {
  ModelsProductResponse,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aBooking,
  aCustomer,
  salon,
  services,
  staff,
} from '../../bookings/components/examples'

/** A product of the salon of the examples, used in treatments, with what it changes. */
export const aProduct = (
  changes: Partial<ModelsProductResponse> = {},
): ModelsProductResponse => ({
  id: 'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35',
  salonId: salon.id,
  productCode: 'COLOR-6N',
  name: 'カラー剤 6N',
  description: null,
  category: 'カラー',
  brand: null,
  purchasePrice: 900,
  retailPrice: null,
  salonPrice: null,
  unit: '本',
  minimumStock: 5,
  maximumStock: null,
  reorderPoint: null,
  supplier: null,
  supplierProductCode: null,
  leadTimeDays: null,
  imageUrl: null,
  barcode: null,
  isForSale: false,
  isForTreatment: true,
  requiresLotTracking: true,
  expiryMonths: 24,
  storageConditions: null,
  safetyDataSheet: null,
  isActive: true,
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
  ...changes,
})

/** The products of the salon of the examples: one kept by lots, one not, and one for sale only. */
export const products: ModelsProductResponse[] = [
  aProduct(),
  aProduct({
    id: 'd6f8b0c2-4e5a-4b7c-9d1f-3a5b7d9f1c46',
    productCode: 'OX-6',
    name: 'オキシ 6%',
    unit: 'ml',
    requiresLotTracking: false,
    expiryMonths: null,
  }),
  aProduct({
    id: 'e7a9c1d3-5f6b-4c8d-8e2a-4b6c8e0a2d57',
    productCode: 'SHMP-01',
    name: 'ホームケア シャンプー',
    unit: '本',
    isForSale: true,
    isForTreatment: false,
    requiresLotTracking: false,
  }),
]

const [misaki] = staff
const [cut, color] = services
const [colorAgent, oxidant] = products

/** A record of the treatment of the booking of the examples, with what it changes. */
export const aTreatment = (
  changes: Partial<ModelsTreatmentRecordResponse> = {},
): ModelsTreatmentRecordResponse => ({
  id: 'f8b0d2e4-6a7c-4d9e-9f3b-5c7d9f1b3e68',
  bookingId: aBooking().id,
  customerId: aCustomer().id,
  staffId: misaki?.id ?? '',
  services: [cut?.id ?? '', color?.id ?? ''],
  techniques: ['ローライト', 'レイヤーカット'],
  consultationNotes: '前回のカラーの色落ちが気になる。\n明るさは変えたくない。',
  scalpCondition: 'やや乾燥',
  hairCondition: '毛先にダメージ',
  colorFormula: '6N：オキシ 6% ＝ 1：1',
  processingTime: 75,
  resultNotes: null,
  nextRecommendedDate: '2026-12-18',
  nextRecommendedServices: [color?.id ?? ''],
  homeCareSuggestions: 'カラー用のシャンプーを勧めた。',
  customerSatisfaction: 5,
  staffEvaluation: '根元の塗り分けに時間がかかった。',
  materials: [
    {
      productId: colorAgent?.id ?? '',
      quantity: 1,
      unit: '本',
      lotNumber: 'LOT-2026-031',
      notes: null,
    },
    {
      productId: oxidant?.id ?? '',
      quantity: 80.5,
      unit: 'ml',
      lotNumber: null,
      notes: '根元に多めに使った。',
    },
  ],
  photos: [],
  createdAt: '2026-11-20T03:30:00.000Z',
  updatedAt: '2026-11-20T03:30:00.000Z',
  ...changes,
})
