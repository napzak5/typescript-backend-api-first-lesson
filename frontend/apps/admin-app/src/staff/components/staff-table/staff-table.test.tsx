import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
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
    const rows = within(table()).getAllByRole('row').slice(1)
    expect(
      rows.map((row) =>
        [
          ...within(row).getAllByRole('rowheader'),
          ...within(row).getAllByRole('cell'),
        ].map((cell) => cell.textContent),
      ),
    ).toEqual([
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
