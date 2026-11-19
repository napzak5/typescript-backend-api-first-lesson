import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as alertStories from './alert.stories'

const stories = composeStories(alertStories)

describe('Alert', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it.each([
    { story: stories.Info, tone: 'info' },
    { story: stories.Success, tone: 'success' },
    { story: stories.Warning, tone: 'warning' },
  ])(
    'should wait its turn to be announced when its tone is $tone',
    async ({ story, tone }) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByRole('status')).toHaveClass('alert', tone)
      expect(screen.queryByRole('alert')).toBeNull()
    },
  )

  it('should be announced at once when something went wrong', async () => {
    // Act
    await stories.Danger.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveClass('alert', 'danger')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'メールアドレスまたはパスワードが違います。',
    )
  })

  it('should be informative unless a tone is given', async () => {
    // Act
    await stories.Info.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      '次回のご予約は 12 月 3 日（木）14:00 です。',
    )
  })

  it('should show its title before its message', async () => {
    // Act
    await stories.WithTitle.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      /^予約できませんでした.*別の時間をお選びください。$/,
    )
    expect(screen.getByText('予約できませんでした')).toHaveClass('title')
  })

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Success.run({
      args: { ...stories.Success.args, className: 'in-page' },
    })

    // Assert
    expect(screen.getByRole('status')).toHaveClass(
      'alert',
      'success',
      'in-page',
    )
  })
})
