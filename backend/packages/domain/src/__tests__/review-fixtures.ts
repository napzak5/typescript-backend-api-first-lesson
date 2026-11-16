import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type {
  HeldReview,
  ReviewedBooking,
  ReviewUseCaseDependencies,
} from '../business-logic/review'
import type { ReviewReportUseCaseDependencies } from '../business-logic/review-report'
import type {
  ApiReviewCreateRequest,
  ApiReviewResponse,
  DbReview,
  ReviewTally,
} from '../models/review'
import type {
  ApiReviewReportResponse,
  DbReviewReport,
} from '../models/review-report'
import type {
  IReviewRepository,
  ReviewChange,
  ReviewCreation,
  ReviewList,
  ReviewMark,
  ReviewRemoval,
  ReviewReporting,
  ReviewResponding,
} from '../repositories/review.repository'
import type {
  IReviewReportRepository,
  ReportDismissal,
  ReviewReportList,
} from '../repositories/review-report.repository'
import { CUSTOMER_ID, USER_ID } from './auth-fixtures'
import { BOOKING_ID } from './booking-fixtures'
import { SALON_ID } from './fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

export const REVIEW_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5a01'
export const OTHER_REVIEW_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5a02'
export const REVIEW_REPORT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5b01'
export const OTHER_REVIEW_REPORT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5b02'
export const OWNER_RESPONSE =
  'ご来店ありがとうございました。またのお越しをお待ちしております。'

const IMAGE_URL = 'https://images.example.com/reviews/after.jpg'

/** A review that satisfies every rule: four stars, for the staff member too. */
export const reviewCreateRequest = (
  overrides: Partial<ApiReviewCreateRequest> = {},
): ApiReviewCreateRequest => ({
  salonId: SALON_ID,
  customerId: CUSTOMER_ID,
  bookingId: BOOKING_ID,
  staffId: STAFF_MEMBER_ID,
  overallRating: 4,
  serviceRating: 5,
  staffRating: 5,
  atmosphereRating: 4,
  cleanlinessRating: null,
  valueRating: 3,
  title: '丁寧なカット',
  comment: '仕上がりに満足しています。',
  imageUrls: [IMAGE_URL],
  ...overrides,
})

/** The review above as it is stored. */
export const dbReview = (overrides: Partial<DbReview> = {}): DbReview => ({
  id: REVIEW_ID,
  salonId: SALON_ID,
  customerId: CUSTOMER_ID,
  bookingId: BOOKING_ID,
  staffId: STAFF_MEMBER_ID,
  overallRating: 4,
  serviceRating: 5,
  staffRating: 5,
  atmosphereRating: 4,
  cleanlinessRating: null,
  valueRating: 3,
  title: '丁寧なカット',
  comment: '仕上がりに満足しています。',
  imageUrls: [IMAGE_URL],
  isVerified: true,
  helpfulCount: 0,
  reportCount: 0,
  ownerResponse: null,
  ownerRespondedAt: null,
  createdAt: '2026-11-20 12:00:00.123456+09',
  updatedAt: '2026-11-20 12:00:00.123456+09',
  ...overrides,
})

/** The review above as the API presents it. */
export const apiReview = (
  overrides: Partial<ApiReviewResponse> = {},
): ApiReviewResponse => ({
  id: REVIEW_ID,
  salonId: SALON_ID,
  customerId: CUSTOMER_ID,
  bookingId: BOOKING_ID,
  staffId: STAFF_MEMBER_ID,
  overallRating: 4,
  serviceRating: 5,
  staffRating: 5,
  atmosphereRating: 4,
  cleanlinessRating: null,
  valueRating: 3,
  title: '丁寧なカット',
  comment: '仕上がりに満足しています。',
  imageUrls: [IMAGE_URL],
  isVerified: true,
  helpfulCount: 0,
  reportCount: 0,
  ownerResponse: null,
  ownerRespondedAt: null,
  createdAt: '2026-11-20T03:00:00.123Z',
  updatedAt: '2026-11-20T03:00:00.123Z',
  ...overrides,
})

/** The booking of the review above: completed, of the customer, not reviewed. */
export const reviewedBooking = (
  overrides: Partial<ReviewedBooking> = {},
): ReviewedBooking => ({
  customerId: CUSTOMER_ID,
  salonId: SALON_ID,
  salonDeleted: false,
  status: 'completed',
  staffIds: [STAFF_MEMBER_ID],
  reviewed: false,
  ...overrides,
})

/** The review above as a change or a removal finds it, held. */
export const heldReview = (
  overrides: Partial<HeldReview> = {},
): HeldReview => ({
  customerId: CUSTOMER_ID,
  staffId: STAFF_MEMBER_ID,
  ...overrides,
})

/** A pending report of the review above, by the account of the actors. */
export const dbReviewReport = (
  overrides: Partial<DbReviewReport> = {},
): DbReviewReport => ({
  id: REVIEW_REPORT_ID,
  reviewId: REVIEW_ID,
  reportedBy: USER_ID,
  reason: 'false_information',
  details: '来店していない日の施術が書かれています。',
  status: 'pending',
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-11-21 10:00:00.5+09',
  updatedAt: '2026-11-21 10:00:00.5+09',
  ...overrides,
})

/** The report above as the API presents it. */
export const apiReviewReport = (
  overrides: Partial<ApiReviewReportResponse> = {},
): ApiReviewReportResponse => ({
  id: REVIEW_REPORT_ID,
  reviewId: REVIEW_ID,
  reportedBy: USER_ID,
  reason: 'false_information',
  details: '来店していない日の施術が書かれています。',
  status: 'pending',
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-11-21T01:00:00.500Z',
  updatedAt: '2026-11-21T01:00:00.500Z',
  ...overrides,
})

/** The report above, dismissed by the account of the actors. */
const dismissedReviewReport = (): DbReviewReport =>
  dbReviewReport({
    status: 'dismissed',
    resolvedBy: USER_ID,
    resolvedAt: '2026-11-22 09:30:00+09',
    updatedAt: '2026-11-22 09:30:00+09',
  })

/** Three reviews of 5, 4 and 4 stars. */
export const reviewTally = (
  overrides: Partial<ReviewTally> = {},
): ReviewTally => ({
  averageRating: '4.33',
  totalReviews: 3,
  ratingCounts: [0, 0, 0, 2, 1],
  ...overrides,
})

/**
 * Everything the review use cases need: a repository that lists, finds,
 * creates, updates, deletes, marks, reports and responds to the review of
 * the fixtures (three customers found it helpful; the salon responded),
 * and tallies three reviews for a salon and for a staff member; a test
 * overrides what it needs.
 */
export const reviewDependencies = (
  overrides: Partial<IReviewRepository> = {},
): ReviewUseCaseDependencies => ({
  reviewRepository: {
    list: vi.fn(async () =>
      Result.success<ReviewList | null>({
        reviews: [dbReview()],
        total: 1,
        hasMore: false,
      }),
    ),
    findById: vi.fn(async () => Result.success<DbReview | null>(dbReview())),
    create: vi.fn(async () =>
      Result.success<ReviewCreation>({ type: 'created', review: dbReview() }),
    ),
    update: vi.fn(async () =>
      Result.success<ReviewChange>({ type: 'updated', review: dbReview() }),
    ),
    delete: vi.fn(async () =>
      Result.success<ReviewRemoval>({ type: 'deleted' }),
    ),
    markHelpful: vi.fn(async () =>
      Result.success<ReviewMark>({ type: 'marked', helpfulCount: 3 }),
    ),
    report: vi.fn(async () =>
      Result.success<ReviewReporting>({
        type: 'reported',
        report: dbReviewReport(),
      }),
    ),
    respond: vi.fn(async () =>
      Result.success<ReviewResponding>({
        type: 'responded',
        review: dbReview({
          ownerResponse: OWNER_RESPONSE,
          ownerRespondedAt: '2026-11-21 10:00:00.5+09',
        }),
      }),
    ),
    salonTally: vi.fn(async () =>
      Result.success<ReviewTally | null>(reviewTally()),
    ),
    staffTally: vi.fn(async () =>
      Result.success<ReviewTally | null>(reviewTally()),
    ),
    ...overrides,
  },
})

/**
 * Everything the use cases of the reports need: a repository that lists
 * the report of the fixtures and dismisses it; a test overrides what it
 * needs.
 */
export const reviewReportDependencies = (
  overrides: Partial<IReviewReportRepository> = {},
): ReviewReportUseCaseDependencies => ({
  reviewReportRepository: {
    list: vi.fn(async () =>
      Result.success<ReviewReportList | null>({
        reports: [dbReviewReport()],
        total: 1,
        hasMore: false,
      }),
    ),
    dismiss: vi.fn(async () =>
      Result.success<ReportDismissal>({
        type: 'dismissed',
        report: dismissedReviewReport(),
      }),
    ),
    ...overrides,
  },
})
