import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
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
      ['メモ', '記録なし'],
    ])
    expect(screen.getByRole('link', { name: '予約の内容' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/bookings/${aSale().bookingId}`,
    )
    expect(screen.getByRole('link', { name: '売上を直す' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/sales/${aSale().id}/edit`,
    )
    const lines = rowsOf('明細')
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
    expect(screen.queryByRole('link', { name: '売上を直す' })).toBeNull()
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

describe('SaleRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should show the sale, its lines and what is left to pay in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unpaid.run()

    // Assert
    expect(describedIn('Sale')).toEqual([
      ['Sale number', 'SL-2KQM-9F4H'],
      ['Time of sale', 'Fri, November 20, 2026 at 11:02'],
      ['Date of sale', 'Fri, November 20, 2026'],
      ['Customer', '山田 花子'],
      ['Cashier', '田中 美咲'],
      ['Booking', 'Booking details'],
      ['Payment', 'Unpaid'],
      ['Notes', 'Not recorded'],
    ])
    expect(screen.getByRole('link', { name: 'Edit the sale' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/sales/${aSale().id}/edit`,
    )
    expect(columnsOf('Line items')).toEqual([
      'Item',
      'Staff',
      'Quantity',
      'Unit price',
      'Discount',
      'Tax',
      'Amount',
    ])
    expect(rowsOf('Line items')).toEqual([
      ['カット', '田中 美咲', '1', '¥5,500', '¥0', '¥0', '¥5,500'],
    ])
    expect(describedIn('Amounts')).toEqual([
      ['Subtotal', '¥5,500'],
      ['Discount', '¥0'],
      ['Tax', '¥0'],
      ['Total', '¥5,500'],
      ['Received', '¥0'],
      ['Left to pay', '¥5,500'],
    ])
  })

  it('should say when and why a sale was voided, what was given back, and who is no longer known, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Voided.run()

    // Assert
    expect(describedIn('Sale').slice(3)).toEqual([
      ['Customer', 'Removed customer'],
      ['Cashier', 'Staff member not listed'],
      ['Booking', 'Booking details'],
      ['Payment', 'Voided'],
      ['Time voided', 'Fri, November 20, 2026 at 12:00'],
      ['Reason for voiding', '金額の入れ間違い'],
      ['Notes', '次回の来店で使えるクーポンを渡した'],
    ])
    expect(describedIn('Amounts').slice(4)).toEqual([
      ['Received', '¥5,500'],
      ['Refunded', '¥1,000'],
      ['Left to pay', '¥0'],
    ])
  })

  it('should say a sale that bills no booking and names no customer and no member in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unpaid.run({
      args: {
        ...stories.Unpaid.args,
        sale: aSale({ customerId: null, staffId: null, bookingId: null }),
        bookingHref: undefined,
      },
    })

    // Assert
    expect(describedIn('Sale').slice(3, 6)).toEqual([
      ['Customer', 'Not recorded'],
      ['Cashier', 'Not recorded'],
      ['Booking', 'None'],
    ])
  })
})
