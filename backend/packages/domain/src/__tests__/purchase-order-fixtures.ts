import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { PurchaseOrderUseCaseDependencies } from '../business-logic/purchase-order'
import type {
  ApiPurchaseOrderCreateRequest,
  DbPurchaseOrder,
  DbPurchaseOrderItem,
  DbReorderSuggestion,
  PurchaseOrderWithItems,
} from '../models/purchase-order'
import type {
  IPurchaseOrderRepository,
  PurchaseOrderChange,
  PurchaseOrderCreation,
  PurchaseOrderListing,
  PurchaseOrderReceipt,
  ReorderSuggestionListing,
} from '../repositories/purchase-order.repository'
import type { ISalonRepository } from '../repositories/salon.repository'
import type { IPurchaseOrderNumberIssuer } from '../services/purchase-order-number-issuer'
import { STAFF_ID } from './auth-fixtures'
import { SALON_ID, salonRepositoryWith } from './fixtures'
import { INVENTORY_ID, OTHER_INVENTORY_ID } from './inventory-fixtures'
import { PRODUCT_ID } from './product-fixtures'

export const PURCHASE_ORDER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01'
export const OTHER_PURCHASE_ORDER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f02'
const ITEM_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f11'
const OTHER_ITEM_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f12'

/**
 * A request that satisfies every rule: ten bottles of shampoo at 1,500 yen
 * and two and a half litres of a colour at 2,999 yen, with tax and
 * shipping, and everything else set.
 */
export const purchaseOrderCreateRequest = (
  overrides: Partial<ApiPurchaseOrderCreateRequest> = {},
): ApiPurchaseOrderCreateRequest => ({
  salonId: SALON_ID,
  supplier: 'Beauty Supply Tokyo',
  items: [
    { inventoryId: INVENTORY_ID, quantity: 10, unitPrice: 1500, notes: null },
    {
      inventoryId: OTHER_INVENTORY_ID,
      quantity: 2.5,
      unitPrice: 2999,
      notes: '至急',
    },
  ],
  taxAmount: 2250,
  shippingCost: 800,
  expectedDelivery: '2026-11-21T01:00:00.000Z',
  paymentTerms: '月末締め翌月末払い',
  notes: '定期補充',
  ...overrides,
})

/** A row of `purchase_orders` as the driver returns it: the order above, pending. */
const dbPurchaseOrder = (
  overrides: Partial<DbPurchaseOrder> = {},
): DbPurchaseOrder => ({
  id: PURCHASE_ORDER_ID,
  salonId: SALON_ID,
  orderNumber: 'PO-7K3M-Q9TX',
  supplier: 'Beauty Supply Tokyo',
  status: 'pending',
  // 15000 + round(2.5 × 2999 = 7497.5) = 15000 + 7498
  subtotal: 22498,
  taxAmount: 2250,
  shippingCost: 800,
  totalAmount: 25548,
  orderDate: '2026-11-14 18:00:00.123456+09',
  expectedDelivery: '2026-11-21 10:00:00+09',
  actualDelivery: null,
  deliveryNotes: null,
  paymentTerms: '月末締め翌月末払い',
  notes: '定期補充',
  approvedBy: null,
  approvedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdBy: STAFF_ID,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

/** The rows of `purchase_order_items` of the order above, in its order. */
export const dbPurchaseOrderItems = (): DbPurchaseOrderItem[] => [
  {
    id: ITEM_ID,
    purchaseOrderId: PURCHASE_ORDER_ID,
    inventoryId: INVENTORY_ID,
    productCode: 'SHMP001',
    productName: 'Moisture Shampoo 500ml',
    quantity: '10.00',
    unit: 'bottle',
    unitPrice: 1500,
    totalPrice: 15000,
    notes: null,
    sortOrder: 0,
  },
  {
    id: OTHER_ITEM_ID,
    purchaseOrderId: PURCHASE_ORDER_ID,
    // The stock row was deleted after the order.
    inventoryId: null,
    productCode: 'COL001',
    productName: 'Color Cream 1L',
    quantity: '2.50',
    unit: 'litre',
    unitPrice: 2999,
    totalPrice: 7498,
    notes: '至急',
    sortOrder: 1,
  },
]

/** The order above with its items. */
export const storedPurchaseOrder = (
  overrides: Partial<DbPurchaseOrder> = {},
): PurchaseOrderWithItems => ({
  order: dbPurchaseOrder(overrides),
  items: dbPurchaseOrderItems(),
})

/** A list of the one order above, with no page after it. */
const listedOrder = (): PurchaseOrderListing => ({
  type: 'listed',
  orders: [storedPurchaseOrder()],
  total: 1,
  hasMore: false,
})

const changed = (): Result<PurchaseOrderChange, never> =>
  Result.success({ type: 'changed', order: storedPurchaseOrder() })

/**
 * A product to reorder as the database works it out: 3 bottles in stock
 * and 2 on order against a reorder point of 10, up to a maximum of 24.
 */
export const dbReorderSuggestion = (
  overrides: Partial<DbReorderSuggestion> = {},
): DbReorderSuggestion => ({
  productId: PRODUCT_ID,
  productCode: 'SHMP001',
  productName: 'Moisture Shampoo 500ml',
  unit: 'bottle',
  supplier: 'Beauty Supply Tokyo',
  currentStock: '3.00',
  onOrderQuantity: '2.00',
  reorderPoint: '10.00',
  maximumStock: '24.00',
  suggestedQuantity: '19.00',
  lastOrderDate: '2026-11-14 18:00:00.123456+09',
  ...overrides,
})

/**
 * A repository that holds the one order above, in which every write
 * succeeds; a test overrides what it needs.
 */
const purchaseOrderRepositoryWith = (
  overrides: Partial<IPurchaseOrderRepository> = {},
): IPurchaseOrderRepository => ({
  create: vi.fn(async () =>
    Result.success<PurchaseOrderCreation>({
      type: 'created',
      order: storedPurchaseOrder({ status: 'draft' }),
    }),
  ),
  findById: vi.fn(async () => Result.success(storedPurchaseOrder())),
  list: vi.fn(async () => Result.success(listedOrder())),
  update: vi.fn(async () => changed()),
  approve: vi.fn(async () => changed()),
  cancel: vi.fn(async () => changed()),
  receive: vi.fn(async () =>
    Result.success<PurchaseOrderReceipt>({
      type: 'received',
      order: storedPurchaseOrder({
        status: 'delivered',
        actualDelivery: '2026-11-21 10:00:00+09',
      }),
    }),
  ),
  listReorderSuggestions: vi.fn(async () =>
    Result.success<ReorderSuggestionListing>({
      type: 'listed',
      suggestions: [dbReorderSuggestion()],
      total: 1,
      hasMore: false,
    }),
  ),
  ...overrides,
})

/** Issues `PO-0000-0001`, `PO-0000-0002`, … */
const sequentialNumberIssuer = (): IPurchaseOrderNumberIssuer => {
  let issued = 0
  return {
    issue: vi.fn(() => {
      issued += 1
      return `PO-0000-${String(issued).padStart(4, '0')}`
    }),
  }
}

/**
 * Everything the purchase order use cases need: the repository above, a
 * salon repository in which the salon of Tokyo exists, and the issuer
 * above.
 */
export const purchaseOrderDependencies = (
  orders: Partial<IPurchaseOrderRepository> = {},
  salons: Partial<ISalonRepository> = {},
): PurchaseOrderUseCaseDependencies => ({
  purchaseOrderRepository: purchaseOrderRepositoryWith(orders),
  salonRepository: salonRepositoryWith(salons),
  purchaseOrderNumberIssuer: sequentialNumberIssuer(),
})
