import type { ModelsReviewReportReasonType } from '@beauty-salon-frontend/api-client'
import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { ReviewRemoval } from '../../reviews/api/reviews-api'
import type { Dismissal } from '../api/review-reports-api'
import { dismissedReport, waitingReport } from '../components/examples'
import {
  afterDismissal,
  afterReviewRemoval,
  handlesReports,
  REPORTS_SHOWN,
  type ReportsShown,
  readReportsShown,
  reasonNameOf,
  reportListParamsOf,
  reportStateOf,
  reportsQueryOf,
  reportsShownIn,
} from './review-reports'

const TOKYO = 'Asia/Tokyo'

/** What the API says of too many requests */
const TOO_MANY_REQUESTS: LocalizedText = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}
const PENDING: LocalizedText = { en: 'Pending', ja: '未処理' }
const DISMISSED: LocalizedText = { en: 'Dismissed', ja: '却下' }

describe('handlesReports', () => {
  it.each<[string, boolean]>([
    ['admin', true],
    ['owner', false],
    ['manager', false],
    ['staff', false],
    ['customer', false],
  ])('should let %s handle the reports: %s', (role, handles) => {
    // Assert
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
    // Assert
    expect(reportsShownIn(new URLSearchParams(query))).toBe(shown)
  })

  it.each<[[string, string][], ReportsShown]>([
    [[['status', 'dismissed']], 'dismissed'],
    [[['status', 'all']], 'all'],
    [[['status', '']], 'pending'],
    [[], 'pending'],
  ])('should read from the form %j the reports %s', (entries, shown) => {
    // Assert
    expect(readReportsShown(formOfEntries(entries))).toBe(shown)
  })

  it('should offer the reports that wait first, then those dismissed, then all', () => {
    // Assert
    expect(REPORTS_SHOWN).toEqual([
      { value: 'pending', label: PENDING },
      { value: 'dismissed', label: DISMISSED },
      { value: 'all', label: { en: 'All', ja: 'すべて' } },
    ])
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
      // Assert
      expect(reportsQueryOf(shown).toString()).toBe(query)
      expect(reportListParamsOf(shown)).toEqual(params)
    },
  )
})

describe('reasonNameOf', () => {
  it.each<[ModelsReviewReportReasonType, LocalizedText]>([
    [
      'inappropriate',
      {
        en: 'Inappropriate language (abuse, discrimination and the like)',
        ja: '不適切な表現（暴言、差別的な表現など）',
      },
    ],
    [
      'false_information',
      { en: 'Something that is not true', ja: '事実と違う内容' },
    ],
    [
      'personal_information',
      {
        en: 'Personal information (names, contact details and the like)',
        ja: '個人情報（氏名や連絡先など）',
      },
    ],
    [
      'spam',
      {
        en: 'Advertising, or something that has nothing to do with a visit',
        ja: '宣伝や、来店と関係のない内容',
      },
    ],
    ['other', { en: 'Other', ja: 'その他' }],
  ])(
    'should name the reason %s as the form of a report does',
    (reason, name) => {
      // Assert
      expect(reasonNameOf(reason)).toEqual(name)
    },
  )
})

describe('reportStateOf', () => {
  it('should say that a report waits', () => {
    // Act
    const state = reportStateOf(waitingReport, TOKYO)

    // Assert
    expect(state).toEqual({ waits: true, label: PENDING, note: undefined })
  })

  it('should say when a report was dismissed, on the clock of the salon', () => {
    // Act
    const state = reportStateOf(dismissedReport, TOKYO)

    // Assert
    expect(state).toEqual({
      waits: false,
      label: DISMISSED,
      note: {
        en: 'Dismissed on Sat, November 21, 2026 at 09:15',
        ja: '2026年11月21日（土） 09:15に却下',
      },
    })
  })

  it('should say the moment of the dismissal on the clock of the salon, wherever the salon is', () => {
    // Act
    const state = reportStateOf(dismissedReport, 'America/New_York')

    // Assert
    expect(state.note).toEqual({
      en: 'Dismissed on Fri, November 20, 2026 at 19:15',
      ja: '2026年11月20日（金） 19:15に却下',
    })
  })

  it('should say no moment for a dismissed report that has none', () => {
    // Act
    const state = reportStateOf({ ...dismissedReport, resolvedAt: null }, TOKYO)

    // Assert
    expect(state).toEqual({ waits: false, label: DISMISSED, note: undefined })
  })
})

describe('afterDismissal', () => {
  it('should say that the report was dismissed', () => {
    // Act
    const said = afterDismissal({ type: 'dismissed', report: dismissedReport })

    // Assert
    expect(said).toEqual({
      type: 'done',
      message: { en: 'Dismissed the report.', ja: '通報を却下しました。' },
    })
  })

  it.each<[Dismissal, LocalizedText]>([
    [
      { type: 'dismissedAlready' },
      {
        en: 'Meanwhile, another administrator dismissed this report. A report is dismissed once.',
        ja: 'この通報は、その間に、ほかの管理者が却下しました。却下は、1 つの通報に 1 回です。',
      },
    ],
    [
      { type: 'forbidden' },
      {
        en: 'This account cannot handle reports. Administrators check the reports, and dismiss them or delete the review.',
        ja: 'このアカウントでは、通報を扱えません。通報を確かめて、却下するか、レビューを削除するのは、管理者です。',
      },
    ],
  ])(
    'should say why another attempt after %j changes nothing',
    (outcome, message) => {
      // Assert
      expect(afterDismissal(outcome)).toEqual({ type: 'refused', message })
    },
  )

  it('should leave a report that went with its review to the screen, which reads the review anew', () => {
    // Assert
    expect(afterDismissal({ type: 'notFound' })).toEqual({ type: 'gone' })
  })

  it.each<[Dismissal, LocalizedText]>([
    [{ type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [
      { type: 'failed' },
      {
        en: 'Could not dismiss the report. Check your connection and try again.',
        ja: '通報を却下できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])(
    'should ask for another attempt after %j, in the dialog',
    (outcome, message) => {
      // Assert
      expect(afterDismissal(outcome)).toEqual({ type: 'again', message })
    },
  )
})

describe('afterReviewRemoval', () => {
  it('should say that the review was removed, and its reports with it', () => {
    // Act
    const said = afterReviewRemoval({ type: 'removed' })

    // Assert
    expect(said).toEqual({
      type: 'done',
      message: {
        en: 'Deleted the review, and its reports with it.',
        ja: 'レビューを削除しました。通報も、一緒に削除しました。',
      },
    })
  })

  it('should say who removes a review to an account that does not', () => {
    // Act
    const said = afterReviewRemoval({ type: 'forbidden' })

    // Assert
    expect(said).toEqual({
      type: 'refused',
      message: {
        en: 'This account cannot delete this review. Only the customer who wrote it and administrators can delete a review.',
        ja: 'このアカウントでは、このレビューを削除できません。レビューを削除できるのは、書いたお客様と、管理者です。',
      },
    })
  })

  it('should leave a review removed meanwhile to the screen, which says it is gone', () => {
    // Assert
    expect(afterReviewRemoval({ type: 'notFound' })).toEqual({ type: 'gone' })
  })

  it.each<[ReviewRemoval, LocalizedText]>([
    [{ type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [
      { type: 'failed' },
      {
        en: 'Could not delete the review. Check your connection and try again.',
        ja: 'レビューを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])(
    'should ask for another attempt after %j, in the dialog',
    (outcome, message) => {
      // Assert
      expect(afterReviewRemoval(outcome)).toEqual({ type: 'again', message })
    },
  )
})
