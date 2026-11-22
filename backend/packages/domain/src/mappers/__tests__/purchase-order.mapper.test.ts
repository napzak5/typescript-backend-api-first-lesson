import { describe, expect, it } from 'vitest'
import { STAFF_ID } from '../../__tests__/fixtures/auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  INVENTORY_ID,
  OTHER_INVENTORY_ID,
} from '../../__tests__/fixtures/inventory-fixtures'
import {
  OTHER_PRODUCT_ID,
  PRODUCT_ID,
} from '../../__tests__/fixtures/product-fixtures'
import {
  dbPurchaseOrderItems,
  dbReorderSuggestion,
  OTHER_PURCHASE_ORDER_ID,
  PURCHASE_ORDER_ID,
  purchaseOrderCreateRequest,
  storedPurchaseOrder,
} from '../../__tests__/fixtures/purchase-order-fixtures'
import type { LedgerReach } from '../../models/booking'
import { productIdSchema } from '../../models/product'
import { purchaseOrderIdSchema } from '../../models/purchase-order'
import { salonIdSchema } from '../../models/salon'
import { staffIdSchema } from '../../models/staff'
import {
  purchaseOrderCreateRequestSchema,
  purchaseOrderReceiveRequestSchema,
  purchaseOrderSearchRequestSchema,
  purchaseOrderUpdateRequestSchema,
  reorderSuggestionSearchRequestSchema,
} from '../../schemas/purchase-order.schema'
import { PurchaseOrderReadMapper } from '../read/purchase-order.mapper'
import { PurchaseOrderWriteMapper } from '../write/purchase-order.mapper'

describe('PurchaseOrderReadMapper', () => {
  it('names every column as it is, the items in their order without their own IDs, the quantities as numbers and the times in ISO 8601', () => {
    expect(
      PurchaseOrderReadMapper.toApiPurchaseOrder(storedPurchaseOrder()),
    ).toEqual({
      type: 'success',
      data: {
        id: PURCHASE_ORDER_ID,
        salonId: SALON_ID,
        orderNumber: 'PO-7K3M-Q9TX',
        supplier: 'Beauty Supply Tokyo',
        status: 'pending',
        items: [
          {
            inventoryId: INVENTORY_ID,
            productCode: 'SHMP001',
            productName: 'Moisture Shampoo 500ml',
            quantity: 10,
            unit: 'bottle',
            unitPrice: 1500,
            totalPrice: 15000,
            notes: null,
          },
          {
            inventoryId: null,
            productCode: 'COL001',
            productName: 'Color Cream 1L',
            quantity: 2.5,
            unit: 'litre',
            unitPrice: 2999,
            totalPrice: 7498,
            notes: '至急',
          },
        ],
        subtotal: 22498,
        taxAmount: 2250,
        shippingCost: 800,
        totalAmount: 25548,
        orderDate: '2026-11-14T09:00:00.123Z',
        expectedDelivery: '2026-11-21T01:00:00.000Z',
        actualDelivery: null,
        deliveryNotes: null,
        paymentTerms: '月末締め翌月末払い',
        notes: '定期補充',
        approvedBy: null,
        approvedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        createdBy: STAFF_ID,
        createdAt: '2026-11-14T09:00:00.123Z',
        updatedAt: '2026-11-14T09:30:00.000Z',
      },
    })
  })

  it('shows the times of an approval, a cancellation and a delivery, and keeps null for what is not set', () => {
    const mapped = PurchaseOrderReadMapper.toApiPurchaseOrder(
      storedPurchaseOrder({
        status: 'cancelled',
        shippingCost: null,
        expectedDelivery: null,
        actualDelivery: '2026-11-20 09:00:00+09',
        approvedBy: STAFF_ID,
        approvedAt: '2026-11-15 10:00:00.5+09',
        cancelledAt: '2026-11-16 12:00:00+00',
        cancellationReason: '仕入先の在庫切れ',
        createdBy: null,
      }),
    )

    expect(mapped).toMatchObject({
      type: 'success',
      data: {
        status: 'cancelled',
        shippingCost: null,
        expectedDelivery: null,
        actualDelivery: '2026-11-20T00:00:00.000Z',
        approvedBy: STAFF_ID,
        approvedAt: '2026-11-15T01:00:00.500Z',
        cancelledAt: '2026-11-16T12:00:00.000Z',
        cancellationReason: '仕入先の在庫切れ',
        createdBy: null,
      },
    })
  })

  it('shows no column it does not name, of the order or of an item', () => {
    const { order, items } = storedPurchaseOrder()
    const mapped = PurchaseOrderReadMapper.toApiPurchaseOrder({
      order: { ...order, ...{ internalNote: 'x' } },
      items: items.map((item) => ({ ...item, ...{ costCentre: 'y' } })),
    })

    expect(mapped).toEqual(
      PurchaseOrderReadMapper.toApiPurchaseOrder(storedPurchaseOrder()),
    )
  })

  it.each([
    ['a date that is not a time', { orderDate: 'today' }],
    ['an expected delivery that is not a time', { expectedDelivery: 'soon' }],
    ['a delivery that is not a time', { actualDelivery: 'x' }],
    ['an approval that is not a time', { approvedAt: 'x' }],
    ['a cancellation that is not a time', { cancelledAt: 'x' }],
    ['a creation that is not a time', { createdAt: 'x' }],
    ['a change that is not a time', { updatedAt: 'x' }],
  ])('tells the database is wrong of %s', (_case, overrides) => {
    expect(
      PurchaseOrderReadMapper.toApiPurchaseOrder(
        storedPurchaseOrder(overrides),
      ),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored purchase order ${PURCHASE_ORDER_ID} does not match the API model`,
      },
    })
  })

  it('tells the database is wrong of an item whose quantity is not a number, naming the item', () => {
    const [first, second] = dbPurchaseOrderItems()
    const mapped = PurchaseOrderReadMapper.toApiPurchaseOrder({
      order: storedPurchaseOrder().order,
      items: [
        ...(first === undefined ? [] : [first]),
        ...(second === undefined ? [] : [{ ...second, quantity: 'many' }]),
      ],
    })

    expect(mapped).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored item ${second?.id} of purchase order ${PURCHASE_ORDER_ID} does not match the API model`,
      },
    })
  })

  it('maps each order of a list, and stops at the first it cannot', () => {
    const other = storedPurchaseOrder({ id: OTHER_PURCHASE_ORDER_ID })
    expect(
      PurchaseOrderReadMapper.toApiPurchaseOrders([
        storedPurchaseOrder(),
        other,
      ]),
    ).toMatchObject({
      type: 'success',
      data: [{ id: PURCHASE_ORDER_ID }, { id: OTHER_PURCHASE_ORDER_ID }],
    })
    expect(
      PurchaseOrderReadMapper.toApiPurchaseOrders([
        storedPurchaseOrder(),
        storedPurchaseOrder({ id: OTHER_PURCHASE_ORDER_ID, orderDate: 'x' }),
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        message: `Stored purchase order ${OTHER_PURCHASE_ORDER_ID} does not match the API model`,
      },
    })
  })
})

describe('PurchaseOrderWriteMapper', () => {
  it('writes what the request states, the amounts it comes to and who drafts it, and the quantities as numeric text', () => {
    const request = purchaseOrderCreateRequestSchema.parse(
      purchaseOrderCreateRequest(),
    )

    expect(
      PurchaseOrderWriteMapper.fromCreateRequest(
        request,
        staffIdSchema.parse(STAFF_ID),
      ),
    ).toEqual({
      order: {
        salonId: SALON_ID,
        supplier: 'Beauty Supply Tokyo',
        subtotal: 22498,
        taxAmount: 2250,
        shippingCost: 800,
        totalAmount: 25548,
        expectedDelivery: '2026-11-21T01:00:00.000Z',
        paymentTerms: '月末締め翌月末払い',
        notes: '定期補充',
        createdBy: STAFF_ID,
      },
      items: [
        {
          inventoryId: INVENTORY_ID,
          quantity: '10.00',
          unitPrice: 1500,
          totalPrice: 15000,
          notes: null,
        },
        {
          inventoryId: OTHER_INVENTORY_ID,
          quantity: '2.50',
          unitPrice: 2999,
          totalPrice: 7498,
          notes: '至急',
        },
      ],
    })
  })

  it('writes no shipping into the total of an order without it, and no staff member for an administrator', () => {
    const request = purchaseOrderCreateRequestSchema.parse(
      purchaseOrderCreateRequest({ shippingCost: null }),
    )

    expect(
      PurchaseOrderWriteMapper.fromCreateRequest(request, null).order,
    ).toMatchObject({ shippingCost: null, totalAmount: 24748, createdBy: null })
  })

  it('writes what an update states and nothing else', () => {
    expect(
      PurchaseOrderWriteMapper.fromUpdateRequest(
        purchaseOrderUpdateRequestSchema.parse({
          status: 'pending',
          deliveryNotes: null,
        }),
      ),
    ).toEqual({ status: 'pending', deliveryNotes: null })
  })
})

describe('PurchaseOrderWriteMapper: a cancellation and a receipt', () => {
  it('takes the reason of a cancellation as it is stated', () => {
    expect(
      PurchaseOrderWriteMapper.fromCancelRequest({
        cancellationReason: '仕入先の在庫切れ',
      }),
    ).toStrictEqual({ cancellationReason: '仕入先の在庫切れ' })
  })

  it('takes what arrived in the order of the receipt, its notes and the staff member who received it', () => {
    expect(
      PurchaseOrderWriteMapper.fromReceiveRequest(
        purchaseOrderReceiveRequestSchema.parse({
          items: [
            { inventoryId: OTHER_INVENTORY_ID, quantity: 2.5 },
            { inventoryId: INVENTORY_ID, quantity: 4 },
          ],
          deliveryNotes: '箱に傷あり',
        }),
        staffIdSchema.parse(STAFF_ID),
      ),
    ).toStrictEqual({
      items: [
        { inventoryId: OTHER_INVENTORY_ID, quantity: 2.5 },
        { inventoryId: INVENTORY_ID, quantity: 4 },
      ],
      deliveryNotes: '箱に傷あり',
      performedBy: STAFF_ID,
    })
  })

  it('takes a receipt without notes, by no staff member', () => {
    expect(
      PurchaseOrderWriteMapper.fromReceiveRequest(
        purchaseOrderReceiveRequestSchema.parse({
          items: [{ inventoryId: INVENTORY_ID, quantity: 1 }],
          deliveryNotes: null,
        }),
        null,
      ),
    ).toStrictEqual({
      items: [{ inventoryId: INVENTORY_ID, quantity: 1 }],
      deliveryNotes: null,
      performedBy: null,
    })
  })
})

describe('PurchaseOrderWriteMapper.fromSearchRequest', () => {
  const everySalon: LedgerReach = { type: 'everySalon' }
  const unfiltered = {
    salonId: null,
    status: null,
    supplier: null,
    startDate: null,
    endDate: null,
  }

  it('lists the first 20 orders within the reach when the request names nothing', () => {
    expect(
      PurchaseOrderWriteMapper.fromSearchRequest(
        purchaseOrderSearchRequestSchema.parse({}),
        everySalon,
      ),
    ).toStrictEqual({
      reach: everySalon,
      limit: 20,
      after: null,
      ...unfiltered,
    })
  })

  it('takes the reach it is given, the place of the page and every filter the request names', () => {
    const ownSalon: LedgerReach = {
      type: 'salon',
      salonId: salonIdSchema.parse(OTHER_SALON_ID),
    }

    expect(
      PurchaseOrderWriteMapper.fromSearchRequest(
        purchaseOrderSearchRequestSchema.parse({
          limit: 5,
          cursor: PURCHASE_ORDER_ID,
          salonId: SALON_ID,
          status: 'approved',
          supplier: 'Beauty Supply Tokyo',
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-11-30T23:59:59.999Z',
        }),
        ownSalon,
      ),
    ).toStrictEqual({
      reach: ownSalon,
      limit: 5,
      after: PURCHASE_ORDER_ID,
      salonId: SALON_ID,
      status: 'approved',
      supplier: 'Beauty Supply Tokyo',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    })
  })

  it.each<[string, Record<string, string>]>([
    ['the salon', { salonId: SALON_ID }],
    ['the status', { status: 'draft' }],
    ['the supplier', { supplier: 'Beauty Supply Tokyo' }],
    ['the first moment', { startDate: '2026-11-01T00:00:00.000Z' }],
    ['the last moment', { endDate: '2026-11-30T23:59:59.999Z' }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      PurchaseOrderWriteMapper.fromSearchRequest(
        purchaseOrderSearchRequestSchema.parse(filter),
        everySalon,
      ),
    ).toStrictEqual({
      reach: everySalon,
      limit: 20,
      after: null,
      ...unfiltered,
      ...filter,
    })
  })
})

describe('PurchaseOrderWriteMapper.fromReorderSuggestionSearchRequest', () => {
  it('suggests the first 20 products of the salon when the request names no more than the salon', () => {
    expect(
      PurchaseOrderWriteMapper.fromReorderSuggestionSearchRequest(
        reorderSuggestionSearchRequestSchema.parse({ salonId: SALON_ID }),
      ),
    ).toStrictEqual({ salonId: SALON_ID, limit: 20, after: null })
  })

  it('takes the place of the page the request names', () => {
    expect(
      PurchaseOrderWriteMapper.fromReorderSuggestionSearchRequest(
        reorderSuggestionSearchRequestSchema.parse({
          salonId: OTHER_SALON_ID,
          limit: 5,
          cursor: PRODUCT_ID,
        }),
      ),
    ).toStrictEqual({ salonId: OTHER_SALON_ID, limit: 5, after: PRODUCT_ID })
  })
})

describe('PurchaseOrderReadMapper.toApiPurchaseOrderPage', () => {
  const paging = {
    limit: 2,
    after: purchaseOrderIdSchema.parse(PURCHASE_ORDER_ID),
  }

  it('answers with the orders, the counts of the list and the place of the page', () => {
    expect(
      PurchaseOrderReadMapper.toApiPurchaseOrderPage(
        {
          type: 'listed',
          orders: [
            storedPurchaseOrder(),
            storedPurchaseOrder({ id: OTHER_PURCHASE_ORDER_ID }),
          ],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: PURCHASE_ORDER_ID }, { id: OTHER_PURCHASE_ORDER_ID }],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: PURCHASE_ORDER_ID,
          nextCursor: OTHER_PURCHASE_ORDER_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      PurchaseOrderReadMapper.toApiPurchaseOrderPage(
        {
          type: 'listed',
          orders: [storedPurchaseOrder()],
          total: 1,
          hasMore: false,
        },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
  })

  it('fails on the first order that does not match the API model', () => {
    expect(
      PurchaseOrderReadMapper.toApiPurchaseOrderPage(
        {
          type: 'listed',
          orders: [
            storedPurchaseOrder(),
            storedPurchaseOrder({
              id: OTHER_PURCHASE_ORDER_ID,
              orderDate: 'x',
            }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'error',
      error: {
        message: `Stored purchase order ${OTHER_PURCHASE_ORDER_ID} does not match the API model`,
      },
    })
  })
})

describe('PurchaseOrderReadMapper.toApiReorderSuggestionPage', () => {
  const paging = { limit: 2, after: productIdSchema.parse(PRODUCT_ID) }

  it('answers with the suggestions, the counts of the list and the place of the page, which goes on after the product of its last suggestion', () => {
    expect(
      PurchaseOrderReadMapper.toApiReorderSuggestionPage(
        {
          type: 'listed',
          suggestions: [
            dbReorderSuggestion(),
            dbReorderSuggestion({ productId: OTHER_PRODUCT_ID }),
          ],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        data: [{ productId: PRODUCT_ID }, { productId: OTHER_PRODUCT_ID }],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: PRODUCT_ID,
          nextCursor: OTHER_PRODUCT_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one, an empty one too', () => {
    expect(
      PurchaseOrderReadMapper.toApiReorderSuggestionPage(
        {
          type: 'listed',
          suggestions: [dbReorderSuggestion()],
          total: 1,
          hasMore: false,
        },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
    expect(
      PurchaseOrderReadMapper.toApiReorderSuggestionPage(
        { type: 'listed', suggestions: [], total: 0, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toStrictEqual({
      type: 'success',
      data: {
        data: [],
        meta: {
          total: 0,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('fails on the first suggestion that does not match the API model', () => {
    expect(
      PurchaseOrderReadMapper.toApiReorderSuggestionPage(
        {
          type: 'listed',
          suggestions: [
            dbReorderSuggestion(),
            dbReorderSuggestion({
              productId: OTHER_PRODUCT_ID,
              currentStock: 'few',
            }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'error',
      error: {
        message: `Reorder suggestion of product ${OTHER_PRODUCT_ID} does not match the API model`,
      },
    })
  })
})

describe('PurchaseOrderReadMapper.toApiReorderSuggestions', () => {
  it('names every value as it is, the quantities as numbers and the date of the latest order in ISO 8601', () => {
    expect(
      PurchaseOrderReadMapper.toApiReorderSuggestions([
        dbReorderSuggestion(),
        dbReorderSuggestion({
          productId: OTHER_PRODUCT_ID,
          supplier: null,
          onOrderQuantity: '0',
          maximumStock: null,
          suggestedQuantity: '7.50',
          lastOrderDate: null,
        }),
      ]),
    ).toEqual({
      type: 'success',
      data: [
        {
          productId: PRODUCT_ID,
          productCode: 'SHMP001',
          productName: 'Moisture Shampoo 500ml',
          unit: 'bottle',
          supplier: 'Beauty Supply Tokyo',
          currentStock: 3,
          onOrderQuantity: 2,
          reorderPoint: 10,
          maximumStock: 24,
          suggestedQuantity: 19,
          lastOrderDate: '2026-11-14T09:00:00.123Z',
        },
        {
          productId: OTHER_PRODUCT_ID,
          productCode: 'SHMP001',
          productName: 'Moisture Shampoo 500ml',
          unit: 'bottle',
          supplier: null,
          currentStock: 3,
          onOrderQuantity: 0,
          reorderPoint: 10,
          maximumStock: null,
          suggestedQuantity: 7.5,
          lastOrderDate: null,
        },
      ],
    })
  })

  it('tells a suggestion it cannot read as an error of the database', () => {
    expect(
      PurchaseOrderReadMapper.toApiReorderSuggestions([
        dbReorderSuggestion(),
        dbReorderSuggestion({
          productId: OTHER_PRODUCT_ID,
          lastOrderDate: 'x',
        }),
      ]),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Reorder suggestion of product ${OTHER_PRODUCT_ID} does not match the API model`,
      },
    })
  })
})
