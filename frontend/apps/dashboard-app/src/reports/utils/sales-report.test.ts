import { describe, expect, it } from 'vitest'
import type { SalesReportExport } from '../api/sales-report-api'
import {
  afterReportExport,
  countNameOf,
  percentNameOf,
  rankNameOf,
} from './sales-report'

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
    [50, '50.0%'],
    [100, '100.0%'],
  ])('should write a share of %s to one decimal', (percentage, written) => {
    // Act, Assert
    expect(percentNameOf(percentage)).toBe(written)
  })

  it('should count and rank in the words of the salon', () => {
    // Act, Assert
    expect(countNameOf(1234)).toBe('1,234 件')
    expect(rankNameOf(1)).toBe('1 位')
  })
})

describe('afterReportExport', () => {
  it('should save the file and say which days it holds', () => {
    // Act, Assert
    expect(afterReportExport({ type: 'exported', file: FILE }, PERIOD)).toEqual(
      {
        type: 'saved',
        file: FILE,
        message:
          '2026年11月1日（日）〜2026年11月21日（土）の売上を、sales-report-2026-11-01-2026-11-21.csv に出力しました。',
      },
    )
  })

  it.each<[string, SalesReportExport, string]>([
    [
      'a salon that was removed',
      { type: 'notFound' },
      'このサロンは削除されたため、売上を出力できません。',
    ],
    [
      'an account of another salon',
      { type: 'forbidden' },
      'このアカウントでは、このサロンの売上を出力できません。売上を出力できるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'a failure',
      { type: 'failed' },
      '売上を出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should save nothing for %s, and say why', (_case, outcome, message) => {
    // Act, Assert
    expect(afterReportExport(outcome, PERIOD)).toEqual({
      type: 'refused',
      message,
    })
  })
})
