import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
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

describe('NoSalonNotice on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say in English that the account belongs to no salon', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NoSalon.run()

    // Assert
    expect(
      screen.getByRole('heading', { name: 'You do not belong to any salon' }),
    ).toBeVisible()
    expect(
      screen.getByText(/^This account is not on the staff of any salon now\./),
    ).toBeVisible()
  })
})
