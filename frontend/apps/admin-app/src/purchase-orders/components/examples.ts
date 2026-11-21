import type {
  ModelsPurchaseOrderResponse,
  ModelsReorderSuggestionResponse,
} from '@beauty-salon-frontend/api-client'
import { salon, staff } from '../../bookings/components/examples'
import {
  colourLot,
  glovesRow,
  shampooRow,
} from '../../inventory/components/examples'
import { colour, gloves, shampoo } from '../../products/components/examples'

/*
 * The purchase orders of the stories, of the salon of the stories: a draft
 * of the colour and the shampoo made by a member of the staff, waiting for
 * approval; gloves ordered and approved by an administrator, to be
 * delivered with a shipping cost; and an order that was cancelled.
 */

const anOrder = (
  order: Pick<ModelsPurchaseOrderResponse, 'id' | 'orderNumber'> &
    Partial<ModelsPurchaseOrderResponse>,
): ModelsPurchaseOrderResponse => ({
  salonId: salon.id,
  supplier: '東京ビューティーサプライ',
  status: 'draft',
  items: [],
  subtotal: 0,
  taxAmount: 0,
  shippingCost: null,
  totalAmount: 0,
  orderDate: '2026-11-20T01:00:00.000Z',
  expectedDelivery: null,
  actualDelivery: null,
  deliveryNotes: null,
  paymentTerms: null,
  notes: null,
  approvedBy: null,
  approvedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdBy: null,
  createdAt: '2026-11-20T01:00:00.000Z',
  updatedAt: '2026-11-20T01:00:00.000Z',
  ...order,
})

/** The colour and the shampoo, made by a member of the staff and waiting for approval, with notes of two lines. */
export const pendingOrder: ModelsPurchaseOrderResponse = anOrder({
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c50',
  orderNumber: 'PO-7K3M-Q9TX',
  status: 'pending',
  items: [
    {
      inventoryId: colourLot.id,
      productCode: 'COLOR001',
      productName: 'ヘアカラー ナチュラルブラウン',
      unit: '本',
      quantity: 12,
      unitPrice: 800,
      totalPrice: 9600,
      notes: null,
    },
    {
      inventoryId: shampooRow.id,
      productCode: 'SHMP001',
      productName: 'プロフェッショナル シャンプー 500ml',
      unit: '本',
      quantity: 2.5,
      unitPrice: 1499,
      totalPrice: 3748,
      notes: '店頭の見本の分を含む',
    },
  ],
  subtotal: 13348,
  taxAmount: 1334,
  totalAmount: 14682,
  orderDate: '2026-11-20T01:00:00.000Z',
  expectedDelivery: '2026-11-26T15:00:00.000Z',
  paymentTerms: '月末締め翌月末払い',
  notes: '年末の繁忙期の分。\n届いたら、バックヤードの棚 B-2 へ。',
  createdBy: staff[1]?.id ?? null,
})

/** Gloves ordered to the supplier, made and approved by an administrator, with a shipping cost. */
export const orderedGloves: ModelsPurchaseOrderResponse = anOrder({
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d61',
  orderNumber: 'PO-2H8R-W4VN',
  supplier: 'メディカルサプライ',
  status: 'ordered',
  items: [
    {
      inventoryId: glovesRow.id,
      productCode: 'SUP-GLOVE',
      productName: 'ニトリル手袋 M',
      unit: '箱',
      quantity: 10,
      unitPrice: 1200,
      totalPrice: 12000,
      notes: null,
    },
  ],
  subtotal: 12000,
  taxAmount: 1200,
  shippingCost: 800,
  totalAmount: 14000,
  orderDate: '2026-11-18T05:30:00.000Z',
  approvedAt: '2026-11-18T06:00:00.000Z',
  createdAt: '2026-11-18T05:30:00.000Z',
  updatedAt: '2026-11-19T00:00:00.000Z',
})

/** An order of a stock row removed since, cancelled by the owner. */
export const cancelledOrder: ModelsPurchaseOrderResponse = anOrder({
  id: 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e72',
  orderNumber: 'PO-9C5D-J3KP',
  status: 'cancelled',
  items: [
    {
      inventoryId: null,
      productCode: 'WAX001',
      productName: 'スタイリングワックス 80g',
      unit: '個',
      quantity: 24,
      unitPrice: 600,
      totalPrice: 14400,
      notes: null,
    },
  ],
  subtotal: 14400,
  taxAmount: 1440,
  totalAmount: 15840,
  orderDate: '2026-11-02T02:00:00.000Z',
  cancelledAt: '2026-11-03T00:15:00.000Z',
  cancellationReason: '仕入先の在庫切れ。別の仕入先に頼み直す。',
  createdBy: staff[0]?.id ?? null,
})

/**
 * The colour and the shampoo, shipped by the supplier, with the wax of a
 * stock row removed since, and notes of the delivery.
 */
export const shippedOrder: ModelsPurchaseOrderResponse = anOrder({
  ...pendingOrder,
  id: 'd4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f83',
  orderNumber: 'PO-4F6G-T2LX',
  status: 'shipped',
  items: [
    ...pendingOrder.items,
    {
      inventoryId: null,
      productCode: 'WAX001',
      productName: 'スタイリングワックス 80g',
      unit: '個',
      quantity: 6,
      unitPrice: 600,
      totalPrice: 3600,
      notes: null,
    },
  ],
  subtotal: 16948,
  taxAmount: 1694,
  totalAmount: 18642,
  approvedAt: '2026-11-20T02:00:00.000Z',
  deliveryNotes: '午前中に、裏口へ',
})

/** The orders of the salon of the stories, the latest made first */
export const ORDERS_OF_THE_SALON: ModelsPurchaseOrderResponse[] = [
  pendingOrder,
  orderedGloves,
  cancelledOrder,
]

/**
 * The reorder suggestions of the salon of the stories, in the order of
 * the codes of the products: the colour of its supplier, last ordered
 * with the pending order; the shampoo of another, a part of it on order;
 * and the gloves, which name no supplier, keep no maximum and were never
 * ordered.
 */
export const SUGGESTIONS_OF_THE_SALON: ModelsReorderSuggestionResponse[] = [
  {
    productId: colour.id,
    productCode: colour.productCode,
    productName: colour.name,
    unit: colour.unit,
    supplier: 'カラーテック・ジャパン',
    currentStock: 8,
    onOrderQuantity: 0,
    reorderPoint: 20,
    maximumStock: 100,
    suggestedQuantity: 92,
    lastOrderDate: '2026-11-02T02:00:00.000Z',
  },
  {
    productId: shampoo.id,
    productCode: shampoo.productCode,
    productName: shampoo.name,
    unit: shampoo.unit,
    supplier: '東京ビューティーサプライ',
    currentStock: 4.5,
    onOrderQuantity: 2.5,
    reorderPoint: 10,
    maximumStock: 50,
    suggestedQuantity: 43,
    lastOrderDate: '2026-11-20T01:00:00.000Z',
  },
  {
    productId: gloves.id,
    productCode: gloves.productCode,
    productName: gloves.name,
    unit: gloves.unit,
    supplier: null,
    currentStock: 0.5,
    onOrderQuantity: 0,
    reorderPoint: 2,
    maximumStock: null,
    suggestedQuantity: 1.5,
    lastOrderDate: null,
  },
]
