import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as pageHeaderStories from './page-header.stories'

const stories = composeStories(pageHeaderStories)

describe('PageHeader', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show its title as the one heading of level 1', async () => {
    // Act
    await stories.WithActions.run()

    // Assert
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(
      screen.getByRole('heading', { level: 1, name: '予約台帳' }),
    ).toBeVisible()
  })

  it('should show its description', async () => {
    // Act
    await stories.WithDescription.run()

    // Assert
    expect(screen.getByText('今日の予約は 12 件です。')).toHaveClass(
      'description',
    )
  })

  it('should show its actions', async () => {
    // Act
    await stories.WithActions.run()

    // Assert
    expect(
      screen.getByRole('link', { name: '新しい予約' }).parentElement,
    ).toHaveClass('actions')
  })

  it('should hold nothing but its title when it is given nothing else', async () => {
    // Act
    await stories.TitleOnly.run()

    // Assert
    expect(
      screen.getByRole('heading').parentElement?.parentElement,
    ).toHaveTextContent(/^予約台帳$/)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('should leave the title of the document alone outside the frame of an application', async () => {
    // Arrange
    document.title = 'カタログ'

    // Act
    await stories.TitleOnly.run()

    // Assert
    expect(document.title).toBe('カタログ')
  })
})
