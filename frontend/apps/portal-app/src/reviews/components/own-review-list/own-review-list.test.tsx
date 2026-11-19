import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useLayoutEffect, useState } from 'react'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { plainSalon, salon } from '../../../salons/components/examples'
import { ownReviews, ratedReview } from '../examples'
import { OwnReviewList, type OwnReviewListProps } from './own-review-list'
import * as ownReviewListStories from './own-review-list.stories'

const stories = composeStories(ownReviewListStories)

/** The reviews of the list. A review may hold a list of its own: its pictures. */
const listed = (): HTMLElement[] => {
  const list = screen.getByRole('list', { name: '自分のレビュー' })

  return within(list)
    .getAllByRole('listitem')
    .filter((item) => item.parentElement === list)
}

/** The review at a place of the list. */
const reviewAt = (index: number): HTMLElement => {
  const review = listed().at(index)
  if (review === undefined) {
    throw new Error(`The list has no review at ${index}`)
  }

  return review
}

const heading = (review: HTMLElement): HTMLElement =>
  within(review).getByRole('heading', { level: 2 })

const moreButton = (name = 'さらに表示'): HTMLElement =>
  screen.getByRole('button', { name })

const FIRST = 'ヘアサロン こもれび 表参道（2026年11月10日 投稿）'
const SECOND = '理容 みなと（2026年10月28日 投稿）'

type WhereTheFocusIs = (focused: Element | null) => void

type GrowingListProps = OwnReviewListProps & {
  seen: WhereTheFocusIs
  /** How many reviews a press of the button of the list adds */
  atOnce: number
}

/**
 * A list that gets reviews when its button is pressed, as the screen does
 * when the next page arrives, and one when 「読み込み直す」 is: a list that
 * is read again may have a review more. It hands over where the focus is
 * in the commit that shows them: the layout effect of a component runs
 * after those of what it holds, and before the browser paints.
 */
const GrowingList = ({ seen, atOnce, ...props }: GrowingListProps) => {
  const [shown, setShown] = useState(props.reviews)

  useLayoutEffect(() => {
    seen(document.activeElement)
  })

  const add = (count: number): void =>
    setShown(ownReviews.slice(0, shown.length + count))

  return (
    <>
      <OwnReviewList {...props} reviews={shown} onMore={() => add(atOnce)} />
      <button type='button' onClick={() => add(1)}>
        読み込み直す
      </button>
    </>
  )
}

/** The list with its first review, which grows. */
const growing = (seen: WhereTheFocusIs = () => undefined, atOnce = 1) =>
  composeStory(
    {
      ...ownReviewListStories.WithMore,
      args: {
        ...ownReviewListStories.WithMore.args,
        reviews: ownReviews.slice(0, 1),
      },
      render: (args) => <GrowingList {...args} seen={seen} atOnce={atOnce} />,
    },
    ownReviewListStories.default,
  )

/** Reviews arrive that no press asked for: the event moves no focus. */
const readAgain = (): void => {
  fireEvent.click(screen.getByRole('button', { name: '読み込み直す' }))
}

describe('OwnReviewList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name each review after its salon, which is the link to the page of the salon, in the order it is given', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      listed().map((review) => {
        const link = within(heading(review)).getByRole('link')

        return [link.textContent, link.getAttribute('href')]
      }),
    ).toEqual([
      [salon.name, `/salons/${salon.id}`],
      [plainSalon.name, `/salons/${plainSalon.id}`],
      [salon.name, `/salons/${salon.id}`],
    ])
  })

  it('should say whom a review rates, and nothing of the staff for one that rates nobody', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      within(reviewAt(0)).getByText('評価したスタッフ: 田中 ひろし'),
    ).toBeVisible()
    expect(within(reviewAt(1)).queryByText(/評価したスタッフ/)).toBeNull()
  })

  it('should show what a review says as the page of the salon does: the rating, the day at the salon, the words, the pictures', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    const review = within(reviewAt(0))
    expect(
      review.getByRole('img', { name: '5 段階中 5.0' }),
    ).toBeInTheDocument()
    expect(review.getByText('2026年11月10日')).toHaveAttribute(
      'datetime',
      ratedReview.createdAt,
    )
    expect(review.getByText('思ったとおりの色になりました')).toBeVisible()
    expect(
      within(review.getByRole('list', { name: '写真' })).getAllByRole('link'),
    ).toHaveLength(2)
    expect(review.getByText('サロンからの返信（2026年11月12日）')).toBeVisible()
  })

  it('should offer for every review the ways to change it and to remove it, each named after its review', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    const change = within(reviewAt(0)).getByRole('link', {
      name: `${FIRST}のレビューを変更する`,
    })
    expect(change).toHaveTextContent(/^変更する$/)
    expect(change).toHaveAttribute('href', `/mypage/reviews/${ratedReview.id}`)
    expect(
      within(reviewAt(0)).getByRole('button', {
        name: `${FIRST}のレビューを削除する`,
      }),
    ).toHaveTextContent(/^削除する$/)
    expect(
      within(reviewAt(1)).getByRole('link', {
        name: `${SECOND}のレビューを変更する`,
      }),
    ).toHaveAttribute('href', `/mypage/reviews/${ownReviews[1]?.review.id}`)
    expect(
      within(reviewAt(1)).getByRole('button', {
        name: `${SECOND}のレビューを削除する`,
      }),
    ).toBeEnabled()
  })

  it('should hand over the review whose button that removes was pressed, and nothing else', async () => {
    // Arrange
    await stories.Complete.run()

    // Act
    await userEvent.click(
      within(reviewAt(1)).getByRole('button', { name: /削除する$/ }),
    )

    // Assert
    expect(stories.Complete.args.onRemove).toHaveBeenCalledTimes(1)
    expect(stories.Complete.args.onRemove).toHaveBeenCalledWith(ownReviews[1])
    expect(stories.Complete.args.onMore).not.toHaveBeenCalled()
  })

  it('should say that the salon and the member of the staff are no longer shown, without a link, and date the review where its reader is', async () => {
    // Act: 23:30 in Tokyo is the next day in Auckland
    await stories.WithoutNames.run({
      args: {
        ...stories.WithoutNames.args,
        reviews: [
          {
            review: { ...ratedReview, createdAt: '2026-11-10T14:30:00.000Z' },
            salon: null,
            staffName: null,
          },
        ],
        timezoneOfReader: 'Pacific/Auckland',
      },
    })

    // Assert
    expect(heading(reviewAt(0))).toHaveTextContent(
      /^サロン（掲載を終えています）$/,
    )
    expect(within(heading(reviewAt(0))).queryByRole('link')).toBeNull()
    expect(
      within(reviewAt(0)).getByText(
        '評価したスタッフ: スタッフ（掲載を終えています）',
      ),
    ).toBeVisible()
    expect(within(reviewAt(0)).getByText('2026年11月11日')).toBeVisible()
    expect(
      within(reviewAt(0)).getByRole('link', {
        name: 'サロン（掲載を終えています）（2026年11月11日 投稿）のレビューを変更する',
      }),
    ).toBeVisible()
  })

  describe('the reviews that come next', () => {
    it('should say how many reviews the list has when all of them are shown', async () => {
      // Act
      await stories.Complete.run()

      // Assert
      expect(screen.getByRole('status')).toHaveTextContent(
        /^3 件のレビューがあります$/,
      )
    })

    it('should say how many of them are shown when the list goes on', async () => {
      // Act
      await stories.WithMore.run()

      // Assert
      expect(screen.getByRole('status')).toHaveTextContent(
        '12 件のレビューがあります（3 件を表示しています）',
      )
    })

    it('should say how many are shown when the API did not count them', async () => {
      // Act
      await stories.NotCounted.run()

      // Assert
      expect(screen.getByRole('status')).toHaveTextContent(
        /^3 件を表示しています$/,
      )
    })

    it('should have no button below the reviews when every review is shown', async () => {
      // Act
      await stories.Complete.run()

      // Assert
      expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should ask for the next reviews when its button is pressed', async () => {
      // Arrange
      await stories.WithMore.run()

      // Act
      await userEvent.click(moreButton())

      // Assert
      expect(stories.WithMore.args.onMore).toHaveBeenCalledTimes(1)
      expect(stories.WithMore.args.onRemove).not.toHaveBeenCalled()
    })

    it('should show that the next reviews are on their way, and not ask for them again', async () => {
      // Arrange
      await stories.LoadingMore.run()

      // Act
      await userEvent.click(moreButton())

      // Assert
      expect(moreButton()).toHaveAttribute('aria-busy', 'true')
      expect(stories.LoadingMore.args.onMore).not.toHaveBeenCalled()
    })

    it('should say that the next reviews did not come, keep those that were read, and ask again when its button is pressed', async () => {
      // Arrange
      await stories.MoreFailed.run()

      // Act
      await userEvent.click(moreButton('もう一度読み込む'))

      // Assert
      expect(screen.getByRole('alert')).toHaveTextContent(
        '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(stories.MoreFailed.args.onMore).toHaveBeenCalledTimes(1)
      expect(listed()).toHaveLength(3)
    })

    it('should move the focus to the salon of the first review that was added, in the commit that shows it', async () => {
      // Arrange
      const seen = vi.fn<WhereTheFocusIs>()
      await growing(seen).run()

      // Act
      await userEvent.click(moreButton())

      // Assert
      const added = within(heading(reviewAt(1))).getByRole('link')
      expect(seen).toHaveBeenLastCalledWith(added)
      expect(added).toHaveFocus()
      expect(listed()).toHaveLength(2)
    })

    it('should move the focus to the first of the reviews when a press adds more than one', async () => {
      // Arrange
      await growing(undefined, 2).run()

      // Act
      await userEvent.click(moreButton())

      // Assert
      expect(listed()).toHaveLength(3)
      expect(within(heading(reviewAt(1))).getByRole('link')).toHaveFocus()
    })

    it('should leave the focus where it is when reviews come that no press asked for', async () => {
      // Arrange
      await growing().run()

      // Act
      readAgain()

      // Assert
      expect(listed()).toHaveLength(2)
      expect(document.body).toHaveFocus()
    })

    it('should move the focus to what the next press adds, after reviews came that no press asked for', async () => {
      // Arrange
      await growing().run()
      readAgain()

      // Act
      await userEvent.click(moreButton())

      // Assert
      expect(within(heading(reviewAt(2))).getByRole('link')).toHaveFocus()
    })

    it('should leave the focus where it is when the list appears', async () => {
      // Act
      await stories.WithMore.run()

      // Assert
      expect(document.body).toHaveFocus()
    })
  })
})
