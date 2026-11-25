import {
  giveBack,
  salonIdOf,
  takeAway,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  termsOf,
} from '@beauty-salon-frontend/testing/screens'
import { OWNER, SAKURA, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { arrangeMany } from '../../bookings/__tests__/arrangements'
import {
  customerIdOf,
  removeMeanwhile,
} from '../../customers/__tests__/arrangements'
import { reviewResponseHrefOf, reviewsHrefOf } from '../../navigation'
import {
  everyReviewRemoved,
  firstReviewId,
  reviewIdOf,
  reviewMany,
  reviewRemovedMeanwhile,
} from '../__tests__/arrangements'
import {
  listed,
  openReviewAs,
  REVIEWS_UNREAD,
  responseAt,
  reviewAt,
} from '../__tests__/screens'

/*
 * The reviews of a salon, when a read fails, when the review or its
 * customer is gone, and when nothing is there. The failures are arranged
 * in the database; what goes well is in `reviews.integration.test.tsx`.
 */

const GOOD = 'Good but could be better'

const SUMMARY_UNREAD =
  '評価のまとめを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** Opens the reviews of the salon in Tokyo as its owner, and waits for the screen. */
const openReviews = async (): Promise<void> => {
  await openAs(reviewsHrefOf(await salonIdOf(TOKYO)), OWNER)
  await heading('レビュー')
}

describe('the reviews of a salon, when something fails or is gone, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that what the reviews come to could not be read, and show it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await takeAway('reviews', 'overallRating')
    // The list is read once what the reviews come to was refused, with the column given back
    whenAskedFor('GET /reviews', async () => {
      await screen.findByText(SUMMARY_UNREAD)
      await giveBack('reviews', 'overallRating')
    })
    await openReviews()
    expect(await screen.findByText(SUMMARY_UNREAD)).toBeVisible()
    await screen.findByRole('table', { name: 'レビュー' })

    // Act
    await readAgain(user)

    // Assert
    expect(
      await screen.findByRole('region', { name: '評価のまとめ' }),
    ).toHaveTextContent('3 件')
    expect(screen.queryByText(SUMMARY_UNREAD)).toBeNull()
  })

  it('should say that the reviews could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'reviews',
      'updatedAt',
      await reviewIdOf(GOOD),
    )
    await openReviews()
    expect(await screen.findByText(REVIEWS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await screen.findByRole('table', { name: 'レビュー' })
    expect(listed()).toHaveLength(3)
  })

  it('should say that the reviews that come next could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMany(-1, 21)
    await reviewMany()
    const readable = await unreadable(
      'reviews',
      'updatedAt',
      await firstReviewId(TOKYO),
    )
    await openReviews()
    await screen.findByRole('table', { name: 'レビュー' })
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await waitFor(() => {
      expect(listed()).toHaveLength(24)
    })
    expect(listed().at(-1)).toBe('Review of BK-MANY-0001')
    expect(screen.getByText('24 件')).toBeVisible()
  })

  it('should read the reviews again when the same conditions are sent', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviews()
    await screen.findByRole('table', { name: 'レビュー' })
    await reviewRemovedMeanwhile(GOOD)

    // Act
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await waitFor(() => {
      expect(listed()).toHaveLength(2)
    })
    expect(listed()).not.toContain(GOOD)
  })

  it('should say that the salon has no review yet, and how reviews come in', async () => {
    // Arrange
    await everyReviewRemoved()

    // Act
    await openReviews()

    // Assert
    expect(await screen.findByText('レビューはありません')).toBeVisible()
    expect(
      screen.getByText(
        'お客様は、来店のあとに、ポータルからレビューを書けます。届いたレビューは、ここに並びます。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should say of a review whose customer was removed from the ledger that the ledger has them no more', async () => {
    // Arrange
    await removeMeanwhile(SAKURA.email)

    // Act
    await openReviewAs(GOOD, OWNER)

    // Assert
    await waitFor(() => {
      expect(termsOf('レビュー')).toContainEqual([
        'お客様',
        '台帳から削除されたお客様',
      ])
    })
    expect(screen.queryByRole('link', { name: SAKURA.name })).toBeNull()
  })

  it('should say that the customer of a review could not be read', async () => {
    // Arrange
    await unreadable('customers', 'updatedAt', await customerIdOf(SAKURA.email))

    // Act
    await openReviewAs(GOOD, OWNER)

    // Assert
    await waitFor(() => {
      expect(termsOf('レビュー')).toContainEqual([
        'お客様',
        '読み込めませんでした',
      ])
    })
  })

  it('should say that a review could not be read, and show it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'reviews',
      'updatedAt',
      await reviewIdOf(GOOD),
    )
    await openAs(await reviewAt(GOOD), OWNER)
    expect(await screen.findByText(REVIEWS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await heading(GOOD)).toBeVisible()
  })

  it('should say that the review is gone when its customer removed it while it was reported', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(GOOD, OWNER)
    await reviewRemovedMeanwhile(GOOD)
    await user.click(
      within(screen.getByRole('region', { name: '運営への通報' })).getByRole(
        'button',
        { name: '通報する' },
      ),
    )
    const dialog = screen.getByRole('dialog', { name: 'レビューを通報する' })
    await user.click(
      within(dialog).getByRole('radio', {
        name: '宣伝や、来店と関係のない内容',
      }),
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: '通報する' }))

    // Assert
    expect(await heading('レビューが見つかりません')).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should say at the answer to a review of another salon that it is not found', async () => {
    // Act
    await openAs(
      reviewResponseHrefOf(
        await salonIdOf(TOKYO),
        await reviewIdOf('Great experience'),
      ),
      OWNER,
    )

    // Assert
    expect(await heading('レビューが見つかりません')).toBeVisible()
    expect(screen.queryByRole('textbox', { name: '返信' })).toBeNull()
  })

  it('should say at the answer that the review could not be read, and offer the form when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'reviews',
      'updatedAt',
      await reviewIdOf(GOOD),
    )
    await openAs(await responseAt(GOOD), OWNER)
    expect(await screen.findByText(REVIEWS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await screen.findByRole('textbox', { name: '返信' })).toBeVisible()
  })
})
