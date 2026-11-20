import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as stockRecordStories from './stock-record.stories'

const stories = composeStories(stockRecordStories)

/** What a card says, term by term */
const terms = (card: string): [string | null, string | null][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('StockRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the row is, where it is kept and how much of it there is', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(terms('在庫の行')).toEqual([
      ['商品', 'ヘアカラー ナチュラルブラウン（COLOR001）'],
      ['ロット番号', 'LOT-2026-041'],
      ['使用期限', '2027年3月31日'],
      ['保管場所', 'バックヤード'],
      ['棚', 'B-2'],
      ['メモ', '記録なし'],
    ])
    expect(terms('在庫')).toEqual([
      ['在庫数', '12 本'],
      ['引き当てた数', '0 本'],
      ['使える数', '12 本'],
      ['最後の棚卸し', '2026年11月1日（日） 10:00（佐藤 健）'],
    ])
  })

  it('should mark an expiry that is past, and say that a row was never counted', async () => {
    // Act
    await stories.Expired.run()

    // Assert
    expect(terms('在庫の行')[2]).toEqual([
      '使用期限',
      '2025年12月31日 期限切れ',
    ])
    expect(terms('在庫')[3]).toEqual(['最後の棚卸し', '棚卸ししていません'])
  })

  it.each<[keyof typeof stories]>([
    ['CountedByAnAdministrator'],
    ['WhileTheStaffAreRead'],
  ])('should name nobody who counted the row in %s', async (story) => {
    // Act
    await stories[story].run()

    // Assert
    expect(terms('在庫')[3]).toEqual([
      '最後の棚卸し',
      '2026年11月1日（日） 10:00',
    ])
  })

  it('should keep the lines of the notes, and say what is reserved', async () => {
    // Act
    await stories.WithNotes.run()

    // Assert
    expect(terms('在庫の行')).toEqual([
      ['商品', 'プロフェッショナル シャンプー 500ml（SHMP001）'],
      ['ロット番号', 'なし'],
      ['使用期限', '期限なし'],
      ['保管場所', '店頭の棚'],
      ['棚', '記録なし'],
      ['メモ', '箱を開けたものから使う。\n店頭の見本は数えない。'],
    ])
    expect(terms('在庫').slice(0, 3)).toEqual([
      ['在庫数', '8 本'],
      ['引き当てた数', '2 本'],
      ['使える数', '6 本'],
    ])
  })

  it('should name a product that was removed, and leave the units out', async () => {
    // Act
    await stories.OfARemovedProduct.run()

    // Assert
    expect(terms('在庫の行')[0]).toEqual(['商品', '削除した商品'])
    expect(terms('在庫')[0]).toEqual(['在庫数', '12'])
  })
})
