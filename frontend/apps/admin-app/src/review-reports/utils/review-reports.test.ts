import type { ModelsReviewReportReasonType } from '@beauty-salon-frontend/api-client'
import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import type { ReviewRemoval } from '../../reviews/api/reviews-api'
import type { Dismissal } from '../api/review-reports-api'
import { dismissedReport, waitingReport } from '../components/examples'
import {
  afterDismissal,
  afterReviewRemoval,
  handlesReports,
  type ReportsShown,
  readReportsShown,
  reasonNameOf,
  reportListParamsOf,
  reportMomentOf,
  reportStateOf,
  reportsQueryOf,
  reportsShownIn,
} from './review-reports'

const TOKYO = 'Asia/Tokyo'

describe('handlesReports', () => {
  it.each<[string, boolean]>([
    ['admin', true],
    ['owner', false],
    ['manager', false],
    ['staff', false],
    ['customer', false],
  ])('should let %s handle the reports: %s', (role, handles) => {
    expect(handlesReports(role)).toBe(handles)
  })
})

describe('reportsShownIn and readReportsShown', () => {
  it.each<[string, ReportsShown]>([
    ['', 'pending'],
    ['status=pending', 'pending'],
    ['status=dismissed', 'dismissed'],
    ['status=all', 'all'],
    ['status=resolved', 'pending'],
    ['status=ALL', 'pending'],
  ])('should show for the query «%s» the reports %s', (query, shown) => {
    expect(reportsShownIn(new URLSearchParams(query))).toBe(shown)
  })

  it.each<[[string, string][], ReportsShown]>([
    [[['status', 'dismissed']], 'dismissed'],
    [[['status', 'all']], 'all'],
    [[['status', '']], 'pending'],
    [[], 'pending'],
  ])('should read from the form %j the reports %s', (entries, shown) => {
    expect(readReportsShown(formOfEntries(entries))).toBe(shown)
  })
})

describe('reportsQueryOf and reportListParamsOf', () => {
  it.each<[ReportsShown, string, object]>([
    ['pending', '', { status: 'pending' }],
    ['dismissed', 'status=dismissed', { status: 'dismissed' }],
    ['all', 'status=all', {}],
  ])(
    'should put the reports %s in the address as «%s» and ask the API for %j',
    (shown, query, params) => {
      expect(reportsQueryOf(shown).toString()).toBe(query)
      expect(reportListParamsOf(shown)).toEqual(params)
    },
  )
})

describe('reasonNameOf', () => {
  it.each<[ModelsReviewReportReasonType, string]>([
    ['inappropriate', '不適切な表現（暴言、差別的な表現など）'],
    ['false_information', '事実と違う内容'],
    ['personal_information', '個人情報（氏名や連絡先など）'],
    ['spam', '宣伝や、来店と関係のない内容'],
    ['other', 'その他'],
  ])(
    'should name the reason %s as the form of a report does',
    (reason, name) => {
      expect(reasonNameOf(reason)).toBe(name)
    },
  )
})

describe('reportMomentOf', () => {
  it('should say a moment on the clock of the salon, with its day of the week', () => {
    expect(reportMomentOf('2026-11-20T15:05:00.000Z', TOKYO)).toBe(
      '2026年11月21日（土） 00:05',
    )
    expect(reportMomentOf('2026-11-20T15:05:00.000Z', 'America/New_York')).toBe(
      '2026年11月20日（金） 10:05',
    )
  })
})

describe('reportStateOf', () => {
  it('should say that a report waits', () => {
    expect(reportStateOf(waitingReport, TOKYO)).toEqual({
      waits: true,
      label: '未処理',
      note: undefined,
    })
  })

  it('should say when a report was dismissed, on the clock of the salon', () => {
    expect(reportStateOf(dismissedReport, TOKYO)).toEqual({
      waits: false,
      label: '却下',
      note: '2026年11月21日（土） 09:15に却下',
    })
  })

  it('should say no moment for a dismissed report that has none', () => {
    expect(
      reportStateOf({ ...dismissedReport, resolvedAt: null }, TOKYO),
    ).toEqual({ waits: false, label: '却下', note: undefined })
  })
})

describe('afterDismissal', () => {
  it('should say that the report was dismissed', () => {
    expect(
      afterDismissal({ type: 'dismissed', report: dismissedReport }),
    ).toEqual({ type: 'done', message: '通報を却下しました。' })
  })

  it.each<[Dismissal, string]>([
    [
      { type: 'dismissedAlready' },
      'この通報は、その間に、ほかの管理者が却下しました。却下は、1 つの通報に 1 回です。',
    ],
    [
      { type: 'forbidden' },
      'このアカウントでは、通報を扱えません。通報を確かめて、却下するか、レビューを削除するのは、管理者です。',
    ],
  ])(
    'should say why another attempt after %j changes nothing',
    (outcome, message) => {
      expect(afterDismissal(outcome)).toEqual({ type: 'refused', message })
    },
  )

  it('should leave a report that went with its review to the screen, which reads the review anew', () => {
    expect(afterDismissal({ type: 'notFound' })).toEqual({ type: 'gone' })
  })

  it.each<[Dismissal, string]>([
    [
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      '通報を却下できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])(
    'should ask for another attempt after %j, in the dialog',
    (outcome, message) => {
      expect(afterDismissal(outcome)).toEqual({ type: 'again', message })
    },
  )
})

describe('afterReviewRemoval', () => {
  it('should say that the review was removed, and its reports with it', () => {
    expect(afterReviewRemoval({ type: 'removed' })).toEqual({
      type: 'done',
      message: 'レビューを削除しました。通報も、一緒に削除しました。',
    })
  })

  it('should say who removes a review to an account that does not', () => {
    expect(afterReviewRemoval({ type: 'forbidden' })).toEqual({
      type: 'refused',
      message:
        'このアカウントでは、このレビューを削除できません。レビューを削除できるのは、書いたお客様と、管理者です。',
    })
  })

  it('should leave a review removed meanwhile to the screen, which says it is gone', () => {
    expect(afterReviewRemoval({ type: 'notFound' })).toEqual({ type: 'gone' })
  })

  it.each<[ReviewRemoval, string]>([
    [
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'レビューを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])(
    'should ask for another attempt after %j, in the dialog',
    (outcome, message) => {
      expect(afterReviewRemoval(outcome)).toEqual({ type: 'again', message })
    },
  )
})
