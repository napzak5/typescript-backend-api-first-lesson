import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as notFoundPageStories from './not-found-page.stories'

const stories = composeStories(notFoundPageStories)

describe('NotFoundPage', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say that there is no such page, and what to look at', async () => {
    // Act
    await stories.NotFound.run()

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'ページが見つかりません' }),
    ).toBeVisible()
    expect(
      screen.getByText('アドレスが正しいか、お確かめください。'),
    ).toBeVisible()
  })

  it('should lead back to the first screen of the application', async () => {
    // Act
    await stories.NotFound.run()

    // Assert
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'トップへ戻る' })).toHaveAttribute(
      'href',
      '/',
    )
  })
})

describe('NotFoundPage on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say in English that there is no such page, and lead back', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NotFound.run()

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible()
    expect(screen.getByText('Check that the address is correct.')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Back to the top' }),
    ).toHaveAttribute('href', '/')
  })
})
