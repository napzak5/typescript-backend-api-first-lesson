import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as chartRecordStories from './chart-record.stories'

const stories = composeStories(chartRecordStories)

const part = (name: string): HTMLElement => screen.getByRole('region', { name })

/** The terms of a description list, each with what it says */
const termsOf = (element: HTMLElement): [string | null, string | null][] =>
  within(element)
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('ChartRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show what to take care of, the products, the notes and when the chart was written, at the salon', async () => {
    // Act
    await stories.Written.run()

    // Assert
    expect(termsOf(part('カルテ'))).toEqual([
      ['持病や体調', '頭皮が乾燥しやすく、かゆみが出ることがあります。'],
      ['好みの商材', 'オーガニックシャンプー無香料のオイル'],
      ['避ける商材', '香りの強い整髪料'],
      ['メモ', 'シャンプーはぬるめのお湯で。\n施術中の会話は控えめを希望。'],
      ['最後に書いた日時', '2026年11月18日（水） 14:30'],
    ])
    expect(
      within(part('カルテ'))
        .getByRole('list', { name: '好みの商材' })
        .querySelectorAll('li'),
    ).toHaveLength(2)
    expect(
      within(part('カルテ')).getByRole('link', { name: 'カルテを直す' }),
    ).toHaveAttribute('href', stories.Written.args.changeHref)
  })

  it('should list the treatments the customer had before, in the order they were written', async () => {
    // Act
    await stories.Written.run()

    // Assert
    expect(rowsOf(part('過去の施術'))).toEqual([
      [
        '2026年3月14日（土）',
        'カラー',
        'ヘアサロン 青山',
        '根元から明るめのブラウン。',
      ],
      ['2025年11月2日（日）', 'パーマ', '記録なし', '記録なし'],
    ])
  })

  it('should say what was not written', async () => {
    // Act
    await stories.Blank.run()

    // Assert
    expect(termsOf(part('カルテ')).slice(0, 4)).toEqual([
      ['持病や体調', '記録なし'],
      ['好みの商材', 'なし'],
      ['避ける商材', 'なし'],
      ['メモ', '記録なし'],
    ])
    expect(part('過去の施術')).toHaveTextContent('記録はありません')
  })

  it('should say what a chart holds, and lead to making it, for a customer without one', async () => {
    // Act
    await stories.NoChart.run()

    // Assert
    expect(part('カルテ')).toHaveTextContent(
      'このお客様のカルテは、まだありません。',
    )
    expect(
      within(part('カルテ')).getByRole('link', { name: 'カルテを作る' }),
    ).toHaveAttribute('href', stories.NoChart.args.entryHref)
    expect(screen.queryByRole('region', { name: '過去の施術' })).toBeNull()
  })
})
