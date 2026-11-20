import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as recordStories from './product-record.stories'

const stories = composeStories(recordStories)

/** What a card of the record says, term by term. */
const terms = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('ProductRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say everything the ledger keeps of a product, card by card', async () => {
    // Act
    await stories.Noted.run()

    // Assert
    expect(terms('商品')).toEqual([
      ['商品コード', 'SHMP001'],
      ['商品名', 'プロフェッショナル シャンプー 500ml'],
      ['説明', 'サロン専売のシャンプー。\n乾燥した髪に。'],
      ['カテゴリー', 'ヘアケア'],
      ['ブランド', 'Salon Pro'],
      ['単位', '本'],
      ['用途', '店頭販売、施術'],
      ['状態', '取り扱い中'],
    ])
    expect(terms('価格')).toEqual([
      ['仕入価格', '￥1,500'],
      ['定価', '￥3,500'],
      ['販売価格', '￥3,000'],
    ])
    expect(terms('在庫の水準')).toEqual([
      ['最低在庫数', '5 本'],
      ['発注点', '10 本'],
      ['最大在庫数', '50 本'],
    ])
    expect(terms('仕入れ')).toEqual([
      ['仕入先', '東京ビューティーサプライ'],
      ['仕入先の商品コード', 'TBS-SH-500'],
      ['納品までの日数', '3 日'],
    ])
    expect(terms('管理')).toEqual([
      ['バーコード', '4901234567894'],
      ['ロット番号', '分けない'],
      ['使用期限の目安', '36 か月'],
      ['保管条件', '直射日光を避けて保管'],
      ['商品画像の URL', 'https://images.example.com/products/shmp001.jpg'],
      ['安全データシートの URL', 'https://docs.example.com/sds/shmp001.pdf'],
    ])
  })

  it('should say what is not noted, and the levels that were not decided', async () => {
    // Act
    await stories.LittleNoted.run()

    // Assert
    expect(terms('商品')).toEqual(
      expect.arrayContaining([
        ['説明', '記録なし'],
        ['カテゴリー', '記録なし'],
        ['ブランド', '記録なし'],
        ['用途', 'どちらでもない'],
      ]),
    )
    expect(terms('価格')).toEqual([
      ['仕入価格', '記録なし'],
      ['定価', '記録なし'],
      ['販売価格', '記録なし'],
    ])
    expect(terms('在庫の水準')).toEqual([
      ['最低在庫数', '0 箱'],
      ['発注点', '決めていない'],
      ['最大在庫数', '決めていない'],
    ])
    expect(terms('仕入れ')).toEqual([
      ['仕入先', '記録なし'],
      ['仕入先の商品コード', '記録なし'],
      ['納品までの日数', '記録なし'],
    ])
    expect(terms('管理')).toEqual([
      ['バーコード', '記録なし'],
      ['ロット番号', '分けない'],
      ['使用期限の目安', '記録なし'],
      ['保管条件', '記録なし'],
      ['商品画像の URL', '記録なし'],
      ['安全データシートの URL', '記録なし'],
    ])
  })
})
