import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useLayoutEffect, useState } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { fullReview } from '../examples'
import { ReviewList, type ReviewListProps } from './review-list'
import * as reviewListStories from './review-list.stories'

const stories = composeStories(reviewListStories)

/** The reviews, without the items of the lists a review holds (its photos) */
const listed = (): HTMLElement[] => {
  const reviews = screen.getByRole('list', { name: 'レビュー' })

  return within(reviews)
    .getAllByRole('listitem')
    .filter((item) => item.parentElement === reviews)
}

/** A review of the list, as the texts of its paragraphs. */
const saidIn = (review: HTMLElement | undefined): (string | null)[] =>
  review === undefined
    ? []
    : within(review)
        .getAllByRole('paragraph')
        .map((paragraph) => paragraph.textContent)

const order = (): HTMLElement =>
  screen.getByRole('combobox', { name: '並び順' })

const ADDED_ID = 'f81a3c5d-79fe-4b24-8c46-e80a13356957'

type WhereTheFocusIs = (focused: Element | null) => void

type ChangingReviewsProps = ReviewListProps & {
  seen: WhereTheFocusIs
}

/**
 * A list that gets a review more when its button is pressed, and the same
 * reviews and one more in another order when the order is chosen: what the
 * screen does when a page arrives. It hands over where the focus is in the
 * commit that shows the reviews: the layout effect of a component runs
 * after those of what it holds, and before the browser paints.
 */
const ChangingReviews = ({ seen, ...props }: ChangingReviewsProps) => {
  const [shown, setShown] = useState({
    reviews: props.reviews,
    sortBy: props.sortBy,
  })
  // It holds a link, to its photo, after its text
  const added = {
    ...fullReview,
    id: ADDED_ID,
    title: 'あとから読み込んだレビュー',
    imageUrls: ['https://photos.example.com/added.jpg'],
  }

  useLayoutEffect(() => {
    seen(document.activeElement)
  })

  return (
    <ReviewList
      {...props}
      reviews={shown.reviews}
      sortBy={shown.sortBy}
      onMore={() => setShown({ ...shown, reviews: [...shown.reviews, added] })}
      onSortChange={(sortBy) =>
        setShown({ sortBy, reviews: [added, ...shown.reviews] })
      }
    />
  )
}

const changing = (seen: WhereTheFocusIs) =>
  composeStory(
    {
      ...reviewListStories.WithMore,
      render: (args) => <ChangingReviews {...args} seen={seen} />,
    },
    reviewListStories.default,
  )

describe('ReviewList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the reviews in the order it is given', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      listed().map((review) =>
        within(review).getByRole('img').getAttribute('aria-label'),
      ),
    ).toEqual(['5 段階中 5.0', '5 段階中 3.0', '5 段階中 4.0'])
  })

  it('should show everything a review holds: the day at the salon, the ratings in detail, the answer of the salon', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(saidIn(listed()[0])).toEqual([
      '5.02026年11月10日来店確認済み',
      '思ったとおりの色になりました',
      '写真を見せて相談したら、髪の状態に合わせた染め方を提案してくれました。色もちもよいです。',
      'サービス 5・スタッフ 5・雰囲気 4・清潔さ 5・価格 4',
      '12 人が「参考になった」と答えています',
      'サロンからの返信（2026年11月12日）',
      'ご来店ありがとうございました。またのお越しをお待ちしています。',
    ])
  })

  it('should leave out what a review does not hold', async () => {
    // Act
    await stories.Complete.run()

    // Assert: no title, no detail, nobody found it helpful, no answer, not verified
    expect(saidIn(listed()[1])).toEqual([
      '3.02026年10月28日',
      '仕上がりには満足ですが、予約の時間から 20 分待ちました。',
    ])
    // No text
    expect(saidIn(listed()[2])).toEqual([
      '4.02026年10月2日来店確認済み',
      'また行きます',
      '1 人が「参考になった」と答えています',
    ])
  })

  it('should date a review by the day it was at the salon, and give the moment to a machine', async () => {
    // Act: 23:30 in Tokyo is 14:30 of the same day in UTC, and the next day in Auckland
    await stories.Complete.run({
      args: {
        ...stories.Complete.args,
        reviews: [{ ...fullReview, createdAt: '2026-11-10T14:30:00.000Z' }],
        timezone: 'Pacific/Auckland',
      },
    })

    // Assert
    expect(screen.getByText('2026年11月11日')).toHaveAttribute(
      'datetime',
      '2026-11-10T14:30:00.000Z',
    )
  })

  it.each([
    { story: stories.Complete, chosen: 'recent' },
    { story: stories.BestRatedFirst, chosen: 'rating' },
  ])(
    'should show the order the reviews are in: $chosen',
    async ({ story, chosen }) => {
      // Act
      await story.run()

      // Assert
      expect(order()).toHaveValue(chosen)
      expect(optionsOf(order())).toEqual([
        '新しい順',
        '評価の高い順',
        '参考になった順',
      ])
    },
  )

  it('should hand over the order that is chosen', async () => {
    // Arrange
    await stories.Complete.run()

    // Act
    await userEvent.selectOptions(order(), '参考になった順')

    // Assert
    expect(stories.Complete.args.onSortChange).toHaveBeenCalledTimes(1)
    expect(stories.Complete.args.onSortChange).toHaveBeenCalledWith('helpful')
  })

  it('should have no way to more when the list is complete', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should ask for the next reviews when its button is pressed', async () => {
    // Arrange
    await stories.WithMore.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.WithMore.args.onMore).toHaveBeenCalledTimes(1)
  })

  it('should not ask again while the next reviews are on their way', async () => {
    // Arrange
    await stories.LoadingMore.run()
    const more = screen.getByRole('button', { name: 'さらに表示' })

    // Act
    await userEvent.click(more)

    // Assert
    expect(more).toHaveAttribute('aria-busy', 'true')
    expect(stories.LoadingMore.args.onMore).not.toHaveBeenCalled()
  })

  it('should say that the next reviews did not come, and offer to ask again', async () => {
    // Arrange
    await stories.MoreFailed.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度読み込む' }),
    )

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(stories.MoreFailed.args.onMore).toHaveBeenCalledTimes(1)
    // The reviews that were read stay
    expect(listed()).toHaveLength(3)
  })

  it('should move the focus to the first review that was added, in the commit that shows it', async () => {
    // Arrange
    const seen = vi.fn<WhereTheFocusIs>()
    await changing(seen).run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    const [, , , added] = listed()
    expect(listed()).toHaveLength(4)
    expect(seen).toHaveBeenLastCalledWith(added)
    expect(added).toHaveFocus()
    expect(saidIn(added)).toContain('あとから読み込んだレビュー')
  })

  it('should leave the focus on the control of the order when the reviews come in another order, although they are more', async () => {
    // Arrange
    const seen = vi.fn<WhereTheFocusIs>()
    await changing(seen).run()

    // Act
    await userEvent.selectOptions(order(), '評価の高い順')

    // Assert
    expect(listed()).toHaveLength(4)
    expect(order()).toHaveValue('rating')
    expect(seen).toHaveBeenLastCalledWith(order())
    expect(order()).toHaveFocus()
  })

  describe('what a customer does with the reviews', () => {
    const FIRST = '「思ったとおりの色になりました」（2026年11月10日 投稿）'
    // A review without a title is named by its day alone
    const SECOND = '2026年10月28日 投稿'
    const THIRD = '「また行きます」（2026年10月2日 投稿）'

    const helpfulButton = (subject: string): HTMLElement =>
      screen.getByRole('button', { name: `${subject}のレビューが参考になった` })
    const reportButton = (subject: string): HTMLElement =>
      screen.getByRole('button', { name: `${subject}のレビューを通報する` })
    const controlsOf = (review: HTMLElement | undefined): (string | null)[] =>
      review === undefined
        ? []
        : [
            ...within(review).queryAllByRole('button'),
            ...within(review).queryAllByRole('link'),
          ].map((control) => control.textContent)

    it('should give the reviews no button and no link for somebody who only reads', async () => {
      // Act
      await stories.Complete.run()

      // Assert: the one button of the list is none of a review
      expect(listed().map(controlsOf)).toEqual([[], [], []])
    })

    it('should give every review of somebody else its two buttons, named by the review, with nothing pressed', async () => {
      // Act
      await stories.ForACustomer.run()

      // Assert
      expect(listed().map(controlsOf)).toEqual([
        ['参考になった', '通報する'],
        ['参考になった', '通報する'],
        ['参考になった', '通報する'],
      ])
      for (const subject of [FIRST, SECOND, THIRD]) {
        expect(helpfulButton(subject)).toHaveAttribute('aria-pressed', 'false')
        expect(reportButton(subject)).not.toHaveAttribute('aria-pressed')
      }
    })

    it('should hand over the review that was found helpful', async () => {
      // Arrange
      await stories.ForACustomer.run()

      // Act
      await userEvent.click(helpfulButton(SECOND))

      // Assert
      const { customer } = stories.ForACustomer.args
      expect(customer?.onHelpful).toHaveBeenCalledTimes(1)
      expect(customer?.onHelpful).toHaveBeenCalledWith(
        stories.ForACustomer.args.reviews?.[1],
      )
      expect(customer?.onReport).not.toHaveBeenCalled()
    })

    it('should hand over the review that is to be reported', async () => {
      // Arrange
      await stories.ForACustomer.run()

      // Act
      await userEvent.click(reportButton(THIRD))

      // Assert
      const { customer } = stories.ForACustomer.args
      expect(customer?.onReport).toHaveBeenCalledTimes(1)
      expect(customer?.onReport).toHaveBeenCalledWith(
        stories.ForACustomer.args.reviews?.[2],
      )
      expect(customer?.onHelpful).not.toHaveBeenCalled()
    })

    it('should press the buttons with the keyboard', async () => {
      // Arrange
      await stories.ForACustomer.run()
      helpfulButton(FIRST).focus()

      // Act
      await userEvent.keyboard('{Enter}')
      await userEvent.tab()
      await userEvent.keyboard(' ')

      // Assert
      const { customer } = stories.ForACustomer.args
      expect(customer?.onHelpful).toHaveBeenCalledTimes(1)
      expect(reportButton(FIRST)).toHaveFocus()
      expect(customer?.onReport).toHaveBeenCalledTimes(1)
    })

    it('should say that a review the customer found helpful is pressed, with a mark for the eye, and ask for nothing when it is pressed again', async () => {
      // Arrange
      await stories.WithHelpfulSaid.run()

      // Act
      await userEvent.click(helpfulButton(FIRST))

      // Assert
      expect(helpfulButton(FIRST)).toHaveAttribute('aria-pressed', 'true')
      expect(helpfulButton(FIRST)).toHaveTextContent('✓参考になった')
      expect(helpfulButton(SECOND)).toHaveAttribute('aria-pressed', 'false')
      expect(helpfulButton(SECOND)).toHaveTextContent(/^参考になった$/)
      expect(
        stories.WithHelpfulSaid.args.customer?.onHelpful,
      ).not.toHaveBeenCalled()
    })

    it('should show of which review the answer is on its way, and not ask for it a second time', async () => {
      // Arrange
      await stories.SayingHelpful.run()

      // Act
      await userEvent.click(helpfulButton(FIRST))

      // Assert
      expect(helpfulButton(FIRST)).toHaveAttribute('aria-busy', 'true')
      expect(helpfulButton(SECOND)).not.toHaveAttribute('aria-busy')
      expect(
        stories.SayingHelpful.args.customer?.onHelpful,
      ).not.toHaveBeenCalled()
    })

    it('should give what the customer wrote the link to the form that changes it, in place of the buttons', async () => {
      // Act
      await stories.WithOwnReview.run()

      // Assert
      expect(listed().map(controlsOf)).toEqual([
        ['参考になった', '通報する'],
        ['レビューを変更する'],
        ['参考になった', '通報する'],
      ])
      expect(
        screen.getByRole('link', {
          name: `${SECOND}のレビューを変更する`,
        }),
      ).toHaveAttribute(
        'href',
        '/mypage/reviews/c5e7092a-46db-48f1-b913-b5d7e0023624',
      )
    })
  })

  it('should leave the focus where it is when the list appears', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(document.body).toHaveFocus()
  })
})
