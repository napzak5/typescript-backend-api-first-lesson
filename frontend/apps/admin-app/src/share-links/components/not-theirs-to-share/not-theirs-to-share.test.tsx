import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as notTheirsToShareStories from './not-theirs-to-share.stories'

const stories = composeStories(notTheirsToShareStories)

const part = (name = '共有リンク') => screen.getByRole('region', { name })

describe('NotTheirsToShare', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should tell a member who shares no file who does, with nothing to issue', async () => {
    // Act
    await stories.MemberOfTheStaff.run()

    // Assert
    expect(
      within(part()).getByText(/オーナー、マネージャー、管理者/),
    ).toBeVisible()
    expect(within(part()).queryByRole('link')).toBeNull()
    expect(within(part()).queryByRole('table')).toBeNull()
  })
})

describe('NotTheirsToShare on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should tell in English a member who shares no file who does', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.MemberOfTheStaff.run()

    // Assert
    expect(part('Share links')).toHaveTextContent(
      'Only the owners and managers of the salon and administrators can issue and revoke the share links of files.',
    )
    expect(screen.queryByRole('link')).toBeNull()
  })
})
