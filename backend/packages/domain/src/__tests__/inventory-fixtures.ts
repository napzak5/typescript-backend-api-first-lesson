import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { InventoryUseCaseDependencies } from '../business-logic/inventory'
import type {
  ApiInventoryCreateRequest,
  DbInventory,
} from '../models/inventory'
import type {
  IInventoryRepository,
  InventoryCreation,
  InventoryList,
  InventoryRemoval,
  InventoryUpdate,
} from '../repositories/inventory.repository'
import type { ISalonRepository } from '../repositories/salon.repository'
import { NOW, STAFF_ID } from './auth-fixtures'
import { SALON_ID, salonRepositoryWith } from './fixtures'
import { PRODUCT_ID } from './product-fixtures'

export const INVENTORY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'
export const OTHER_INVENTORY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e02'

/** A request that satisfies every rule: a lot of a colour, with everything set. */
export const inventoryCreateRequest = (): ApiInventoryCreateRequest => ({
  salonId: SALON_ID,
  productId: PRODUCT_ID,
  lotNumber: 'LOT-2026-001',
  expiryDate: '2027-03-31',
  location: '倉庫 A',
  shelf: 'A-3',
  notes: '開封後は冷暗所',
})

/** A row of `inventory` as the driver returns it: counted, some of it reserved. */
export const dbInventory = (
  overrides: Partial<DbInventory> = {},
): DbInventory => ({
  id: INVENTORY_ID,
  salonId: SALON_ID,
  productId: PRODUCT_ID,
  currentStock: '12.50',
  availableStock: '10.50',
  reservedStock: '2.00',
  lotNumber: 'LOT-2026-001',
  expiryDate: '2027-03-31',
  location: '倉庫 A',
  shelf: null,
  lastCountedAt: '2026-11-10 18:00:00+09',
  lastCountedBy: STAFF_ID,
  notes: null,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

/** A list of the one row above, with no page after it. */
export const listedRow = (): InventoryList => ({
  rows: [dbInventory()],
  total: 1,
  hasMore: false,
})

/**
 * A repository that holds the one row above, in which every write
 * succeeds; a test overrides what it needs.
 */
const inventoryRepositoryWith = (
  overrides: Partial<IInventoryRepository> = {},
): IInventoryRepository => ({
  create: vi.fn(async () =>
    Result.success<InventoryCreation>({ type: 'created', row: dbInventory() }),
  ),
  findById: vi.fn(async () => Result.success(dbInventory())),
  list: vi.fn(async () => Result.success(listedRow())),
  listLowStock: vi.fn(async () => Result.success(listedRow())),
  listExpiring: vi.fn(async () => Result.success(listedRow())),
  update: vi.fn(async () =>
    Result.success<InventoryUpdate>({ type: 'updated', row: dbInventory() }),
  ),
  delete: vi.fn(async () =>
    Result.success<InventoryRemoval>({ type: 'deleted' }),
  ),
  ...overrides,
})

/**
 * Everything the stock use cases need: the repository above, a salon
 * repository in which the salon of Tokyo exists, and a clock that tells
 * 2026-11-14 18:00 in Tokyo unless another is given.
 */
export const inventoryDependencies = (
  inventory: Partial<IInventoryRepository> = {},
  salons: Partial<ISalonRepository> = {},
  clock: () => Date = () => NOW,
): InventoryUseCaseDependencies => ({
  inventoryRepository: inventoryRepositoryWith(inventory),
  salonRepository: salonRepositoryWith(salons),
  clock,
})
