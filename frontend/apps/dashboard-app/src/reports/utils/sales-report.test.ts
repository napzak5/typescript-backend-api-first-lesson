import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { SalesReportExport } from '../api/sales-report-api'
import { afterReportExport, percentNameOf } from './sales-report'

const PERIOD = { from: '2026-11-01', to: '2026-11-21' }

const FILE = {
  name: 'sales-report-2026-11-01-2026-11-21.csv',
  type: 'text/csv; charset=utf-8',
  content: 'date,sales,tax,discounts,transactions,refunds,net\r\n',
}

describe('the words of a report', () => {
  it.each<[number, string]>([
    [0, '0.0%'],
    [33.3, '33.3%'],
    [33.333, '33.3%'],
    [50, '50.0%'],
    [100, '100.0%'],
  ])('should write a share of %s to one decimal', (percentage, written) => {
    // Act, Assert
    expect(percentNameOf(percentage)).toEqual({ en: written, ja: written })
  })
})

describe('afterReportExport', () => {
  it('should save the file and say which days it holds', () => {
    // Act, Assert
    expect(afterReportExport({ type: 'exported', file: FILE }, PERIOD)).toEqual(
      {
        type: 'saved',
        file: FILE,
        message: {
          en: 'The sales for Sun, November 1, 2026 – Sat, November 21, 2026 were exported to sales-report-2026-11-01-2026-11-21.csv.',
          ja: '2026年11月1日（日）〜2026年11月21日（土）の売上を、sales-report-2026-11-01-2026-11-21.csv に出力しました。',
        },
      },
    )
  })

  it.each<[string, SalesReportExport, LocalizedText]>([
    [
      'a salon that was removed',
      { type: 'notFound' },
      {
        en: 'This salon was removed, so its sales cannot be exported.',
        ja: 'このサロンは削除されたため、売上を出力できません。',
      },
    ],
    [
      'an account of another salon',
      { type: 'forbidden' },
      {
        en: 'This account cannot export the sales of this salon. Only the owner and the managers of the salon and the administrators can.',
        ja: 'このアカウントでは、このサロンの売上を出力できません。売上を出力できるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'a failure',
      { type: 'failed' },
      {
        en: 'The sales could not be exported. Check your connection and try again.',
        ja: '売上を出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should save nothing for %s, and say why', (_case, outcome, message) => {
    // Act, Assert
    expect(afterReportExport(outcome, PERIOD)).toEqual({
      type: 'refused',
      message,
    })
  })
})
