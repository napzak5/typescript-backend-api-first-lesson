import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { termsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as salesReportStories from './sales-report.stories'

const stories = composeStories(salesReportStories)

/** The rows of a table, cell by cell in the order they are shown */
const rowsOf = (table: string): (string | null)[][] =>
  within(screen.getByRole('table', { name: table }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent),
    )

/** The headers of the rows of a table: what each row is of */
const rowHeadersOf = (table: string): (string | null)[] =>
  within(screen.getByRole('table', { name: table }))
    .getAllByRole('rowheader')
    .map((header) => header.textContent)

describe('SalesReport', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say the sums of the period in the currency of the salon, and how they are counted', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(termsOf('期間の合計')).toEqual([
      ['売上', '￥41,800'],
      ['返金', '￥3,000'],
      ['純売上', '￥38,800'],
      ['会計の件数', '4 件'],
      ['客単価', '￥10,450'],
      ['消費税', '￥3,800'],
      ['値引き', '￥1,000'],
    ])
    expect(
      screen.getByRole('region', { name: '期間の合計' }),
    ).toHaveTextContent(
      /返金は、返金した日ではなく、もとの会計の日で数えます。/,
    )
  })

  it('should say what each kind of payment received, and that it may not add up to the sales', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(rowsOf('支払い方法別の入金')).toEqual([
      ['クレジットカード', '￥16,000', '2 件', '66.7%'],
      ['現金', '￥8,000', '1 件', '33.3%'],
    ])
    expect(rowHeadersOf('支払い方法別の入金')).toEqual([
      'クレジットカード',
      '現金',
    ])
    expect(
      screen.getByRole('region', { name: '支払い方法別' }),
    ).toHaveTextContent(/合わせても売上と同じにならないことがあります。/)
  })

  it('should say what each kind of service sold, with a share of a whole number to one decimal', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(rowsOf('メニューの区分別の売上')).toEqual([
      ['カラー', '￥17,600', '2 件', '50.0%'],
      ['カット', '￥12,100', '2 件', '34.4%'],
      ['トリートメント', '￥5,500', '1 件', '15.6%'],
    ])
    expect(
      screen.getByRole('region', { name: 'メニューの区分別' }),
    ).toHaveTextContent(/商品の売上は入りません。/)
  })

  it('should rank the members of the staff who sold the most, named as they are named now', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(rowsOf('スタッフ別の売上の上位 5 人')).toEqual([
      ['1 位', 'Mika Suzuki', '￥23,100', '3 件', '￥7,700'],
      ['2 位', 'Hiroshi Tanaka', '￥12,100', '2 件', '￥6,050'],
    ])
    expect(rowHeadersOf('スタッフ別の売上の上位 5 人')).toEqual([
      'Mika Suzuki',
      'Hiroshi Tanaka',
    ])
  })

  it('should lead from the kinds of service and from the five who sold the most to the whole of each, over the same days', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(
      within(
        screen.getByRole('region', { name: 'メニューの区分別' }),
      ).getByRole('link', { name: '区分別の売上へ' }),
    ).toHaveAttribute(
      'href',
      '/salons/3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60/reports/categories?from=2026-11-01&to=2026-11-21',
    )
    expect(
      within(
        screen.getByRole('region', { name: 'スタッフ別の上位 5 人' }),
      ).getByRole('link', { name: 'すべてのスタッフの売上へ' }),
    ).toHaveAttribute(
      'href',
      '/salons/3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60/reports/staff?from=2026-11-01&to=2026-11-21',
    )
  })

  it('should say that nothing was received, no service sold and nobody of the staff sold anything', async () => {
    // Act
    await stories.WithoutBreakdown.run()

    // Assert
    expect(
      within(screen.getByRole('region', { name: '支払い方法別' })).getByText(
        '受け取った支払いはありません',
      ),
    ).toBeVisible()
    expect(
      within(
        screen.getByRole('region', { name: 'メニューの区分別' }),
      ).getByText('メニューの売上はありません'),
    ).toBeVisible()
    expect(
      within(
        screen.getByRole('region', { name: 'スタッフ別の上位 5 人' }),
      ).getByText('担当したスタッフのいる売上はありません'),
    ).toBeVisible()
  })
})
