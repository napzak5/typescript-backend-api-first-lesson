import type { ModelsInventoryAlertSeverityType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { salon, staff } from '../../bookings/components/examples'
import { expiredColourAlert, outOfGlovesAlert } from '../components/examples'
import {
  acknowledgementNameOf,
  alertKindIn,
  alertNameOf,
  alertSubjectNameOf,
  severityIn,
  severityToneOf,
  thresholdTermOf,
} from './alert-format'

describe('alertKindIn and severityIn', () => {
  it('should read the kinds and the severities of the contract, and nothing else', () => {
    expect(
      ['low_stock', 'overstock', 'expiring', 'expired', 'type', ''].map(
        alertKindIn,
      ),
    ).toEqual([
      'low_stock',
      'overstock',
      'expiring',
      'expired',
      undefined,
      undefined,
    ])
    expect(
      ['critical', 'warning', 'info', 'error', ''].map(severityIn),
    ).toEqual(['critical', 'warning', 'info', undefined, undefined])
  })
})

describe('severityToneOf', () => {
  it('should colour the severities, the heaviest the strongest', () => {
    const severities: ModelsInventoryAlertSeverityType[] = [
      'critical',
      'warning',
      'info',
    ]

    expect(severities.map(severityToneOf)).toEqual([
      'danger',
      'warning',
      'info',
    ])
  })
})

describe('alertSubjectNameOf and alertNameOf', () => {
  it('should name a product by its code, and a stock row by its lot', () => {
    expect(alertSubjectNameOf(outOfGlovesAlert)).toBe(
      'ニトリル手袋 M（SUP-GLOVE）',
    )
    expect(alertNameOf(expiredColourAlert)).toBe(
      'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）の期限切れ',
    )
  })

  it('should name a stock row without a lot by its product alone', () => {
    expect(alertSubjectNameOf({ ...expiredColourAlert, lotNumber: null })).toBe(
      'ヘアカラー ナチュラルブラウン',
    )
  })
})

describe('thresholdTermOf', () => {
  it('should hold the stock of a product short of it against its minimum, and one with too much against its maximum', () => {
    expect(thresholdTermOf('low_stock')).toBe('最低在庫数')
    expect(thresholdTermOf('overstock')).toBe('最大在庫数')
  })
})

describe('acknowledgementNameOf', () => {
  const acknowledged = expiredColourAlert.acknowledgement

  it('should say when, on the clock of the salon, and who saw to an alert', () => {
    expect(acknowledgementNameOf(acknowledged, salon.timezone, staff)).toBe(
      '2026年11月20日（金） 09:30（佐藤 健）',
    )
  })

  it.each<[string, Parameters<typeof acknowledgementNameOf>[2], string | null]>(
    [
      ['an administrator', staff, null],
      [
        'anybody while the staff are being read',
        undefined,
        staff[1]?.id ?? null,
      ],
    ],
  )('should name nobody for %s', (_, members, acknowledgedBy) => {
    expect(
      acknowledgementNameOf(
        acknowledged === null ? null : { ...acknowledged, acknowledgedBy },
        salon.timezone,
        members,
      ),
    ).toBe('2026年11月20日（金） 09:30')
  })

  it('should name a member who left as the staff names them, and say when nobody saw to an alert', () => {
    expect(
      acknowledgementNameOf(
        acknowledged === null
          ? null
          : {
              ...acknowledged,
              acknowledgedBy: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
            },
        salon.timezone,
        staff,
      ),
    ).toBe('2026年11月20日（金） 09:30（一覧にないスタッフ）')
    expect(acknowledgementNameOf(null, salon.timezone, staff)).toBe('未確認')
  })
})
