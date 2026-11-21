import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { colourLot } from '../../../inventory/components/examples'
import * as orderRecordStories from './order-record.stories'

const stories = composeStories(orderRecordStories)

/** The terms of a card and what each says */
const termsOf = (title: string): string[][] => {
  const card = screen.getByRole('heading', { name: title }).closest('section')

  return Array.from(card?.querySelectorAll('dt') ?? []).map((term) => [
    term.textContent ?? '',
    term.nextElementSibling?.textContent ?? '',
  ])
}

/** The cells of the items, by their text */
const items = (): string[][] =>
  within(screen.getByRole('table', { name: '明細' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent ?? ''))

describe('OrderRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the order is, who made it and when, on the clock of the salon, and what was written of it', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(termsOf('発注')).toEqual([
      ['発注番号', 'PO-7K3M-Q9TX'],
      ['ステータス', '承認待ち'],
      ['仕入先', '東京ビューティーサプライ'],
      ['発注日時', '2026年11月20日（金） 10:00（佐藤 健）'],
      ['納品予定日', '2026年11月27日（金）'],
      ['支払条件', '月末締め翌月末払い'],
      ['メモ', '年末の繁忙期の分。\n届いたら、バックヤードの棚 B-2 へ。'],
      ['納品のメモ', '記録なし'],
    ])
  })

  it('should list the items, each leading to its stock row, and what the order comes to', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(items()).toEqual([
      [
        'COLOR001',
        'ヘアカラー ナチュラルブラウン',
        '12 本',
        '￥800',
        '￥9,600',
        '',
      ],
      [
        'SHMP001',
        'プロフェッショナル シャンプー 500ml',
        '2.5 本',
        '￥1,499',
        '￥3,748',
        '店頭の見本の分を含む',
      ],
    ])
    expect(
      screen.getByRole('link', { name: 'ヘアカラー ナチュラルブラウン' }),
    ).toHaveAttribute('href', `/salons/${salon.id}/inventory/${colourLot.id}`)
    expect(termsOf('金額')).toEqual([
      ['小計', '￥13,348'],
      ['税額', '￥1,334'],
      ['送料', 'なし'],
      ['合計', '￥14,682'],
    ])
  })

  it('should name nobody for an administrator, and say when the order was approved and what it costs to ship', async () => {
    // Act
    await stories.OrderedByAnAdministrator.run()

    // Assert
    expect(termsOf('発注').slice(3, 6)).toEqual([
      ['発注日時', '2026年11月18日（水） 14:30'],
      ['納品予定日', '未定'],
      ['承認', '2026年11月18日（水） 15:00'],
    ])
    expect(termsOf('金額')[2]).toEqual(['送料', '￥800'])
  })

  it('should say when and why an order was cancelled, and name an item of a removed row without leading to it', async () => {
    // Act
    await stories.Cancelled.run()

    // Assert
    expect(termsOf('発注').slice(5, 7)).toEqual([
      ['取り消し', '2026年11月3日（火） 09:15'],
      ['取り消した理由', '仕入先の在庫切れ。別の仕入先に頼み直す。'],
    ])
    expect(items()[0]?.[1]).toBe('スタイリングワックス 80g')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('should say only when the order was made while the staff are read', async () => {
    // Act
    await stories.WhileTheStaffAreRead.run()

    // Assert
    expect(termsOf('発注')[3]).toEqual([
      '発注日時',
      '2026年11月20日（金） 10:00',
    ])
  })
})
