import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as badgeStories from './badge.stories'

const stories = composeStories(badgeStories)

describe('Badge', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it.each([
    { story: stories.Neutral, tone: 'neutral', text: '仮予約' },
    { story: stories.Info, tone: 'info', text: '来店中' },
    { story: stories.Success, tone: 'success', text: '確定' },
    { story: stories.Warning, tone: 'warning', text: '残りわずか' },
    { story: stories.Danger, tone: 'danger', text: 'キャンセル' },
  ])(
    'should say its state in words and carry the class of the $tone tone',
    async ({ story, tone, text }) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByText(text)).toHaveClass('badge', tone)
    },
  )

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Success.run({
      args: { ...stories.Success.args, className: 'in-row' },
    })

    // Assert
    expect(screen.getByText('確定')).toHaveClass('badge', 'success', 'in-row')
  })
})
