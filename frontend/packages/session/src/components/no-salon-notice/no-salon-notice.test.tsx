import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as noSalonNoticeStories from './no-salon-notice.stories'

const stories = composeStories(noSalonNoticeStories)

describe('NoSalonNotice', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say that the account belongs to no salon, and how it joins one', async () => {
    // Act
    await stories.NoSalon.run()

    // Assert
    expect(
      screen.getByRole('heading', { name: 'どのサロンにも属していません' }),
    ).toBeVisible()
    expect(
      screen.getByText(/招待のメールを受け取り、そのリンクから参加すると/),
    ).toBeVisible()
  })
})
