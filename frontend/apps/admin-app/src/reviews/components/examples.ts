import type {
  ModelsReviewResponse,
  ModelsReviewSummaryResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aBooking,
  customers,
  salon,
  staff,
} from '../../bookings/components/examples'

/*
 * The reviews of the salon of the examples, as the API answers with them.
 */

const [misaki, ken] = staff

/** A review of five, with its title, its comment and every rating, which the salon answered */
export const answeredReview: ModelsReviewResponse = {
  id: '5e1c7a3d-9b2f-4d6e-8a1c-3f7b9d2e4a60',
  salonId: salon.id,
  customerId: customers[0]?.id ?? '',
  bookingId: aBooking().id,
  staffId: misaki?.id ?? null,
  overallRating: 5,
  serviceRating: 5,
  staffRating: 5,
  atmosphereRating: 4,
  cleanlinessRating: 5,
  valueRating: 4,
  title: '仕上がりに大満足',
  comment:
    'カウンセリングが丁寧で、思っていた通りの色になりました。\nまたお願いします。',
  imageUrls: ['https://images.example.com/reviews/after.jpg'],
  isVerified: true,
  helpfulCount: 3,
  reportCount: 0,
  ownerResponse:
    'ご来店ありがとうございました。またのお越しをお待ちしております。',
  ownerRespondedAt: '2026-11-19T03:00:00.000Z',
  createdAt: '2026-11-18T09:30:00.000Z',
  updatedAt: '2026-11-18T09:30:00.000Z',
}

/** A review of three without a title, which names no member of the staff, rates some sides only, and was reported */
export const reportedReview: ModelsReviewResponse = {
  ...answeredReview,
  id: '6f2d8b4e-0c3a-4e7f-9b2d-4a8c0e3f5b71',
  customerId: customers[1]?.id ?? '',
  bookingId: '7a3e9c5f-1d4b-4f8a-8c3e-5b9d1f4a6c82',
  staffId: null,
  overallRating: 3,
  serviceRating: 4,
  staffRating: null,
  atmosphereRating: 3,
  cleanlinessRating: null,
  valueRating: null,
  title: null,
  comment: '予約していたのに 30 分待ちました。',
  imageUrls: [],
  helpfulCount: 0,
  reportCount: 1,
  ownerResponse: null,
  ownerRespondedAt: null,
  createdAt: '2026-11-20T05:00:00.000Z',
  updatedAt: '2026-11-20T06:15:00.000Z',
}

/** A review of four by the second member of the staff, without a comment, not answered */
export const unansweredReview: ModelsReviewResponse = {
  ...answeredReview,
  id: '7a3e9c5f-1d4b-4f8a-9c3e-5b9d1f4a6c93',
  bookingId: '8b4f0d6a-2e5c-4a9b-9d4f-6c0e2a5b7d04',
  staffId: ken?.id ?? null,
  overallRating: 4,
  title: 'ヘッドスパが気持ちよかった',
  comment: null,
  helpfulCount: 1,
  ownerResponse: null,
  ownerRespondedAt: null,
  createdAt: '2026-11-19T07:45:00.000Z',
  updatedAt: '2026-11-19T07:45:00.000Z',
}

/** The reviews of the salon, the latest first */
export const REVIEWS_OF_THE_SALON: readonly ModelsReviewResponse[] = [
  reportedReview,
  unansweredReview,
  answeredReview,
]

/** The summary of the three reviews */
export const summaryOfTheSalon: ModelsReviewSummaryResponse = {
  averageRating: 4,
  totalReviews: 3,
  ratingDistribution: { '1': 0, '2': 0, '3': 1, '4': 1, '5': 1 },
}
