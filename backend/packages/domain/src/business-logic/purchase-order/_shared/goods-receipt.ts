import type { InventoryId } from '../../../models/inventory'
import { totalCostOf } from '../../inventory/_shared/movements'

/**
 * The receipt of the goods of an order. What arrived of each item is
 * taken into its stock row as a purchase, at the unit price of the item;
 * no more than was ordered of an item is received by the order, and an
 * item the receipt does not name did not arrive. Quantities are compared
 * in hundredths, as their `numeric(10, 2)` columns hold them.
 */

/** An item of the order, as stored: its quantity as the text of a `numeric`. */
export type OrderedItem = {
  inventoryId: string | null
  quantity: string
  unitPrice: number
}

/** What arrived of an item: the stock row it is ordered for, and how much. */
export type ReceivedItem = {
  inventoryId: InventoryId
  quantity: number
}

/** Why an item of a receipt is not taken, by its place in the receipt. */
export type GoodsReceiptRefusal =
  /** No item of the order is for the stock row. */
  | { type: 'notOrdered'; index: number }
  /** More arrived than the item orders; `ordered` is what it orders. */
  | { type: 'moreThanOrdered'; index: number; ordered: number }

/** A purchase a receipt records, in the order of the receipt. */
type GoodsReceiptMovement = {
  inventoryId: InventoryId
  /** The text of a `numeric` with two decimals. */
  quantity: string
  unitCost: number
  totalCost: number
}

export type GoodsReceiptPlan =
  | { type: 'planned'; movements: GoodsReceiptMovement[] }
  | { type: 'refused'; refusals: GoodsReceiptRefusal[] }

const hundredthsOf = (quantity: number): number => Math.round(quantity * 100)

/**
 * The purchases a receipt records for the items of an order, or every
 * item of it that the order does not take. An item of the order whose
 * stock row was deleted is for no row, and receives nothing. Stock row IDs
 * are compared in the spelling of the database: a receipt has named its
 * rows in that of its schema.
 */
export const planGoodsReceipt = (
  ordered: readonly OrderedItem[],
  received: readonly ReceivedItem[],
): GoodsReceiptPlan => {
  const byRow = new Map<string, OrderedItem>()
  for (const item of ordered) {
    if (item.inventoryId !== null) {
      byRow.set(item.inventoryId, item)
    }
  }
  const refusals: GoodsReceiptRefusal[] = []
  const movements: GoodsReceiptMovement[] = []
  received.forEach(({ inventoryId, quantity }, index) => {
    const item = byRow.get(inventoryId)
    if (item === undefined) {
      refusals.push({ type: 'notOrdered', index })
      return
    }
    const orderedQuantity = Number(item.quantity)
    if (hundredthsOf(quantity) > hundredthsOf(orderedQuantity)) {
      refusals.push({
        type: 'moreThanOrdered',
        index,
        ordered: orderedQuantity,
      })
      return
    }
    movements.push({
      inventoryId,
      quantity: quantity.toFixed(2),
      unitCost: item.unitPrice,
      totalCost: Number(totalCostOf(item.unitPrice, quantity)),
    })
  })

  return refusals.length > 0
    ? { type: 'refused', refusals }
    : { type: 'planned', movements }
}
