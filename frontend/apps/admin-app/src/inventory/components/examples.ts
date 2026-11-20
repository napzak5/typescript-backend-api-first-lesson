import type {
  ModelsInventoryAlertResponse,
  ModelsInventoryAlertSummaryResponse,
  ModelsInventoryResponse,
  ModelsInventoryStockCountResponse,
  ModelsInventoryTransactionResponse,
  ModelsInventoryValueReportResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { salon, staff } from '../../bookings/components/examples'
import { colour, gloves, shampoo } from '../../products/components/examples'

/*
 * The stock of the stories, at the salon of the stories on 20 November
 * 2026: two lots of a colour, one of them past its expiry; a shampoo,
 * not kept by lots, with notes; and gloves of which none is left.
 */

/** The day at the salon the stories are seen on */
export const TODAY = '2026-11-20'

const aStockRow = (
  row: Pick<ModelsInventoryResponse, 'id' | 'productId'> &
    Partial<ModelsInventoryResponse>,
): ModelsInventoryResponse => ({
  salonId: salon.id,
  currentStock: 0,
  availableStock: 0,
  reservedStock: 0,
  lotNumber: null,
  expiryDate: null,
  location: null,
  shelf: null,
  lastCountedAt: null,
  lastCountedBy: null,
  notes: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-11-01T01:00:00.000Z',
  ...row,
})

/** A lot of the colour, counted at the start of the month by a member of the staff. */
export const colourLot: ModelsInventoryResponse = aStockRow({
  id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
  productId: colour.id,
  currentStock: 12,
  availableStock: 12,
  lotNumber: 'LOT-2026-041',
  expiryDate: '2027-03-31',
  location: 'バックヤード',
  shelf: 'B-2',
  lastCountedAt: '2026-11-01T01:00:00.000Z',
  lastCountedBy: staff[1]?.id ?? null,
})

/** A lot of the colour past its expiry, half of a tube left of it. */
export const expiredColour: ModelsInventoryResponse = aStockRow({
  id: '6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c',
  productId: colour.id,
  currentStock: 2.5,
  availableStock: 2.5,
  lotNumber: 'LOT-2025-112',
  expiryDate: '2025-12-31',
  location: 'バックヤード',
  shelf: 'B-2',
})

/** The shampoo, not kept by lots, with notes of two lines. */
export const shampooRow: ModelsInventoryResponse = aStockRow({
  id: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  productId: shampoo.id,
  currentStock: 8,
  availableStock: 6,
  reservedStock: 2,
  location: '店頭の棚',
  notes: '箱を開けたものから使う。\n店頭の見本は数えない。',
})

/** Gloves, of which none is left and nothing is noted. */
export const glovesRow: ModelsInventoryResponse = aStockRow({
  id: '8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1e',
  productId: gloves.id,
})

/** The stock of the salon of the stories, in the order of the codes of the products and the lots */
export const STOCK_OF_THE_SALON: ModelsInventoryResponse[] = [
  expiredColour,
  colourLot,
  shampooRow,
  glovesRow,
]

const aMovement = (
  movement: Pick<
    ModelsInventoryTransactionResponse,
    'id' | 'transactionType' | 'quantity' | 'balanceAfter' | 'createdAt'
  > &
    Partial<ModelsInventoryTransactionResponse>,
): ModelsInventoryTransactionResponse => ({
  salonId: salon.id,
  productId: colourLot.productId,
  inventoryId: colourLot.id,
  balanceBefore: movement.balanceAfter - movement.quantity,
  unitCost: null,
  totalCost: null,
  referenceType: null,
  referenceId: null,
  lotNumber: colourLot.lotNumber,
  expiryDate: colourLot.expiryDate,
  reason: null,
  performedBy: staff[0]?.id ?? null,
  ...movement,
})

/** A member of the staff who left the salon: the salon shows no profile of them */
const LEFT_MEMBER = '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b'

/**
 * The movements of the lot of the colour, the latest first: the stock it
 * began with, a receipt of a purchase order, a use in a treatment, a sale
 * by a member who left, and a disposal. They leave the 12 tubes it has.
 */
export const MOVEMENTS_OF_THE_LOT: ModelsInventoryTransactionResponse[] = [
  aMovement({
    id: 'a1b2c3d4-0005-4e6f-8a7b-9c0d1e2f3a4b',
    transactionType: 'disposal',
    quantity: -1.5,
    balanceAfter: 12,
    reason: 'キャップが割れていた',
    performedBy: staff[1]?.id ?? null,
    createdAt: '2026-11-19T09:00:00.000Z',
  }),
  aMovement({
    id: 'a1b2c3d4-0004-4e6f-8a7b-9c0d1e2f3a4b',
    transactionType: 'sale',
    quantity: -1,
    balanceAfter: 13.5,
    performedBy: LEFT_MEMBER,
    createdAt: '2026-11-12T03:15:00.000Z',
  }),
  aMovement({
    id: 'a1b2c3d4-0003-4e6f-8a7b-9c0d1e2f3a4b',
    transactionType: 'use',
    quantity: -15.5,
    balanceAfter: 14.5,
    createdAt: '2026-11-10T05:30:00.000Z',
  }),
  aMovement({
    id: 'a1b2c3d4-0002-4e6f-8a7b-9c0d1e2f3a4b',
    transactionType: 'purchase',
    quantity: 10,
    balanceAfter: 30,
    unitCost: 1200,
    totalCost: 12000,
    referenceType: 'purchase_order',
    referenceId: 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    performedBy: staff[1]?.id ?? null,
    createdAt: '2026-10-15T01:00:00.000Z',
  }),
  aMovement({
    id: 'a1b2c3d4-0001-4e6f-8a7b-9c0d1e2f3a4b',
    transactionType: 'adjustment',
    quantity: 20,
    balanceAfter: 20,
    reason: '在庫移動の記録を始めた時点の在庫数',
    performedBy: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  }),
]

/** When the count of the stories was recorded */
const COUNTED_AT = '2026-11-20T09:30:00.000Z'

/**
 * A count of the two lots of the colour and the shampoo: the lot past its
 * expiry and the shampoo differed from the books, the other lot did not.
 */
export const COUNT_OF_THE_SALON: ModelsInventoryStockCountResponse = {
  adjustments: [
    aMovement({
      id: 'a1b2c3d4-0006-4e6f-8a7b-9c0d1e2f3a4b',
      inventoryId: expiredColour.id,
      transactionType: 'adjustment',
      quantity: -0.5,
      balanceAfter: 2,
      lotNumber: expiredColour.lotNumber,
      expiryDate: expiredColour.expiryDate,
      reason: '棚卸しの差異',
      createdAt: COUNTED_AT,
    }),
    aMovement({
      id: 'a1b2c3d4-0007-4e6f-8a7b-9c0d1e2f3a4b',
      productId: shampooRow.productId,
      inventoryId: shampooRow.id,
      transactionType: 'adjustment',
      quantity: 1,
      balanceAfter: 9,
      lotNumber: null,
      expiryDate: null,
      reason: '棚卸しの差異',
      createdAt: COUNTED_AT,
    }),
  ],
  discrepancies: [
    {
      inventoryId: expiredColour.id,
      expected: 2.5,
      counted: 2,
      difference: -0.5,
    },
    { inventoryId: shampooRow.id, expected: 8, counted: 9, difference: 1 },
  ],
}

/**
 * The value of the stock of the salon at the purchase prices, the most
 * valuable category first: the shampoo, 8 bottles at ￥1,500, and the two
 * lots of the colour, 14.5 tubes at ￥800. The gloves have none left.
 */
export const VALUE_OF_THE_SALON: ModelsInventoryValueReportResponse = {
  totalValue: 23_600,
  totalItems: 2,
  categories: [
    { category: 'ヘアケア', itemCount: 1, value: 12_000 },
    { category: 'ヘアカラー', itemCount: 1, value: 11_600 },
  ],
}

const anAlert = (
  alert: Pick<
    ModelsInventoryAlertResponse,
    'alert' | 'severity' | 'productId' | 'currentStock'
  > &
    Partial<ModelsInventoryAlertResponse>,
  product: Pick<ModelsProductResponse, 'productCode' | 'name' | 'unit'>,
): ModelsInventoryAlertResponse => ({
  salonId: salon.id,
  productCode: product.productCode,
  productName: product.name,
  unit: product.unit,
  inventoryId: null,
  lotNumber: null,
  expiryDate: null,
  threshold: null,
  acknowledgement: null,
  ...alert,
})

/** The lot of the colour past its expiry, which a member of the staff saw to on the morning of the day. */
export const expiredColourAlert: ModelsInventoryAlertResponse = anAlert(
  {
    alert: 'expired',
    severity: 'critical',
    productId: colour.id,
    inventoryId: expiredColour.id,
    lotNumber: expiredColour.lotNumber,
    expiryDate: expiredColour.expiryDate,
    currentStock: expiredColour.currentStock,
    acknowledgement: {
      id: '0c1d2e3f-4a5b-4c6d-8e7f-8a9b0c1d2e3f',
      salonId: salon.id,
      productId: colour.id,
      inventoryId: expiredColour.id,
      alert: 'expired',
      severity: 'critical',
      threshold: null,
      expiryDate: expiredColour.expiryDate,
      notes: '廃棄の前に、メーカーに返品できるか問い合わせる。',
      acknowledgedBy: staff[1]?.id ?? null,
      acknowledgedAt: '2026-11-20T00:30:00.000Z',
    },
  },
  colour,
)

/** The gloves, of which none is left: nobody saw to it yet. */
export const outOfGlovesAlert: ModelsInventoryAlertResponse = anAlert(
  {
    alert: 'low_stock',
    severity: 'critical',
    productId: gloves.id,
    currentStock: glovesRow.currentStock,
    threshold: gloves.minimumStock,
  },
  gloves,
)

/** The alerts of the salon of the stories, in the order of the codes of their products */
export const ALERTS_OF_THE_SALON: ModelsInventoryAlertResponse[] = [
  expiredColourAlert,
  outOfGlovesAlert,
]

/** How many alerts the salon of the stories has */
export const SUMMARY_OF_THE_SALON: ModelsInventoryAlertSummaryResponse = {
  totalAlerts: 2,
  criticalAlerts: 2,
  warningAlerts: 0,
  infoAlerts: 0,
  unacknowledged: 1,
}

/**
 * An alert of each of the other kinds, as the salon sees them on other
 * days: the shampoo short of its minimum, then above its maximum, and a
 * lot of the colour that expires within 30 days.
 */
export const ALERTS_OF_OTHER_DAYS: ModelsInventoryAlertResponse[] = [
  anAlert(
    {
      alert: 'expiring',
      severity: 'warning',
      productId: colour.id,
      inventoryId: '1d2e3f4a-5b6c-4d7e-9f8a-9b0c1d2e3f4a',
      lotNumber: 'LOT-2026-077',
      expiryDate: '2026-12-10',
      currentStock: 6,
    },
    colour,
  ),
  anAlert(
    {
      alert: 'low_stock',
      severity: 'warning',
      productId: shampoo.id,
      currentStock: 4,
      threshold: shampoo.minimumStock,
    },
    shampoo,
  ),
  anAlert(
    {
      alert: 'overstock',
      severity: 'info',
      productId: shampoo.id,
      currentStock: 60,
      threshold: shampoo.maximumStock,
    },
    shampoo,
  ),
]
