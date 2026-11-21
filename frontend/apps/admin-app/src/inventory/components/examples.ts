import type {
  ModelsInventoryResponse,
  ModelsInventoryTransactionResponse,
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

/** A lot of the colour, counted at the start of the month. */
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
