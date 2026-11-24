import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { aCustomer, salon } from '../../../bookings/components/examples'
import * as treatmentTableStories from './treatment-table.stories'

const stories = composeStories(treatmentTableStories)

const table = (name = '施術記録'): HTMLElement =>
  screen.getByRole('table', { name })

describe('TreatmentTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the records with when they were written on the clock of the salon, who had them, who did them and what they were', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        '2026年11月20日（金） 12:30',
        '山田 花子 様',
        '田中 美咲',
        'カット、カラー',
        '75 分',
        '5（とても満足）',
      ],
      [
        '2026年11月18日（水） 17:15',
        '台帳から削除されたお客様',
        '一覧にないスタッフ',
        '削除されたメニュー',
        '記録なし',
        '未回答',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('2 件')
  })

  it('should lead from the moment to the record, and from the name to the customer', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      `/salons/${salon.id}/treatments/${treatmentTableStories.ROWS[0]?.record.id}`,
      `/salons/${salon.id}/customers/${aCustomer().id}`,
      `/salons/${salon.id}/treatments/${treatmentTableStories.ROWS[1]?.record.id}`,
    ])
  })

  it('should say how many records there are and offer the rest', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '48 件（2 件を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })

  it('should say that no record meets the conditions', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(
      within(table('条件に合う施術記録')).getByText('施術記録はありません'),
    ).toBeInTheDocument()
  })
})

describe('TreatmentTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its columns and write its rows, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Found.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Written at',
      'Customer',
      'Staff',
      'Services',
      'Treatment time',
      'Satisfaction',
    ])
    expect(rowsOf(table())).toEqual([
      [
        'Fri, November 20, 2026 at 12:30',
        '山田 花子',
        '田中 美咲',
        'カット, カラー',
        '75 min',
        '5 (Very satisfied)',
      ],
      [
        'Wed, November 18, 2026 at 17:15',
        'Removed from the ledger',
        'Staff member not listed',
        'Removed service',
        'Not recorded',
        'Not answered',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('2 items')
  })
})
