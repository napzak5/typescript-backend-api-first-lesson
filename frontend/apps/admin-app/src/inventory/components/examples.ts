import type { ModelsInventoryResponse } from '@beauty-salon-frontend/api-client'
import { salon } from '../../bookings/components/examples'
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
