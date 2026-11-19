import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import type { SelectOption } from '@beauty-salon-frontend/ui'
import { booking } from '../../bookings/components/examples'
import {
  fullReview,
  plainSalon,
  salon,
  staff,
} from '../../salons/components/examples'
import type { Entered } from '../review-flow'
import type { OwnReview, Visit } from '../reviews-api'

/*
 * What the stories of the components of the reviews show: the salon, the
 * staff and the review of the stories of the salons, and the booking of
 * the stories of the bookings as a visit that took place.
 */

/** The member of the staff the booking was with */
const [stylist] = staff.filter(({ id }) => id === booking.staffId)

/** The people a review of the visit can rate, as a form offers them */
export const reviewers: SelectOption[] = staff
  .filter(({ id }) => id === booking.staffId)
  .map(({ id, displayName }) => ({ value: id, label: displayName }))

/** A visit that took place, and that nobody has written about: a cut on 7 November, at 10:30 at the salon */
export const visit: Visit = {
  booking: {
    ...booking,
    status: 'completed',
    bookingDate: '2026-11-07',
    startTime: '2026-11-07T01:30:00.000Z',
    endTime: '2026-11-07T02:30:00.000Z',
  },
  customerId: fullReview.customerId,
  salon,
  staff: stylist === undefined ? [] : [stylist],
}

/** A review of that visit that rates the member of the staff, with pictures */
export const ratedReview: ModelsReviewResponse = {
  ...fullReview,
  bookingId: booking.id,
  staffId: booking.staffId,
  imageUrls: [
    'https://images.example.com/reviews/after.jpg',
    'https://images.example.com/reviews/three-weeks-later.jpg',
  ],
}

/** A review that rates nobody and says nothing in words */
export const plainReview: ModelsReviewResponse = {
  ...fullReview,
  id: 'c5e7092a-46db-48f1-b913-b5d7e0023624',
  salonId: plainSalon.id,
  overallRating: 3,
  serviceRating: null,
  staffRating: null,
  atmosphereRating: null,
  cleanlinessRating: null,
  valueRating: null,
  title: null,
  comment: null,
  helpfulCount: 0,
  ownerResponse: null,
  ownerRespondedAt: null,
  createdAt: '2026-10-28T09:15:00.000Z',
  updatedAt: '2026-10-28T09:15:00.000Z',
}

/** A review of an earlier visit to the first salon, in a few words */
const earlierReview: ModelsReviewResponse = {
  ...plainReview,
  id: 'd6f81a3b-57ec-4902-8a24-c6e8f1134735',
  salonId: salon.id,
  overallRating: 4,
  title: 'また行きます',
  createdAt: '2026-10-02T04:00:00.000Z',
  updatedAt: '2026-10-02T04:00:00.000Z',
}

/** What a customer wrote, the latest first, as a list shows it */
export const ownReviews: OwnReview[] = [
  { review: ratedReview, salon, staffName: stylist?.displayName ?? null },
  { review: plainReview, salon: plainSalon, staffName: null },
  { review: earlierReview, salon, staffName: null },
]

/** What the form of a new review is sent with when everything is filled in */
export const everythingEntered: Entered = {
  staffId: booking.staffId,
  overallRating: '5',
  serviceRating: '5',
  staffRating: '4',
  atmosphereRating: '',
  cleanlinessRating: '5',
  valueRating: '3',
  title: '思ったとおりの色になりました',
  comment: '写真を見せて相談しました。\n色もちもよいです。',
  imageUrls: 'https://images.example.com/reviews/after.jpg',
}
