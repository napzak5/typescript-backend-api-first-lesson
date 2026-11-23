import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { type More, moreOf, moreOfRows } from './load-more'
import * as loadMoreStories from './load-more.stories'

const stories = composeStories(loadMoreStories)

describe('LoadMore', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

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

  it('should offer the next page in English on a page in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Available.run()

    // Assert
    expect(
      screen.getAllByRole('button').map(({ textContent }) => textContent),
    ).toEqual(['Show more'])
  })

  it('should say in English that the page did not come, and offer to load again', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'The rest could not be loaded. Check your connection and try again.',
    )
    expect(
      screen.getAllByRole('button').map(({ textContent }) => textContent),
    ).toEqual(['Load again'])
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

describe('moreOfRows', () => {
  const CASES: [
    string,
    Parameters<typeof moreOfRows>[0],
    More,
    boolean,
    More,
  ][] = [
    ['names on their way', { type: 'reading' }, 'none', false, 'loading'],
    [
      'names on their way again',
      { type: 'reading' },
      'failed',
      true,
      'loading',
    ],
    ['names not read', { type: 'unread' }, 'available', false, 'failed'],
    ['names read again', { type: 'unread' }, 'available', true, 'loading'],
    [
      'every row, and more pages',
      { type: 'none' },
      'available',
      false,
      'available',
    ],
    [
      'every row, and a page on its way',
      { type: 'none' },
      'loading',
      false,
      'loading',
    ],
    [
      'every row, and a page not read',
      { type: 'none' },
      'failed',
      false,
      'failed',
    ],
    // Names that are read again for another reason leave the rows as they are
    [
      'every row, while names are read again',
      { type: 'none' },
      'available',
      true,
      'available',
    ],
    ['every row of every page', { type: 'none' }, 'none', false, 'none'],
  ]

  it.each(CASES)(
    'should say what comes after the rows with %s',
    (_case, rest, pages, readingAgain, more) => {
      expect(moreOfRows(rest, pages, readingAgain)).toBe(more)
    },
  )
})
