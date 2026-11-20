import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { CATEGORIES_OF_THE_MENU } from '../examples'
import * as categoryTableStories from './category-table.stories'

const stories = composeStories(categoryTableStories)

const table = (): HTMLElement =>
  screen.getByRole('table', { name: 'カテゴリー' })

describe('CategoryTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the categories with their parents, kinds, places, colours and states', async () => {
    // Act
    await stories.ToKeep.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          [
            ...within(row).getAllByRole('rowheader'),
            ...within(row).getAllByRole('cell'),
          ].map((cell) => cell.textContent),
        ),
    ).toEqual([
      ['カット', 'なし', 'カット', '1', '#C8A2C8', '有効'],
      ['カラー', 'なし', 'カラー', '2', '記録なし', '有効'],
      ['ハイライト', 'カラー', 'カラー', '3', '#FFD93D', '無効'],
    ])
  })

  it('should lead from the name to the change of the category, for an account that keeps the menu', async () => {
    // Act
    await stories.ToKeep.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      CATEGORIES_OF_THE_MENU.map(
        ({ id }) => `/salons/${salon.id}/menu/categories/${id}/edit`,
      ),
    )
  })

  it('should lead nowhere for a member of the staff', async () => {
    // Act
    await stories.ToRead.run()

    // Assert
    expect(within(table()).queryAllByRole('link')).toEqual([])
    expect(within(table()).getAllByRole('rowheader')[0]).toHaveTextContent(
      'カット',
    )
  })
})
