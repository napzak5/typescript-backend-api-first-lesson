import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { ProductUseCaseDependencies } from '../../business-logic/product'
import type { ApiProductCreateRequest, DbProduct } from '../../models/product'
import type {
  IProductRepository,
  ProductRemoval,
  ProductUpdate,
} from '../../repositories/product.repository'
import type { ISalonRepository } from '../../repositories/salon.repository'
import { SALON_ID, salonRepositoryWith } from './fixtures'

export const PRODUCT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01'
export const OTHER_PRODUCT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f02'

/** A request that satisfies every rule: a shampoo sold and used, with every level set. */
export const productCreateRequest = (): ApiProductCreateRequest => ({
  productCode: 'SHMP001',
  name: 'プロフェッショナル シャンプー 500ml',
  description: '全ての髪質に使える保湿シャンプー',
  category: 'Hair Care',
  brand: 'Salon Pro',
  purchasePrice: 1500,
  retailPrice: 3500,
  salonPrice: 3000,
  unit: '本',
  minimumStock: 5,
  maximumStock: 50,
  reorderPoint: 10.5,
  supplier: 'Tokyo Beauty Supply',
  supplierProductCode: 'TBS-SHMP-500',
  leadTimeDays: 7,
  imageUrl: 'https://example.com/images/products/shampoo-001.jpg',
  barcode: '4901234567890',
  isForSale: true,
  isForTreatment: true,
  requiresLotTracking: true,
  expiryMonths: 36,
  storageConditions: '直射日光を避けて保管',
  safetyDataSheet: 'https://example.com/docs/sds/shampoo-001.pdf',
  isActive: true,
})

/** A row of `products` as the driver returns it. */
export const dbProduct = (overrides: Partial<DbProduct> = {}): DbProduct => ({
  id: PRODUCT_ID,
  salonId: SALON_ID,
  productCode: 'SHMP001',
  name: 'プロフェッショナル シャンプー 500ml',
  description: null,
  category: 'Hair Care',
  brand: 'Salon Pro',
  purchasePrice: 1500,
  retailPrice: null,
  salonPrice: 3000,
  unit: '本',
  minimumStock: '5.00',
  maximumStock: '50.25',
  reorderPoint: null,
  supplier: 'Tokyo Beauty Supply',
  supplierProductCode: null,
  leadTimeDays: 7,
  imageUrl: null,
  barcode: '4901234567890',
  isForSale: true,
  isForTreatment: false,
  requiresLotTracking: true,
  expiryMonths: 36,
  storageConditions: null,
  safetyDataSheet: null,
  isActive: true,
  deletedAt: null,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

/**
 * A repository that holds the one product above, in which every write
 * succeeds; a test overrides what it needs.
 */
const productRepositoryWith = (
  overrides: Partial<IProductRepository> = {},
): IProductRepository => ({
  create: vi.fn(async () => Result.success(dbProduct())),
  findById: vi.fn(async () => Result.success(dbProduct())),
  list: vi.fn(async () =>
    Result.success({ products: [dbProduct()], total: 1, hasMore: false }),
  ),
  update: vi.fn(async () =>
    Result.success<ProductUpdate>({ type: 'updated', product: dbProduct() }),
  ),
  delete: vi.fn(async () =>
    Result.success<ProductRemoval>({ type: 'deleted' }),
  ),
  ...overrides,
})

/**
 * Everything the product use cases need: the repository above and a salon
 * repository in which the salon exists.
 */
export const productDependencies = (
  products: Partial<IProductRepository> = {},
  salons: Partial<ISalonRepository> = {},
): ProductUseCaseDependencies => ({
  productRepository: productRepositoryWith(products),
  salonRepository: salonRepositoryWith(salons),
})
