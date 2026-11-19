import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as appShellStories from './app-shell.stories'

const stories = composeStories(appShellStories)

describe('AppShell', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name the application in the banner', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(screen.getByRole('banner')).toHaveTextContent('Beauty Salon Admin')
  })

  it('should hold the content of the screen in the main landmark', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(
      within(screen.getByRole('main')).getByRole('heading', {
        level: 1,
        name: '予約台帳',
      }),
    ).toBeVisible()
  })

  it('should hold the navigation outside the main content', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(
      screen.getByRole('navigation', { name: 'メインメニュー' }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('main')).queryByRole('navigation'),
    ).toBeNull()
  })

  it('should show what belongs to the account in the banner', async () => {
    // Act
    await stories.NavigationInHeader.run()
    const banner = within(screen.getByRole('banner'))

    // Assert
    expect(banner.getByText('佐藤 美咲')).toBeVisible()
    expect(banner.getByRole('button', { name: 'サインアウト' })).toBeVisible()
  })

  it('should keep the place of the notification at the top of the main content', async () => {
    // Act
    await stories.NavigationInHeader.run()
    const main = screen.getByRole('main')

    // Assert
    expect(main.firstElementChild).toContainElement(
      within(main).getByRole('status'),
    )
    expect(main.lastElementChild).toContainElement(
      within(main).getByRole('heading', { level: 1 }),
    )
    expect(within(main).getByRole('status')).toBeEmptyDOMElement()
  })

  it('should offer a link to the main content as the first stop of the Tab key', async () => {
    // Arrange
    await stories.NavigationInHeader.run()

    // Act
    await userEvent.tab()

    // Assert
    expect(screen.getByRole('link', { name: '本文へ移動' })).toHaveFocus()
    expect(screen.getByRole('link', { name: '本文へ移動' })).toHaveAttribute(
      'href',
      '#main',
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('should keep its navigation under the header unless it is told otherwise', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(screen.getByRole('banner').parentElement).toHaveClass('frame')
    expect(screen.getByRole('banner').parentElement).not.toHaveClass(
      'navigationAtSide',
    )
  })

  it('should carry the class of a navigation that stands beside the content', async () => {
    // Act
    await stories.NavigationAtSide.run()

    // Assert
    expect(screen.getByRole('banner').parentElement).toHaveClass(
      'frame',
      'navigationAtSide',
    )
  })

  it('should have no navigation and nothing of an account before signing in', async () => {
    // Act
    await stories.SignedOut.run()

    // Assert
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('banner')).toHaveTextContent('Beauty Salon Portal')
  })

  it('should name the document after the screen and the application', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(document.title).toBe('予約台帳 | Beauty Salon Admin')
  })

  it('should name the document once when the screen is named like the application', async () => {
    // Act
    await stories.HomeScreen.run()

    // Assert
    expect(document.title).toBe('Beauty Salon Admin')
  })

  it('should leave the focus alone for the first screen of a page', async () => {
    // Act
    await stories.ScreenChange.run()

    // Assert
    expect(document.body).toHaveFocus()
  })

  it('should move the focus to the heading of a screen that takes the place of another', async () => {
    // Arrange
    await stories.ScreenChange.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '顧客台帳を開く' }),
    )

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: '顧客台帳' }),
    ).toHaveFocus()
    expect(document.title).toBe('顧客台帳 | Beauty Salon Admin')
  })

  it('should keep the heading out of the stops of the Tab key', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })
})
