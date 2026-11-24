import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { aNewMember, aStaffMember, theOwner } from '../examples'
import * as staffTableStories from './staff-table.stories'

const stories = composeStories(staffTableStories)

const table = (): HTMLElement => screen.getByRole('table', { name: 'スタッフ' })

describe('StaffTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the members by the name the customers see, with their names, levels, positions, bookings and states', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        '森 明子',
        '森 明子（モリ アキコ）',
        'ディレクター',
        'オーナー',
        '受けない',
        '有効',
      ],
      [
        '田中 美咲',
        '田中 美咲（タナカ ミサキ）',
        'シニア',
        'トップスタイリスト',
        '受ける',
        '有効',
      ],
      ['佐藤 健', '佐藤 健', 'ジュニア', '記録なし', '受けない', '無効'],
    ])
    expect(screen.getByRole('status').textContent).toBe('3 人')
  })

  it('should lead from the name to the member', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      [theOwner(), aStaffMember(), aNewMember()].map(
        ({ id }) => `/salons/${salon.id}/staff/${id}`,
      ),
    )
  })

  it('should say how many members there are and offer the rest', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '24 人（3 人を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })
})

describe('StaffTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its columns and write its rows, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Found.run()

    // Assert
    const ledger = screen.getByRole('table', { name: 'Staff' })
    expect(
      within(ledger)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Display name',
      'Full name',
      'Level',
      'Position',
      'Online bookings',
      'Status',
    ])
    expect(rowsOf(ledger)).toEqual([
      [
        '森 明子',
        '森 明子 (モリ アキコ)',
        'Director',
        'オーナー',
        'Not accepted',
        'Active',
      ],
      [
        '田中 美咲',
        '田中 美咲 (タナカ ミサキ)',
        'Senior',
        'トップスタイリスト',
        'Accepted',
        'Active',
      ],
      [
        '佐藤 健',
        '佐藤 健',
        'Junior',
        'Not recorded',
        'Not accepted',
        'Inactive',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('3 people')
  })
})
