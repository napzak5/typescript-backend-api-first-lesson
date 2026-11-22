import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { ServiceUseCaseDependencies } from '../../business-logic/service'
import type {
  ApiServiceCreateRequest,
  ApiServiceOption,
  DbService,
  DbServiceOption,
} from '../../models/service'
import type { ISalonRepository } from '../../repositories/salon.repository'
import type {
  IServiceRepository,
  ServiceBulkUpdate,
  ServiceCreation,
  ServiceDeletion,
  ServiceUpdate,
} from '../../repositories/service.repository'
import { SALON_ID, salonRepositoryWith } from './fixtures'
import { CATEGORY_ID } from './service-category-fixtures'

export const SERVICE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'
export const OTHER_SERVICE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e02'
export const THIRD_SERVICE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e03'

export const OPTION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01'

/** The `n`th of a series of distinct service IDs, for long lists of IDs. */
export const nthServiceId = (n: number): string =>
  `0193a5b8-7c2e-7d4f-8a1b-${n.toString(16).padStart(12, '0')}`

/** An option of a request that satisfies every rule. */
export const serviceOptionRequest = (): ApiServiceOption => ({
  name: 'トリートメント',
  description: 'A treatment after the cut',
  optionType: 'addon',
  additionalTime: 15,
  additionalPrice: 1100,
  maxQuantity: 1,
  isRequired: false,
  sortOrder: 1,
  isActive: true,
})

/**
 * A request that satisfies every rule: a service in a category, not a
 * package, with a discount and one option.
 */
export const serviceCreateRequest = (): ApiServiceCreateRequest => ({
  categoryId: CATEGORY_ID,
  name: 'カット＆ブロー',
  description: 'A cut with a blow-dry',
  shortDescription: 'Cut and blow-dry',
  duration: 60,
  price: 6600,
  discountPrice: 5940,
  taxIncluded: true,
  pricingStrategy: 'fixed',
  imageUrl: 'https://aoyama.example.com/images/cut.jpg',
  imageUrls: ['https://aoyama.example.com/images/cut-1.jpg'],
  requiredStaffLevel: 'stylist',
  maxBookingsPerDay: 8,
  requiresConsultation: false,
  allowOnlineBooking: true,
  bookingRequirements: ['advance_booking_required'],
  isPackage: false,
  packageServiceIds: [],
  tags: ['popular'],
  sortOrder: 10,
  serviceStatus: 'active',
  availability: 'always',
  isActive: true,
  options: [serviceOptionRequest()],
})

/** A row of `services` as the driver returns it. */
export const dbService = (overrides: Partial<DbService> = {}): DbService => ({
  id: SERVICE_ID,
  salonId: SALON_ID,
  categoryId: CATEGORY_ID,
  name: 'カット＆ブロー',
  description: null,
  shortDescription: null,
  duration: 60,
  price: 6600,
  discountPrice: null,
  taxIncluded: true,
  pricingStrategy: 'fixed',
  imageUrl: null,
  imageUrls: [],
  requiredStaffLevel: null,
  maxBookingsPerDay: null,
  requiresConsultation: false,
  allowOnlineBooking: true,
  bookingRequirements: [],
  isPackage: false,
  packageServiceIds: [],
  tags: [],
  sortOrder: 10,
  serviceStatus: 'active',
  availability: 'always',
  isActive: true,
  deletedAt: null,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

/** A row of `service_options` as the driver returns it: an option of the service above. */
export const dbServiceOption = (
  overrides: Partial<DbServiceOption> = {},
): DbServiceOption => ({
  id: OPTION_ID,
  serviceId: SERVICE_ID,
  name: 'トリートメント',
  description: null,
  optionType: 'addon',
  additionalTime: 15,
  additionalPrice: 1100,
  maxQuantity: 1,
  isRequired: false,
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 18:00:00.123456+09',
  ...overrides,
})

/**
 * A repository that holds the one service above with its option, in which
 * every write succeeds; a test overrides what it needs.
 */
const serviceRepositoryWith = (
  overrides: Partial<IServiceRepository> = {},
): IServiceRepository => {
  const stored = { service: dbService(), options: [dbServiceOption()] }

  return {
    create: vi.fn(async () =>
      Result.success<ServiceCreation>({ type: 'created', service: stored }),
    ),
    findById: vi.fn(async () => Result.success(stored)),
    list: vi.fn(async () =>
      Result.success({ services: [stored], total: 1, hasMore: false }),
    ),
    update: vi.fn(async () =>
      Result.success<ServiceUpdate>({ type: 'updated', service: stored }),
    ),
    updateMany: vi.fn(async () =>
      Result.success<ServiceBulkUpdate>({ type: 'updated' }),
    ),
    delete: vi.fn(async () =>
      Result.success<ServiceDeletion>({ type: 'deleted' }),
    ),
    ...overrides,
  }
}

/**
 * Everything the service use cases need: the repository above and a salon
 * repository in which the salon exists.
 */
export const serviceDependencies = (
  services: Partial<IServiceRepository> = {},
  salons: Partial<ISalonRepository> = {},
): ServiceUseCaseDependencies => ({
  serviceRepository: serviceRepositoryWith(services),
  salonRepository: salonRepositoryWith(salons),
})
