import type { ModelsInventoryAlertSeverityType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { salon, staff } from '../../bookings/components/examples'
import { expiredColourAlert, outOfGlovesAlert } from '../components/examples'
import {
  ALERT_KIND_CHOICES,
  acknowledgementNameOf,
  alertKindIn,
  alertKindNameOf,
  alertSubjectNameOf,
  SEVERITY_CHOICES,
  severityIn,
  severityNameOf,
  severityToneOf,
  thresholdTermOf,
} from './alert-format'

/** A moment on the clock of the salon, as the formats write it */
const MOMENT = {
  en: 'Fri, November 20, 2026 at 09:30',
  ja: '2026年11月20日（金） 09:30',
}

describe('alertKindIn and severityIn', () => {
  it('should read the kinds and the severities of the contract, and nothing else', () => {
    // Act, Assert
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

    // Act, Assert
    expect(severities.map(severityToneOf)).toEqual([
      'danger',
      'warning',
      'info',
    ])
  })
})

describe('the names of the kinds and the severities', () => {
  it('should name every kind, in the order the filter offers them', () => {
    // Assert
    expect(ALERT_KIND_CHOICES).toEqual([
      { value: 'low_stock', label: { en: 'Low stock', ja: '在庫僅少' } },
      { value: 'overstock', label: { en: 'Overstock', ja: '在庫過剰' } },
      {
        value: 'expiring',
        label: { en: 'Expiring soon', ja: '期限切れ間近' },
      },
      { value: 'expired', label: { en: 'Expired', ja: '期限切れ' } },
    ])
    expect(alertKindNameOf('overstock')).toEqual({
      en: 'Overstock',
      ja: '在庫過剰',
    })
  })

  it('should name every severity, the heaviest first', () => {
    // Assert
    expect(SEVERITY_CHOICES).toEqual([
      { value: 'critical', label: { en: 'Critical', ja: '緊急' } },
      { value: 'warning', label: { en: 'Warning', ja: '注意' } },
      { value: 'info', label: { en: 'Info', ja: '情報' } },
    ])
    expect(severityNameOf('warning')).toEqual({ en: 'Warning', ja: '注意' })
  })
})

describe('alertSubjectNameOf', () => {
  it('should name a product by its code, and a stock row by its lot', () => {
    // Act, Assert
    expect(alertSubjectNameOf(outOfGlovesAlert)).toEqual({
      en: 'ニトリル手袋 M (SUP-GLOVE)',
      ja: 'ニトリル手袋 M（SUP-GLOVE）',
    })
    expect(alertSubjectNameOf(expiredColourAlert)).toEqual({
      en: 'ヘアカラー ナチュラルブラウン (lot LOT-2025-112)',
      ja: 'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）',
    })
  })

  it('should name a stock row without a lot by its product alone', () => {
    // Act, Assert
    expect(
      alertSubjectNameOf({ ...expiredColourAlert, lotNumber: null }),
    ).toEqual({
      en: 'ヘアカラー ナチュラルブラウン',
      ja: 'ヘアカラー ナチュラルブラウン',
    })
  })
})

describe('thresholdTermOf', () => {
  it('should hold the stock of a product short of it against its minimum, and one with too much against its maximum', () => {
    // Act, Assert
    expect(thresholdTermOf('low_stock')).toEqual({
      en: 'Minimum stock',
      ja: '最低在庫数',
    })
    expect(thresholdTermOf('overstock')).toEqual({
      en: 'Maximum stock',
      ja: '最大在庫数',
    })
  })
})

describe('acknowledgementNameOf', () => {
  const acknowledged = expiredColourAlert.acknowledgement

  it('should say when, on the clock of the salon, and who saw to an alert', () => {
    // Act, Assert
    expect(acknowledgementNameOf(acknowledged, salon.timezone, staff)).toEqual({
      en: `${MOMENT.en} (佐藤 健)`,
      ja: `${MOMENT.ja}（佐藤 健）`,
    })
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
    // Act, Assert
    expect(
      acknowledgementNameOf(
        acknowledged === null ? null : { ...acknowledged, acknowledgedBy },
        salon.timezone,
        members,
      ),
    ).toEqual(MOMENT)
  })

  it('should name a member who left as the staff names them, and say when nobody saw to an alert', () => {
    // Act, Assert
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
    ).toEqual({
      en: `${MOMENT.en} (Staff member not listed)`,
      ja: `${MOMENT.ja}（一覧にないスタッフ）`,
    })
    expect(acknowledgementNameOf(null, salon.timezone, staff)).toEqual({
      en: 'Not acknowledged',
      ja: '未確認',
    })
  })
})
