import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as bulletListStories from './bullet-list.stories'

const stories = composeStories(bulletListStories)

describe('BulletList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a list of its items, under the name it is given', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const list = screen.getByRole('list', { name: 'まとめられない理由' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(list).toHaveClass('bulletList')
  })
})
