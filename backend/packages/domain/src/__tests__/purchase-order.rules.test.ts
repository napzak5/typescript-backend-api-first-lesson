import type { OrderStatusType } from '@beauty-salon-backend/generated'
import { describe, expect, it } from 'vitest'
import {
  purchaseOrderNumberFrom,
  refusalOfApproval,
  refusalOfCancellation,
  refusalOfUpdate,
} from '../business-logic/purchase-order'
import {
  amountsOf,
  largestUnitPriceOf,
  totalPriceOf,
} from '../business-logic/purchase-order/_shared/amounts'
import {
  actingStaffOf,
  purchaseOrderApproverReachOf,
  purchaseOrderReachOf,
} from '../business-logic/purchase-order/_shared/authorization'
import { actors, STAFF_ID } from './auth-fixtures'
import { SALON_ID } from './fixtures'

const OPEN: OrderStatusType[] = [
  'draft',
  'pending',
  'approved',
  'ordered',
  'shipped',
]
const CLOSED: OrderStatusType[] = ['delivered', 'cancelled']
const EVERY: OrderStatusType[] = [...OPEN, ...CLOSED]

describe('refusalOfUpdate', () => {
  it.each<[OrderStatusType, OrderStatusType]>([
    ['draft', 'pending'],
    ['approved', 'ordered'],
    ['ordered', 'shipped'],
  ])('moves an order from %s to %s', (status, next) => {
    expect(refusalOfUpdate(status, next)).toBeNull()
  })

  it.each(OPEN)(
    'takes an update of a %s order that writes its status or none',
    (status) => {
      expect(refusalOfUpdate(status, status)).toBeNull()
      expect(refusalOfUpdate(status, undefined)).toBeNull()
    },
  )

  it('takes no other step of any open order', () => {
    const taken = OPEN.flatMap((status) =>
      EVERY.filter(
        (next) => next !== status && refusalOfUpdate(status, next) === null,
      ).map((next) => `${status}→${next}`),
    )
    const refused = OPEN.flatMap((status) =>
      EVERY.filter((next) => refusalOfUpdate(status, next) !== null).map(
        (next) => refusalOfUpdate(status, next)?.type,
      ),
    )

    expect(taken).toEqual([
      'draft→pending',
      'approved→ordered',
      'ordered→shipped',
    ])
    expect(new Set(refused)).toEqual(new Set(['notFromStatus']))
  })

  it.each(CLOSED)(
    'changes nothing of a %s order, its status least of all',
    (status) => {
      expect(refusalOfUpdate(status, undefined)).toEqual({
        type: 'closed',
        status,
      })
      expect(refusalOfUpdate(status, status)).toEqual({
        type: 'closed',
        status,
      })
      expect(refusalOfUpdate(status, 'pending')).toEqual({
        type: 'closed',
        status,
      })
    },
  )
})

describe('refusalOfApproval', () => {
  it('approves a pending order', () => {
    expect(refusalOfApproval('pending')).toBeNull()
  })

  it.each<OrderStatusType>(['draft', 'approved', 'ordered', 'shipped'])(
    'does not approve a %s order',
    (status) => {
      expect(refusalOfApproval(status)).toEqual({
        type: 'notFromStatus',
        status,
      })
    },
  )

  it.each(CLOSED)('does not approve a %s order, which is closed', (status) => {
    expect(refusalOfApproval(status)).toEqual({ type: 'closed', status })
  })
})

describe('refusalOfCancellation', () => {
  it.each(OPEN)('cancels a %s order', (status) => {
    expect(refusalOfCancellation(status)).toBeNull()
  })

  it.each(CLOSED)('does not cancel a %s order', (status) => {
    expect(refusalOfCancellation(status)).toEqual({ type: 'closed', status })
  })
})

describe('amounts', () => {
  it('rounds what an item comes to half up to the yen', () => {
    expect(totalPriceOf(2999, 2.5)).toBe(7498n)
    expect(totalPriceOf(3, 0.5)).toBe(2n)
    expect(totalPriceOf(1, 0.49)).toBe(0n)
    expect(totalPriceOf(1500, 10)).toBe(15_000n)
  })

  it('works out what an item comes to without the error of a number', () => {
    // 0.29 × 100 is 28.999999999999996 as a number.
    expect(totalPriceOf(100, 0.29)).toBe(29n)
    expect(totalPriceOf(2_147_483_647, 99_999_999.99)).toBe(
      214_748_364_678_525_164n,
    )
  })

  it('tells the largest unit price at which an item fits an integer', () => {
    expect(largestUnitPriceOf(3)).toBe(715_827_882)
    expect(largestUnitPriceOf(1)).toBe(2_147_483_647)
    expect(largestUnitPriceOf(1.5)).toBe(1_431_655_764)
    expect(largestUnitPriceOf(0.01)).toBe(214_748_364_749)
  })

  it('adds the items into the subtotal, and the tax and the shipping into the total', () => {
    const items = [
      { quantity: 10, unitPrice: 1500 },
      { quantity: 2.5, unitPrice: 2999 },
    ]

    expect(amountsOf(items, 2250, 800)).toEqual({
      subtotal: 22_498n,
      totalAmount: 25_548n,
    })
    expect(amountsOf(items, 2250, null)).toEqual({
      subtotal: 22_498n,
      totalAmount: 24_748n,
    })
  })
})

describe('purchaseOrderNumberFrom', () => {
  it('writes PO and two groups of four symbols, as the pick chooses them', () => {
    let picked = 0
    const pick = (count: number) => {
      expect(count).toBe(32)
      picked += 1
      return picked
    }

    expect(purchaseOrderNumberFrom(pick)).toBe('PO-1234-5678')
    expect(purchaseOrderNumberFrom(() => 31)).toBe('PO-ZZZZ-ZZZZ')
  })
})

describe('who reaches the purchase orders', () => {
  it('lets every member of a salon read and move on the orders of the salon, and an administrator those of every salon', () => {
    const roles: ('owner' | 'manager' | 'staff')[] = [
      'owner',
      'manager',
      'staff',
    ]
    for (const role of roles) {
      expect(purchaseOrderReachOf(actors.ofSalon(role))).toEqual({
        type: 'salon',
        salonId: SALON_ID,
      })
    }
    expect(purchaseOrderReachOf(actors.admin)).toEqual({ type: 'everySalon' })
    expect(purchaseOrderReachOf(actors.customer)).toBeNull()
    expect(purchaseOrderReachOf(actors.withoutScope)).toBeNull()
  })

  it('lets the owner and the managers approve and cancel, and an administrator, but not a staff member', () => {
    expect(purchaseOrderApproverReachOf(actors.ofSalon('owner'))).toEqual({
      type: 'salon',
      salonId: SALON_ID,
    })
    expect(purchaseOrderApproverReachOf(actors.ofSalon('manager'))).toEqual({
      type: 'salon',
      salonId: SALON_ID,
    })
    expect(purchaseOrderApproverReachOf(actors.admin)).toEqual({
      type: 'everySalon',
    })
    expect(purchaseOrderApproverReachOf(actors.ofSalon('staff'))).toBeNull()
    expect(purchaseOrderApproverReachOf(actors.customer)).toBeNull()
  })

  it('records the staff member a member of a salon is, and none for an administrator', () => {
    expect(actingStaffOf(actors.ofSalon('staff'))).toBe(STAFF_ID)
    expect(actingStaffOf(actors.admin)).toBeNull()
  })
})
