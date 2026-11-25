import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
import { OSAKA } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { openAs } from '../../__tests__/screens'
import { reviewHrefOf } from '../../navigation'
import { reviewIdOf } from '../../reviews/__tests__/arrangements'

/*
 * What the screen tests of the reports of reviews open and wait for, and
 * the parts of the screen of a review they look into.
 */

/** «Great experience» of the salon in Osaka, which has a report that waits */
export const GREAT = 'Great experience'

/** Opens a review of the salon in Osaka, and waits for it. */
export const openReviewAs = async (
  email: string,
  title = GREAT,
): Promise<void> => {
  await openAs(
    reviewHrefOf(await salonIdOf(OSAKA), await reviewIdOf(title)),
    email,
  )
  await heading(title)
}

/** The reports of the review shown */
export const reportsPart = (): HTMLElement =>
  screen.getByRole('region', { name: '通報' })

/** The removal of the review shown */
export const removalPart = (): HTMLElement =>
  screen.getByRole('region', { name: 'レビューの削除' })

/** Opens the dialog of the removal of «Great experience». */
export const askToRemove = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(
    within(removalPart()).getByRole('button', { name: 'レビューを削除する' }),
  )

  return screen.getByRole('dialog', { name: `「${GREAT}」を削除しますか？` })
}
