import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as cardListStories from './card-list.stories'

const stories = composeStories(cardListStories)

describe('CardList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the items in their order, each in a frame of its own', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const list = screen.getByRole('list', { name: 'サロン' })
    expect(list).toHaveClass('column')
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('h3')?.textContent)).toEqual([
      'Hair Studio Aoyama',
      'Salon Shibuya',
      'Meguro Hair',
    ])
    for (const item of items) {
      expect(item).toHaveClass('item')
    }
  })

  it('should set the items side by side as tiles', async () => {
    // Act
    await stories.Tiles.run()

    // Assert
    expect(screen.getByRole('list', { name: 'サロン' })).toHaveClass('tiles')
  })
})
