import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { JAPANESE, messagesOf } from '../__tests__/found-messages'
import * as catalogues from './index'
import { dashboardReportMessages } from './index'

const FOUND = messagesOf(catalogues, '')

const { categories, daily, names, refusal, report, staff, trends } =
  dashboardReportMessages

/** A period and a day, as the formats write them */
const PERIOD = {
  en: 'Sun, November 1, 2026 – Mon, November 23, 2026',
  ja: '2026年11月1日（日）〜2026年11月23日（月）',
}
const DAY = { en: 'Mon, November 16, 2026', ja: '2026年11月16日（月）' }
const AMOUNT = { en: '¥25,000', ja: '￥25,000' }

/** The name of a file, which stands in every language as it is */
const FILE = 'sales-report-2026-11-01-2026-11-23.csv'

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'dashboardReportMessages.count',
    dashboardReportMessages.count(1234),
    { en: '1,234', ja: '1,234 件' },
  ],
  [
    'dashboardReportMessages.report.of',
    report.of(PERIOD),
    {
      en: 'Sales for Sun, November 1, 2026 – Mon, November 23, 2026',
      ja: '2026年11月1日（日）〜2026年11月23日（月）の売上',
    },
  ],
  [
    'dashboardReportMessages.report.exported',
    report.exported(PERIOD, FILE),
    {
      en: `The sales for Sun, November 1, 2026 – Mon, November 23, 2026 were exported to ${FILE}.`,
      ja: `2026年11月1日（日）〜2026年11月23日（月）の売上を、${FILE} に出力しました。`,
    },
  ],
  [
    'dashboardReportMessages.staff.of',
    staff.of(PERIOD),
    {
      en: 'Sales by staff for Sun, November 1, 2026 – Mon, November 23, 2026',
      ja: '2026年11月1日（日）〜2026年11月23日（月）のスタッフ別の売上',
    },
  ],
  [
    'dashboardReportMessages.categories.of',
    categories.of(PERIOD),
    {
      en: 'Sales by menu category for Sun, November 1, 2026 – Mon, November 23, 2026',
      ja: '2026年11月1日（日）〜2026年11月23日（月）のメニューの区分別の売上',
    },
  ],
  [
    'dashboardReportMessages.trends.of',
    trends.of(PERIOD),
    {
      en: 'Sales trends for Sun, November 1, 2026 – Mon, November 23, 2026',
      ja: '2026年11月1日（日）〜2026年11月23日（月）の売上の推移',
    },
  ],
  [
    'dashboardReportMessages.trends.weekFrom',
    trends.weekFrom(DAY),
    {
      en: 'Week from Mon, November 16, 2026',
      ja: '2026年11月16日（月）からの週',
    },
  ],
  [
    'dashboardReportMessages.trends.tip',
    trends.tip(DAY, AMOUNT),
    {
      en: 'Mon, November 16, 2026: ¥25,000',
      ja: '2026年11月16日（月） ￥25,000',
    },
  ],
  [
    'dashboardReportMessages.daily.of',
    daily.of(DAY),
    {
      en: 'Sales on Mon, November 16, 2026',
      ja: '2026年11月16日（月）の売上',
    },
  ],
  [
    'dashboardReportMessages.refusal.removed',
    refusal.removed(names.seen.report),
    {
      en: 'This salon was removed, so you cannot see its sales report.',
      ja: 'このサロンは削除されたため、売上レポートを見られません。',
    },
  ],
]

/** A name that stands inside a sentence of another catalogue: it begins as it stands there */
const INSIDE_A_SENTENCE = /\.names\./

describe('the messages of the dashboard', () => {
  it.each(FOUND.texts.filter(([where]) => !INSIDE_A_SENTENCE.test(where)))(
    'should be written in each language: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^[A-Z]/)
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(FOUND.texts.filter(([where]) => INSIDE_A_SENTENCE.test(where)))(
    'should be written in each language as it stands inside a sentence: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^[a-z]/)
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      FOUND.made.toSorted(),
    )
  })

  it('should say one sentence after another with a space in English and none in Japanese', () => {
    // Assert
    expect(daily.note).toEqual({
      en: 'Sales include tax, less discounts. Refunds are the amounts returned from the checkouts of this day; they are not counted on the day of the refund. Net sales are the sales less refunds.',
      ja: '売上は、消費税を含み、値引きを引いた額です。返金は、この日の会計から返した額で、返金した日には数えません。純売上は、売上から返金を引いた額です。',
    })
  })
})
