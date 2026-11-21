import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import {
  aBooking,
  aCustomer,
  salon,
} from '../../../bookings/components/examples'
import * as treatmentRecordStories from './treatment-record.stories'

const stories = composeStories(treatmentRecordStories)

/** What a card says, term by term */
const termsOf = (card: string): [string, string][] => {
  const region = screen.getByRole('region', { name: card })

  return within(region)
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])
}

/** The rows of the materials, cell by cell */
const materials = (): (string | null)[][] =>
  within(screen.getByRole('table', { name: '使った商材の一覧' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent),
    )

describe('TreatmentRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show what was done, by whom and for whom', async () => {
    // Act
    await stories.Written.run()

    // Assert
    expect(termsOf('施術')).toEqual([
      ['お客様', '山田 花子 様'],
      ['予約', 'BK-4F7H-2KQM（2026年11月20日（金））'],
      ['担当', '田中 美咲'],
      ['提供したサービス', 'カットカラー'],
      ['技法', 'ローライトレイヤーカット'],
      ['施術時間', '75 分'],
      ['書いた日時', '2026年11月20日（金） 12:30'],
    ])
    expect(screen.getByRole('link', { name: '山田 花子 様' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/customers/${aCustomer().id}`,
    )
    expect(
      screen.getByRole('link', {
        name: 'BK-4F7H-2KQM（2026年11月20日（金））',
      }),
    ).toHaveAttribute('href', `/salons/${salon.id}/bookings/${aBooking().id}`)
  })

  it('should show the counselling, the states, the formula and what came of the treatment', async () => {
    // Act
    await stories.Written.run()

    // Assert
    expect(termsOf('カウンセリングと状態')).toEqual([
      [
        'カウンセリングのメモ',
        '前回のカラーの色落ちが気になる。\n明るさは変えたくない。',
      ],
      ['頭皮の状態', 'やや乾燥'],
      ['毛髪の状態', '毛先にダメージ'],
      ['カラー剤の配合', '6N：オキシ 6% ＝ 1：1'],
    ])
    expect(termsOf('結果と次回')).toEqual([
      ['結果のメモ', '記録なし'],
      ['お客様の満足度', '5（とても満足）'],
      ['次に勧める日', '2026年12月18日（金）'],
      ['次に勧めるサービス', 'カラー'],
      ['ホームケアの提案', 'カラー用のシャンプーを勧めた。'],
      ['申し送り', '根元の塗り分けに時間がかかった。'],
    ])
  })

  it('should list the materials in their order, with their lots', async () => {
    // Act
    await stories.Written.run()

    // Assert
    expect(materials()).toEqual([
      ['カラー剤 6N（COLOR-6N）', '1 本', 'LOT-2026-031', '記録なし'],
      ['オキシ 6%（OX-6）', '80.5 ml', '記録なし', '根元に多めに使った。'],
    ])
  })

  it('should say what was not recorded, what the salon removed, and when the record was last changed', async () => {
    // Act
    await stories.Sparse.run()

    // Assert
    expect(termsOf('施術')).toEqual([
      ['お客様', '台帳から削除されたお客様'],
      ['予約', 'BK-4F7H-2KQM（2026年11月20日（金））'],
      ['担当', '田中 美咲'],
      ['提供したサービス', '削除されたメニュー'],
      ['技法', 'なし'],
      ['施術時間', '記録なし'],
      ['書いた日時', '2026年11月20日（金） 12:30'],
      ['最後に直した日時', '2026年11月21日（土） 10:00'],
    ])
    expect(termsOf('結果と次回').map(([, said]) => said)).toEqual([
      '記録なし',
      '未回答',
      '記録なし',
      'なし',
      '記録なし',
      '記録なし',
    ])
    expect(materials()).toEqual([
      ['削除された商品', '2 本', '記録なし', '記録なし'],
    ])
  })

  it('should say that no material was used', async () => {
    // Act
    await stories.WithoutMaterials.run()

    // Assert
    expect(screen.getByText('使った商材はありません')).toBeInTheDocument()
  })
})
