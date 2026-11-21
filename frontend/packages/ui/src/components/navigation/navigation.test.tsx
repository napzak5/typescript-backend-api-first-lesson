import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as navigationStories from './navigation.stories'

const stories = composeStories(navigationStories)

describe('Navigation', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a navigation landmark of its name that lists its links in order', async () => {
    // Act
    await stories.Horizontal.run()
    const navigation = screen.getByRole('navigation', {
      name: 'メインメニュー',
    })

    // Assert
    expect(
      within(navigation)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['予約台帳', '/bookings'],
      ['会計', '/sales'],
      ['顧客台帳', '/customers'],
      ['スタッフ', '/staff'],
    ])
    expect(within(navigation).getAllByRole('listitem')).toHaveLength(4)
  })

  it('should mark the link of the current screen, and no other', async () => {
    // Act
    await stories.Horizontal.run()

    // Assert
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent(
      '予約台帳',
    )
    expect(screen.getByRole('link', { name: '会計' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('should mark the current link of a row longer than the screen, which the browser brings into sight', async () => {
    // Act
    await stories.CurrentFarAlong.run()

    // Assert
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent(
      '商品',
    )
    expect(screen.getAllByRole('link')).toHaveLength(12)
  })

  it('should mark no link when no screen of the navigation is shown', async () => {
    // Act
    await stories.NoCurrentScreen.run()

    // Assert
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull()
  })

  it('should let the Tab key go through the links in order', async () => {
    // Arrange
    await stories.Horizontal.run()

    // Act
    await userEvent.tab()
    await userEvent.tab()

    // Assert
    expect(screen.getByRole('link', { name: '会計' })).toHaveFocus()
  })

  it.each([
    { story: stories.Horizontal, orientation: 'horizontal' },
    { story: stories.Vertical, orientation: 'vertical' },
  ])(
    'should carry the class of the $orientation orientation',
    async ({ story, orientation }) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByRole('list')).toHaveClass('list', orientation)
    },
  )

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Vertical.run({
      args: { ...stories.Vertical.args, className: 'in-shell' },
    })

    // Assert
    expect(screen.getByRole('navigation')).toHaveClass('in-shell')
  })
})
