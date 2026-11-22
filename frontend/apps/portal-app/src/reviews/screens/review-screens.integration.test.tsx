import { applications } from '@beauty-salon-frontend/brand'
import { heading } from '@beauty-salon-frontend/testing/screens'
import { KENJI, STYLIST } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import { NOTHING, signedInAs } from '../../bookings/__tests__/arrangements'
import { visitReviewed, visitToReview } from '../__tests__/arrangements'

/*
 * Who the screens of the reviews are for, and where each of them stands
 * in the application: what the header marks, and what the document is
 * called. What the screens do is in `review-writing.integration.test.tsx`
 * and in `own-reviews.integration.test.tsx`.
 */

const TITLE = applications.portal.name

type Place = {
  /** The address of the screen, for a visit that nobody wrote about and its review that somebody did */
  pathOf: (ids: { toReview: string; reviewId: string }) => string
  notice: string
  heading: string
  /** The link of the header that is the current one */
  current: string
}

const PLACES: [string, Place][] = [
  [
    'the form that writes a review',
    {
      pathOf: ({ toReview }) => `/bookings/${toReview}/review`,
      notice: 'レビューを書くには、サインインしてください。',
      heading: 'レビューを書く',
      current: '予約の一覧',
    },
  ],
  [
    'the list of what a customer wrote',
    {
      pathOf: () => '/mypage/reviews',
      notice: '自分のレビューを見るには、サインインしてください。',
      heading: '自分のレビュー',
      current: 'マイページ',
    },
  ],
  [
    'the form that changes a review',
    {
      pathOf: ({ reviewId }) => `/mypage/reviews/${reviewId}`,
      notice: 'レビューを変更するには、サインインしてください。',
      heading: 'レビューを変更する',
      current: 'マイページ',
    },
  ],
]

/** An address of the screen that names nothing: who may not see the screen is told before anything is read. */
const NOWHERE = { toReview: NOTHING, reviewId: NOTHING }

describe.each(PLACES)('%s, against the API', (_screen, place) => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should ask somebody who is not signed in to sign in', async () => {
    // Act
    renderAt(place.pathOf(NOWHERE))

    // Assert
    expect(await screen.findByText(place.notice)).toBeVisible()
    expect(screen.queryByRole('heading', { name: place.heading })).toBeNull()
  })

  it('should tell an account of the staff of a salon that the screen is not for it', async () => {
    // Arrange
    await signedInAs(STYLIST)

    // Act
    renderAt(place.pathOf(NOWHERE))

    // Assert
    expect(
      await screen.findByText(
        `${STYLIST} のアカウントでは利用できません。利用できるアカウントでサインインし直してください。`,
      ),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: place.heading })).toBeNull()
  })

  it('should show a customer the screen, mark its place in the header, and name it in the title of the document', async () => {
    // Arrange
    await signedInAs(KENJI.email)
    const { id: toReview } = await visitToReview()
    const { reviewId } = await visitReviewed()

    // Act
    renderAt(place.pathOf({ toReview, reviewId }))

    // Assert
    expect(await heading(place.heading)).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: 'メインメニュー' }))
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page')
        .map((link) => link.textContent),
    ).toEqual([place.current])
    expect(document.title).toBe(`${place.heading} | ${TITLE}`)
  })
})
