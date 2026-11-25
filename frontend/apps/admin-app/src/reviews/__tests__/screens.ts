import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
import { TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import { openAs } from '../../__tests__/screens'
import { reviewHrefOf, reviewResponseHrefOf } from '../../navigation'
import { reviewIdOf } from './arrangements'

/*
 * What the screen tests of the reviews open and wait for, and what their
 * screens say alike.
 */

/** What a screen of the reviews says when a review, or the list of them, could not be read */
export const REVIEWS_UNREAD =
  'レビューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** The address of a review of the salon in Tokyo, by its title */
export const reviewAt = async (title: string, salon = TOKYO): Promise<string> =>
  reviewHrefOf(await salonIdOf(salon), await reviewIdOf(title))

/** Opens a review, and waits for its record. */
export const openReviewAs = async (
  title: string,
  email: string,
): Promise<void> => {
  await openAs(await reviewAt(title), email)
  await heading(title)
  await screen.findByRole('link', { name: '来店の予約' })
}

/** The address of the answer to a review of the salon in Tokyo, by its title */
export const responseAt = async (title: string): Promise<string> =>
  reviewResponseHrefOf(await salonIdOf(TOKYO), await reviewIdOf(title))

/** Opens the answer to a review, and waits for its form. */
export const openResponseAs = async (
  title: string,
  email: string,
): Promise<void> => {
  await openAs(await responseAt(title), email)
  await screen.findByRole('textbox', { name: '返信' })
}

/** The titles of the reviews of the list, in its order */
export const listed = (): string[] =>
  within(screen.getByRole('table'))
    .getAllByRole('rowheader')
    .map(({ textContent }) => textContent ?? '')
