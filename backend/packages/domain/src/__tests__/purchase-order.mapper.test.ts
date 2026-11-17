import { describe, expect, it } from 'vitest'
import { PurchaseOrderReadMapper } from '../mappers/read/purchase-order.mapper'
import { PurchaseOrderWriteMapper } from '../mappers/write/purchase-order.mapper'
import { staffIdSchema } from '../models/staff'
import {
  purchaseOrderCreateRequestSchema,
  purchaseOrderUpdateRequestSchema,
} from '../schemas/purchase-order.schema'
import { STAFF_ID } from './auth-fixtures'
import { SALON_ID } from './fixtures'
import { INVENTORY_ID, OTHER_INVENTORY_ID } from './inventory-fixtures'
import {
  dbPurchaseOrderItems,
  OTHER_PURCHASE_ORDER_ID,
  PURCHASE_ORDER_ID,
  purchaseOrderCreateRequest,
  storedPurchaseOrder,
} from './purchase-order-fixtures'

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
