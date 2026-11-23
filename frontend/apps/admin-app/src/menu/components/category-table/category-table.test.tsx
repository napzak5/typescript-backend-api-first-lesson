import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { CATEGORIES_OF_THE_MENU, colouring } from '../examples'
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
    expect(rowsOf(table())).toEqual([
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

  it('should write a display order of four figures with a separator', async () => {
    // Act
    await stories.ToKeep.run({
      args: {
        ...stories.ToKeep.args,
        categories: [{ ...colouring(), displayOrder: 1200 }],
      },
    })

    // Assert
    expect(rowsOf(table())).toEqual([
      ['カラー', 'なし', 'カラー', '1,200', '記録なし', '有効'],
    ])
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

describe('CategoryTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its columns, and say the parents, kinds and states, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.ToKeep.run()

    // Assert
    const categories = screen.getByRole('table', { name: 'Categories' })
    expect(
      within(categories)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Name', 'Parent', 'Type', 'Display order', 'Color', 'Status'])
    expect(rowsOf(categories)).toEqual([
      ['カット', 'None', 'Cut', '1', '#C8A2C8', 'Active'],
      ['カラー', 'None', 'Color', '2', 'Not recorded', 'Active'],
      ['ハイライト', 'カラー', 'Color', '3', '#FFD93D', 'Inactive'],
    ])
  })
})
