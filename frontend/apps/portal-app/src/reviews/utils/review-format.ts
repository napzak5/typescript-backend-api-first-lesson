import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalReviewMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { dayOf } from '../../salons/utils/salon-format'
import type { OwnReview } from '../api/reviews-api'

/**
 * The time zone a review is dated in: that of its salon, as the page of
 * the salon dates it. A salon that is gone has none to give, and the
 * review is dated where its reader is.
 */
export const timezoneOf = (
  { salon }: Pick<OwnReview, 'salon'>,
  timezoneOfReader: string,
): string => salon?.timezone ?? timezoneOfReader

/**
 * What a review is of, as a sentence names it:
 * 「Beauty Salon Tokyo（2026年11月10日 投稿）」.
 */
export const subjectOf = (
  { review, salon }: Pick<OwnReview, 'review' | 'salon'>,
  timezoneOfReader: string,
): LocalizedText =>
  portalReviewMessages.subject(
    salon?.name ?? null,
    dayOf(review.createdAt, timezoneOf({ salon }, timezoneOfReader)),
  )

/**
 * Whom a review rates, in words: the name of the member of the staff, or
 * that their salon no longer shows them; `null` for a review that rates
 * nobody.
 */
export const ratedStaffOf = ({
  review,
  staffName,
}: Pick<OwnReview, 'review' | 'staffName'>): LocalizedText | null =>
  review.staffId === null
    ? null
    : portalReviewMessages.own.ratedStaff(staffName)
