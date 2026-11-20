import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import { aProduct } from '../../treatments/components/examples'

/*
 * The products of the stories: a shampoo that is sold and used, with
 * everything the ledger keeps of it; a colour used in treatments and kept
 * by lots; a wax the salon no longer carries; and gloves, supplies that
 * are neither sold nor used in a treatment, of which little is noted.
 */

/** A shampoo the salon sells and uses, with every value noted. */
export const shampoo: ModelsProductResponse = aProduct({
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  productCode: 'SHMP001',
  name: 'プロフェッショナル シャンプー 500ml',
  description: 'サロン専売のシャンプー。\n乾燥した髪に。',
  category: 'ヘアケア',
  brand: 'Salon Pro',
  purchasePrice: 1500,
  retailPrice: 3500,
  salonPrice: 3000,
  unit: '本',
  minimumStock: 5,
  reorderPoint: 10,
  maximumStock: 50,
  supplier: '東京ビューティーサプライ',
  supplierProductCode: 'TBS-SH-500',
  leadTimeDays: 3,
  imageUrl: 'https://images.example.com/products/shmp001.jpg',
  barcode: '4901234567894',
  isForSale: true,
  isForTreatment: true,
  requiresLotTracking: false,
  expiryMonths: 36,
  storageConditions: '直射日光を避けて保管',
  safetyDataSheet: 'https://docs.example.com/sds/shmp001.pdf',
  isActive: true,
})

/** A colour used in treatments, kept by lots. */
export const colour: ModelsProductResponse = aProduct({
  id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
  productCode: 'COLOR001',
  name: 'ヘアカラー ナチュラルブラウン',
  category: 'ヘアカラー',
  brand: 'ColorTech',
  purchasePrice: 800,
  retailPrice: 2000,
  salonPrice: 1800,
  unit: '本',
  minimumStock: 10,
  reorderPoint: 20,
  maximumStock: 100,
  supplier: 'カラーテック・ジャパン',
  leadTimeDays: 5,
  isForSale: false,
  isForTreatment: true,
  requiresLotTracking: true,
  expiryMonths: 24,
})

/** A wax the salon no longer carries. */
const droppedWax: ModelsProductResponse = aProduct({
  id: '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f',
  productCode: 'WAX001',
  name: 'スタイリングワックス 80g',
  category: 'スタイリング',
  brand: 'Style Master',
  purchasePrice: 800,
  retailPrice: 2000,
  salonPrice: 1800,
  unit: '個',
  isForSale: true,
  isForTreatment: false,
  requiresLotTracking: false,
  expiryMonths: null,
  isActive: false,
})

/** Gloves: supplies, neither sold nor used in a treatment, of which little is noted. */
export const gloves: ModelsProductResponse = aProduct({
  id: '4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a',
  productCode: 'SUP-GLOVE',
  name: 'ニトリル手袋 M',
  category: null,
  brand: null,
  purchasePrice: null,
  retailPrice: null,
  salonPrice: null,
  unit: '箱',
  minimumStock: 0,
  isForSale: false,
  isForTreatment: false,
  requiresLotTracking: false,
  expiryMonths: null,
})

/** The products of the salon of the stories, in the order of their codes */
export const PRODUCTS_OF_THE_SALON: ModelsProductResponse[] = [
  colour,
  shampoo,
  gloves,
  droppedWax,
]
