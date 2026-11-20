import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { aService } from '../examples'
import * as serviceRecordStories from './service-record.stories'

const stories = composeStories(serviceRecordStories)

/** What a card says, term by term. */
const termsOf = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('ServiceRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show everything the menu keeps of a service', async () => {
    // Act
    await stories.WithOptions.run()

    // Assert
    expect(termsOf('サービス')).toEqual([
      ['名前', 'カット'],
      ['カテゴリー', 'カット'],
      ['状態', '有効'],
      ['所要時間', '60 分'],
      ['料金', '￥5,500・税込'],
      ['価格の決め方', '固定価格'],
      ['提供日', '常時提供'],
      ['表示順', '1'],
      ['短い紹介', '似合わせのカット'],
      [
        '説明',
        'シャンプー、カット、ブローまで。\n仕上げのスタイリング剤はお選びいただけます。',
      ],
      ['タグ', '人気'],
      ['写真の URL', 'https://photos.example.com/menu/cut.jpg'],
      [
        'ほかの写真の URL',
        'https://photos.example.com/menu/cut-2.jpghttps://photos.example.com/menu/cut-3.jpg',
      ],
    ])
    expect(termsOf('予約')).toEqual([
      ['オンライン予約', '受ける'],
      ['予約の条件', 'なし'],
      ['カウンセリング', '不要'],
      ['担当できるスタッフ', 'だれでも'],
      ['1 日の予約の上限', '上限なし'],
    ])
    expect(
      screen.queryByRole('region', { name: 'パッケージのサービス' }),
    ).not.toBeInTheDocument()
  })

  it('should list the options with what they add', async () => {
    // Act
    await stories.WithOptions.run()

    // Assert
    const table = screen.getByRole('table', { name: 'オプション' })
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          [
            ...within(row).getAllByRole('rowheader'),
            ...within(row).getAllByRole('cell'),
          ].map((cell) => cell.textContent),
        ),
    ).toEqual([
      ['前髪カット', 'アドオン', '10 分', '￥1,100', '1 まで', '任意', '有効'],
    ])
  })

  it('should say the conditions of a booking, and the level a stylist needs', async () => {
    // Act
    await stories.WithConditions.run()

    // Assert
    expect(termsOf('予約')).toEqual([
      ['オンライン予約', '受けない'],
      ['予約の条件', 'パッチテスト必須デポジット必須'],
      ['カウンセリング', '必要'],
      ['担当できるスタッフ', 'シニア以上'],
      ['1 日の予約の上限', '4 件'],
    ])
    expect(
      within(screen.getByRole('table', { name: 'オプション' })).getByText(
        'オプションはありません',
      ),
    ).toBeInTheDocument()
  })

  it('should lead to the services of a package, and say which is not on the menu any more', async () => {
    // Act
    await stories.Package.run()

    // Assert
    const items = within(
      screen.getByRole('region', { name: 'パッケージのサービス' }),
    ).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'カット',
      'メニューにないサービス',
    ])
    expect(within(items[0] ?? document.body).getByRole('link')).toHaveAttribute(
      'href',
      `/salons/${salon.id}/menu/services/${aService().id}`,
    )
    expect(termsOf('サービス').slice(0, 3)).toEqual([
      ['名前', 'カットとカラー'],
      ['カテゴリー', '未分類'],
      ['状態', '無効・近日公開'],
    ])
  })
})
