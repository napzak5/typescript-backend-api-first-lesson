import { inJapanese } from '@beauty-salon-frontend/ui'
import { dayOf } from '../../salons/utils/salon-format'
import type { OwnReview } from '../api/reviews-api'

/** What stands where a name would, when what is named is no longer there */
export const NO_SALON = 'サロン（掲載を終えています）'
export const NO_STAFF = 'スタッフ（掲載を終えています）'

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
): string =>
  `${salon?.name ?? NO_SALON}（${inJapanese(dayOf(review.createdAt, timezoneOf({ salon }, timezoneOfReader)))} 投稿）`

/**
 * Whom a review rates, in words: the name of the member of the staff, or
 * that their salon no longer shows them; `null` for a review that rates
 * nobody.
 */
export const ratedStaffOf = ({
  review,
  staffName,
}: Pick<OwnReview, 'review' | 'staffName'>): string | null =>
  review.staffId === null ? null : (staffName ?? NO_STAFF)
