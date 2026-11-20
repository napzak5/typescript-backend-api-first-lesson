import type { ModelsOrderStatusType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { salon, staff } from '../bookings/components/examples'
import {
  deliveryDayNameOf,
  doneNameOf,
  itemQuantityNameOf,
  ORDER_STATUS_OPTIONS,
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
    expect([...STATUSES, 'lost', ''].map(orderStatusIn)).toEqual([
      ...STATUSES,
      undefined,
      undefined,
    ])
  })
})

describe('ORDER_STATUS_OPTIONS and orderStatusToneOf', () => {
  it('should name every status in the order an order goes through them', () => {
    expect(ORDER_STATUS_OPTIONS).toEqual([
      { value: 'draft', label: '下書き' },
      { value: 'pending', label: '承認待ち' },
      { value: 'approved', label: '承認済み' },
      { value: 'ordered', label: '発注済み' },
      { value: 'shipped', label: '出荷済み' },
      { value: 'delivered', label: '納品済み' },
      { value: 'cancelled', label: '取り消し' },
    ])
  })

  it('should colour what waits for somebody, what is under way and what was delivered apart', () => {
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
    expect(deliveryDayNameOf('2026-11-26T15:00:00.000Z', salon.timezone)).toBe(
      '2026年11月27日（金）',
    )
    expect(deliveryDayNameOf(null, salon.timezone)).toBe('未定')
  })
})

describe('itemQuantityNameOf', () => {
  it('should say how much of what an item orders', () => {
    expect(itemQuantityNameOf({ quantity: 2.5, unit: '本' })).toBe('2.5 本')
  })
})

describe('doneNameOf', () => {
  const MOMENT = '2026-11-20T01:00:00.000Z'

  it('should say when, on the clock of the salon, and who did it', () => {
    expect(doneNameOf(MOMENT, staff[1]?.id ?? '', salon.timezone, staff)).toBe(
      '2026年11月20日（金） 10:00（佐藤 健）',
    )
  })

  it('should name nobody for an administrator, nor while the staff are read', () => {
    expect(doneNameOf(MOMENT, null, salon.timezone, staff)).toBe(
      '2026年11月20日（金） 10:00',
    )
    expect(
      doneNameOf(MOMENT, staff[1]?.id ?? '', salon.timezone, undefined),
    ).toBe('2026年11月20日（金） 10:00')
  })

  it('should say that a member who left is not listed', () => {
    expect(
      doneNameOf(
        MOMENT,
        '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
        salon.timezone,
        staff,
      ),
    ).toBe('2026年11月20日（金） 10:00（一覧にないスタッフ）')
  })
})
