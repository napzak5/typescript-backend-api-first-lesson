import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as otherSalonNoticeStories from './other-salon-notice.stories'

const stories = composeStories(otherSalonNoticeStories)

describe('OtherSalonNotice', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should tell a member of another salon that its bookings are for its staff, and lead to the start', async () => {
    // Act
    await stories.Bookings.run()

    // Assert
    expect(
      screen.getByText(
        'このサロンの予約は、見られません。予約を見られるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: '自分のサロンの予約へ' }),
    ).toHaveAttribute('href', '/')
  })

  it('should name what is not theirs to see, who sees it, and their start', async () => {
    // Act
    await stories.SalesReport.run()

    // Assert
    expect(
      screen.getByText(
        'このサロンの売上レポートは、見られません。売上レポートを見られるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: '自分のサロンの売上レポートへ' }),
    ).toBeVisible()
  })
})

describe('OtherSalonNotice on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should tell a member of another salon in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Bookings.run()

    // Assert
    expect(
      screen.getByText(
        'You cannot see the bookings of this salon. Only the staff of the salon and the administrators can.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Go to the bookings of your salon' }),
    ).toBeVisible()
  })
})
