import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { InventoryAlertUseCaseDependencies } from '../business-logic/inventory-alert'
import type {
  DbAcknowledgementOfAlert,
  DbInventoryAlertAcknowledgement,
  DbProductStockOfAlert,
  DbStockRowOfAlert,
} from '../models/inventory-alert'
import type {
  IInventoryAlertRepository,
  InventoryAlertAcknowledging,
  InventoryAlertFactsAfter,
} from '../repositories/inventory-alert.repository'
import type { ISalonRepository } from '../repositories/salon.repository'
import { NOW, STAFF_ID } from './auth-fixtures'
import { SALON_ID, salonRepositoryWith } from './fixtures'
import { INVENTORY_ID } from './inventory-fixtures'
import { PRODUCT_ID } from './product-fixtures'

export const ACKNOWLEDGEMENT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d01'

/** At NOW the salon of the fixtures (Asia/Tokyo) is on 2026-11-14. */
export const DAYS = { today: '2026-11-14', lastExpiringDay: '2026-12-14' }

/** A product of the salon whose stock of 3 is below its minimum of 5. */
export const productStock = (
  overrides: Partial<DbProductStockOfAlert> = {},
): DbProductStockOfAlert => ({
  productId: PRODUCT_ID,
  salonId: SALON_ID,
  productCode: 'SHMP001',
  productName: 'モイストシャンプー',
  unit: '本',
  minimumStock: '5.00',
  maximumStock: '20.00',
  stock: '3.00',
  place: 1,
  ...overrides,
})

/** A stock row of the product with 2.50 that expires in ten days. */
export const stockRow = (
  overrides: Partial<DbStockRowOfAlert> = {},
): DbStockRowOfAlert => ({
  inventoryId: INVENTORY_ID,
  salonId: SALON_ID,
  productId: PRODUCT_ID,
  productCode: 'SHMP001',
  productName: 'モイストシャンプー',
  unit: '本',
  lotNumber: 'LOT-2026-001',
  expiryDate: '2026-11-24',
  currentStock: '2.50',
  place: 1,
  ...overrides,
})

/**
 * A row of `inventory_alert_acknowledgements` as the driver returns it: the
 * low stock of the product above, acknowledged as a warning at a minimum of
 * 5 by a staff member.
 */
export const dbAcknowledgement = (
  overrides: Partial<DbInventoryAlertAcknowledgement> = {},
): DbInventoryAlertAcknowledgement => ({
  id: ACKNOWLEDGEMENT_ID,
  salonId: SALON_ID,
  productId: PRODUCT_ID,
  inventoryId: null,
  alert: 'low_stock',
  severity: 'warning',
  threshold: '5.00',
  expiryDate: null,
  notes: '発注済み',
  acknowledgedBy: STAFF_ID,
  acknowledgedAt: '2026-11-14 17:00:00.123456+09',
  ...overrides,
})

/** The acknowledgement above, with a stock that stayed at 3 since. */
export const productAcknowledgement = (
  overrides: Partial<DbInventoryAlertAcknowledgement> = {},
  since: { lowestStock: string; highestStock: string } = {
    lowestStock: '3.00',
    highestStock: '3.00',
  },
): DbAcknowledgementOfAlert => ({
  type: 'product',
  acknowledgement: dbAcknowledgement(overrides),
  ...since,
})

/** The row above acknowledged as expiring, with no movement of it since. */
export const stockRowAcknowledgement = (
  overrides: Partial<DbInventoryAlertAcknowledgement> = {},
  lowestStock: string | null = null,
): DbAcknowledgementOfAlert => ({
  type: 'stockRow',
  acknowledgement: dbAcknowledgement({
    inventoryId: INVENTORY_ID,
    alert: 'expiring',
    severity: 'warning',
    threshold: null,
    expiryDate: '2026-11-24',
    ...overrides,
  }),
  lowestStock,
})

/** A repository that finds the product and the row above and no acknowledgement. */
const inventoryAlertRepositoryWith = (
  overrides: Partial<IInventoryAlertRepository> = {},
): IInventoryAlertRepository => {
  const facts = {
    products: [productStock()],
    rows: [stockRow()],
    acknowledgements: [],
  }

  return {
    listFacts: vi.fn(async () => Result.success(facts)),
    listFactsAfter: vi.fn(async () =>
      Result.success<InventoryAlertFactsAfter>({
        type: 'listed',
        facts,
        after: { place: 0, inventoryId: null, expiryDate: null },
      }),
    ),
    acknowledge: vi.fn(async () =>
      Result.success<InventoryAlertAcknowledging>({ type: 'notActive' }),
    ),
    ...overrides,
  }
}

export const inventoryAlertDependencies = (
  alerts: Partial<IInventoryAlertRepository> = {},
  salons: Partial<ISalonRepository> = {},
  clock: () => Date = () => NOW,
): InventoryAlertUseCaseDependencies => ({
  inventoryAlertRepository: inventoryAlertRepositoryWith(alerts),
  salonRepository: salonRepositoryWith(salons),
  clock,
})
