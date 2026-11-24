import type { ModelsOrderStatusType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { salon, staff } from '../../bookings/components/examples'
import {
  deliveryDayNameOf,
  doneNameOf,
  itemQuantityNameOf,
  ORDER_STATUS_CHOICES,
  orderStatusIn,
  orderStatusToneOf,
} from './order-format'

const STATUSES: ModelsOrderStatusType[] = [
  'draft',
  'pending',
  'approved',
  'ordered',
  'shipped',
  'delivered',
  'cancelled',
]

describe('orderStatusIn', () => {
  it('should read the statuses of the contract, and nothing else', () => {
    // Assert
    expect([...STATUSES, 'lost', ''].map(orderStatusIn)).toEqual([
      ...STATUSES,
      undefined,
      undefined,
    ])
  })
})

describe('ORDER_STATUS_CHOICES and orderStatusToneOf', () => {
  it('should name every status in the order an order goes through them', () => {
    // Assert
    expect(ORDER_STATUS_CHOICES).toEqual([
      { value: 'draft', label: { en: 'Draft', ja: '下書き' } },
      { value: 'pending', label: { en: 'Awaiting approval', ja: '承認待ち' } },
      { value: 'approved', label: { en: 'Approved', ja: '承認済み' } },
      { value: 'ordered', label: { en: 'Ordered', ja: '発注済み' } },
      { value: 'shipped', label: { en: 'Shipped', ja: '出荷済み' } },
      { value: 'delivered', label: { en: 'Delivered', ja: '納品済み' } },
      { value: 'cancelled', label: { en: 'Cancelled', ja: '取り消し' } },
    ])
  })

  it('should colour what waits for somebody, what is under way and what was delivered apart', () => {
    // Assert
    expect(STATUSES.map(orderStatusToneOf)).toEqual([
      'neutral',
      'warning',
      'info',
      'info',
      'info',
      'success',
      'neutral',
    ])
  })
})

describe('deliveryDayNameOf', () => {
  it('should say the day of the delivery at the salon, or that none was set', () => {
    // Assert
    expect(
      deliveryDayNameOf('2026-11-26T15:00:00.000Z', salon.timezone),
    ).toEqual({ en: 'Fri, November 27, 2026', ja: '2026年11月27日（金）' })
    expect(deliveryDayNameOf(null, salon.timezone)).toEqual({
      en: 'Not set',
      ja: '未定',
    })
  })
})

describe('itemQuantityNameOf', () => {
  it('should say how much of what an item orders', () => {
    // Assert
    expect(itemQuantityNameOf({ quantity: 2.5, unit: '本' })).toEqual({
      en: '2.5 本',
      ja: '2.5 本',
    })
  })
})

describe('doneNameOf', () => {
  const MOMENT = '2026-11-20T01:00:00.000Z'
  const AT_TEN = {
    en: 'Fri, November 20, 2026 at 10:00',
    ja: '2026年11月20日（金） 10:00',
  }

  it('should say when, on the clock of the salon, and who did it', () => {
    // Assert
    expect(
      doneNameOf(MOMENT, staff[1]?.id ?? '', salon.timezone, staff),
    ).toEqual({
      en: 'Fri, November 20, 2026 at 10:00 (佐藤 健)',
      ja: '2026年11月20日（金） 10:00（佐藤 健）',
    })
  })

  it('should name nobody for an administrator, nor while the staff are read', () => {
    // Assert
    expect(doneNameOf(MOMENT, null, salon.timezone, staff)).toEqual(AT_TEN)
    expect(
      doneNameOf(MOMENT, staff[1]?.id ?? '', salon.timezone, undefined),
    ).toEqual(AT_TEN)
  })

  it('should say that a member who left is not listed', () => {
    // Assert
    expect(
      doneNameOf(
        MOMENT,
        '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
        salon.timezone,
        staff,
      ),
    ).toEqual({
      en: 'Fri, November 20, 2026 at 10:00 (Staff member not listed)',
      ja: '2026年11月20日（金） 10:00（一覧にないスタッフ）',
    })
  })
})
