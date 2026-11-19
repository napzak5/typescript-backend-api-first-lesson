import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { aSale, salon } from '../examples'
import * as saleRecordStories from './sale-record.stories'

const stories = composeStories(saleRecordStories)

/** The terms of a card and what they say, in their order */
const describedIn = (card: string): [string | null, string | null][] => {
  const section = screen.getByRole('heading', { name: card }).closest('section')
  const terms = within(section ?? document.body).getAllByRole('term')

  return terms.map((term) => [
    term.textContent,
    term.nextElementSibling?.textContent ?? null,
  ])
}

describe('SaleRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the sale, its lines and what is left to pay', async () => {
    // Act
    await stories.Unpaid.run()

    // Assert
    expect(describedIn('売上')).toEqual([
      ['売上番号', 'SL-2KQM-9F4H'],
      ['会計日時', '2026年11月20日（金） 11:02'],
      ['会計日', '2026年11月20日（金）'],
      ['お客様', '山田 花子'],
      ['会計の担当', '田中 美咲'],
      ['予約', '予約の内容'],
      ['支払い', '未払い'],
      ['メモ', 'なし'],
    ])
    expect(screen.getByRole('link', { name: '予約の内容' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/bookings/${aSale().bookingId}`,
    )
    const lines = within(screen.getByRole('table', { name: '明細' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        [
          ...within(row).getAllByRole('rowheader'),
          ...within(row).getAllByRole('cell'),
        ].map((cell) => cell.textContent),
      )
    expect(lines).toEqual([
      ['カット', '田中 美咲', '1', '￥5,500', '￥0', '￥0', '￥5,500'],
    ])
    expect(describedIn('金額')).toEqual([
      ['小計', '￥5,500'],
      ['割引', '￥0'],
      ['消費税', '￥0'],
      ['合計', '￥5,500'],
      ['受け取った金額', '￥0'],
      ['未払い残額', '￥5,500'],
    ])
  })

  it('should show a paid sale as paid, with nothing left', async () => {
    // Act
    await stories.Paid.run()

    // Assert
    expect(describedIn('売上')).toContainEqual(['支払い', '支払い済み'])
    expect(describedIn('金額').slice(4)).toEqual([
      ['受け取った金額', '￥5,500'],
      ['未払い残額', '￥0'],
    ])
  })

  it('should say when and why a sale was voided, what was given back, and who is no longer known', async () => {
    // Act
    await stories.Voided.run()

    // Assert
    expect(describedIn('売上')).toEqual([
      ['売上番号', 'SL-2KQM-9F4H'],
      ['会計日時', '2026年11月20日（金） 11:02'],
      ['会計日', '2026年11月20日（金）'],
      ['お客様', '削除された顧客'],
      ['会計の担当', '一覧にないスタッフ'],
      ['予約', '予約の内容'],
      ['支払い', '取り消し'],
      ['取り消した日時', '2026年11月20日（金） 12:00'],
      ['取り消しの理由', '金額の入れ間違い'],
      ['メモ', '次回の来店で使えるクーポンを渡した'],
    ])
    expect(describedIn('金額').slice(4)).toEqual([
      ['受け取った金額', '￥5,500'],
      ['返金した金額', '￥1,000'],
      ['未払い残額', '￥0'],
    ])
  })

  it('should say a sale that bills no booking and names no customer and no member', async () => {
    // Act
    await stories.Unpaid.run({
      args: {
        ...stories.Unpaid.args,
        sale: aSale({ customerId: null, staffId: null, bookingId: null }),
        bookingHref: undefined,
      },
    })

    // Assert
    expect(describedIn('売上').slice(3, 6)).toEqual([
      ['お客様', '記録なし'],
      ['会計の担当', '記録なし'],
      ['予約', 'なし'],
    ])
  })
})
