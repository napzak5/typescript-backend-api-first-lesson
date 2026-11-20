import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as treatmentStatisticsStories from './treatment-statistics.stories'

const stories = composeStories(treatmentStatisticsStories)

/** What a card says, term by term */
const termsOf = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

/** The rows of a table, cell by cell in the order they are shown */
const rowsOf = (table: string): (string | null)[][] =>
  within(screen.getByRole('table', { name: table }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent),
    )

describe('TreatmentStatistics', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say how many records there are, and how long their treatments took on average', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(termsOf('施術記録の数')).toEqual([
      ['施術記録', '12 件'],
      ['施術時間の平均', '72.5 分'],
    ])
  })

  it('should count the records by the kind of their services, and say that a record may count for two', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(rowsOf('メニューの区分ごとの施術記録')).toEqual([
      ['カット', '9 件'],
      ['カラー', '5 件'],
    ])
    expect(
      screen.getByRole('region', { name: 'メニューの区分ごと' }),
    ).toHaveTextContent(/合わせた数は、施術記録の数より多いことがあります。/)
  })

  it('should rank the services that most records had, and name one the salon removed', async () => {
    // Act
    await stories.Counted.run()

    // Assert
    expect(rowsOf('施術記録の多いサービス')).toEqual([
      ['1 位', 'カット', '9 件'],
      ['2 位', 'カラー', '5 件'],
      ['3 位', '削除されたメニュー', '1 件'],
    ])
    expect(
      within(screen.getByRole('table', { name: '施術記録の多いサービス' }))
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['カット', 'カラー', '削除されたメニュー'])
  })

  it('should say that no time was recorded, and that no service was counted', async () => {
    // Act
    await stories.WithoutTime.run()

    // Assert
    expect(termsOf('施術記録の数')).toEqual([
      ['施術記録', '1 件'],
      ['施術時間の平均', '記録なし'],
    ])
    expect(rowsOf('メニューの区分ごとの施術記録')).toEqual([['その他', '1 件']])
    expect(
      screen.getByRole('table', { name: '施術記録の多いサービス' }),
    ).toHaveTextContent('施術記録はありません')
  })
})
