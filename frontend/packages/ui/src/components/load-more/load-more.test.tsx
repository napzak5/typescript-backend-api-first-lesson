import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { type More, moreOf } from './load-more'
import * as loadMoreStories from './load-more.stories'

const stories = composeStories(loadMoreStories)

describe('LoadMore', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should ask for the next page when its button is pressed', async () => {
    // Arrange
    await stories.Available.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.Available.args.onMore).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should keep its button from being pressed again while the page is on its way', async () => {
    // Act
    await stories.Loading.run()

    // Assert
    expect(screen.getByRole('button', { name: /さらに表示/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('should say that the page did not come, and offer to ask again', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '続きを読み込めませんでした。',
    )
    expect(
      screen.getByRole('button', { name: 'もう一度読み込む' }),
    ).toBeVisible()
  })

  it('should show nothing once every page was read', async () => {
    // Act
    await stories.NothingMore.run()

    // Assert
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('moreOf', () => {
  const IDLE = { nextPage: false, again: false }

  const CASES: [
    Parameters<typeof moreOf>[0],
    Parameters<typeof moreOf>[1],
    More,
  ][] = [
    ['none', IDLE, 'none'],
    ['none', { nextPage: true, again: true }, 'none'],
    ['more', IDLE, 'available'],
    ['more', { nextPage: true, again: false }, 'loading'],
    // The list is read again for another reason: its button stays as it is
    ['more', { nextPage: false, again: true }, 'available'],
    ['unread', IDLE, 'failed'],
    ['unread', { nextPage: false, again: true }, 'loading'],
    ['unread', { nextPage: true, again: false }, 'loading'],
  ]

  it.each(CASES)(
    'should say of a list with the rest %s, fetching %j: %s',
    (rest, fetching, more) => {
      expect(moreOf(rest, fetching)).toBe(more)
    },
  )
})
