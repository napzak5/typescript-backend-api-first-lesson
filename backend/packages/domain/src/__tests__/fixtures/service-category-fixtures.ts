import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { ServiceCategoryUseCaseDependencies } from '../../business-logic/service-category'
import type {
  ApiServiceCategoryCreateRequest,
  DbServiceCategory,
} from '../../models/service-category'
import type { ISalonRepository } from '../../repositories/salon.repository'
import type {
  IServiceCategoryRepository,
  ServiceCategoryCreation,
  ServiceCategoryUpdate,
} from '../../repositories/service-category.repository'
import { SALON_ID, salonRepositoryWith } from './fixtures'

export const CATEGORY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d01'
export const OTHER_CATEGORY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d02'

/** A request that satisfies every rule: a top-level category. */
export const serviceCategoryCreateRequest =
  (): ApiServiceCategoryCreateRequest => ({
    name: 'カット',
    description: 'Cuts for every length',
    parentId: null,
    category: 'cut',
    displayOrder: 10,
    iconUrl: 'https://aoyama.example.com/icons/cut.svg',
    color: '#FF8800',
    isActive: true,
  })

/** A row of `service_categories` as the driver returns it. */
export const dbServiceCategory = (
  overrides: Partial<DbServiceCategory> = {},
): DbServiceCategory => ({
  id: CATEGORY_ID,
  salonId: SALON_ID,
  name: 'カット',
  description: null,
  parentId: null,
  category: 'cut',
  displayOrder: 10,
  iconUrl: null,
  color: '#FF8800',
  isActive: true,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

/**
 * A repository that holds the one category above, in which every write
 * succeeds; a test overrides what it needs.
 */
const serviceCategoryRepositoryWith = (
  overrides: Partial<IServiceCategoryRepository> = {},
): IServiceCategoryRepository => ({
  create: vi.fn(async () =>
    Result.success<ServiceCategoryCreation>({
      type: 'created',
      category: dbServiceCategory(),
    }),
  ),
  findById: vi.fn(async () => Result.success(dbServiceCategory())),
  list: vi.fn(async () =>
    Result.success({
      categories: [dbServiceCategory()],
      total: 1,
      hasMore: false,
    }),
  ),
  update: vi.fn(async () =>
    Result.success<ServiceCategoryUpdate>({
      type: 'updated',
      category: dbServiceCategory(),
    }),
  ),
  delete: vi.fn(async () => Result.success(true)),
  ...overrides,
})

/**
 * Everything the service category use cases need: the repository above and a
 * salon repository in which the salon exists.
 */
export const serviceCategoryDependencies = (
  categories: Partial<IServiceCategoryRepository> = {},
  salons: Partial<ISalonRepository> = {},
): ServiceCategoryUseCaseDependencies => ({
  serviceCategoryRepository: serviceCategoryRepositoryWith(categories),
  salonRepository: salonRepositoryWith(salons),
})
