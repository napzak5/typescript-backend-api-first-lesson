import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf, termsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as treatmentStatisticsStories from './treatment-statistics.stories'

const stories = composeStories(treatmentStatisticsStories)

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

describe('TreatmentStatistics on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should count the records, by category and by service, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Counted.run()

    // Assert
    expect(termsOf('Number of treatment records')).toEqual([
      ['Treatment records', '12 records'],
      ['Average treatment time', '72.5 min'],
    ])
    expect(rowsOf('Treatment records by menu category')).toEqual([
      ['Cut', '9 records'],
      ['Color', '5 records'],
    ])
    expect(
      screen.getByRole('region', { name: 'By menu category' }),
    ).toHaveTextContent(
      /The counts together may be more than the number of treatment records\./,
    )
    expect(rowsOf('Services with the most treatment records')).toEqual([
      ['1st', 'カット', '9 records'],
      ['2nd', 'カラー', '5 records'],
      ['3rd', 'Removed service', '1 record'],
    ])
  })

  it('should say that no time was recorded and no service counted, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithoutTime.run()

    // Assert
    expect(termsOf('Number of treatment records')).toEqual([
      ['Treatment records', '1 record'],
      ['Average treatment time', 'Not recorded'],
    ])
    expect(
      screen.getByRole('table', {
        name: 'Services with the most treatment records',
      }),
    ).toHaveTextContent('No treatment records')
  })
})
