import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as actionsStories from './actions.stories'

const stories = composeStories(actionsStories)

/** The element the buttons stand in */
const actions = (): HTMLElement | null =>
  screen.getByRole('button', { name: '予約を確定する' }).parentElement

describe('Actions', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should give its buttons in the order they are read', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['予約を確定する', '予約を取り消す'])
    expect(screen.getByRole('link', { name: '予約を変える' })).toBeVisible()
  })

  it.each<[story: keyof typeof stories, layout: string]>([
    ['Default', 'flow'],
    ['Row', 'row'],
    ['Stack', 'stack'],
  ])(
    'should lay out its buttons in the %s story by the class of its layout',
    async (story, layout) => {
      // Act
      await stories[story].run()

      // Assert
      expect(actions()).toHaveClass(layout)
    },
  )
})
