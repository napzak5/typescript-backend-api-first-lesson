import type { ModelsReviewReportResponse } from '@beauty-salon-frontend/api-client'
import { REVIEWS_OF_THE_SALON } from '../../reviews/components/examples'

/*
 * Reports of the reviews of the salon of the examples, as the API answers
 * with them: two that wait, and one the platform dismissed.
 */

const [first, second] = REVIEWS_OF_THE_SALON

/** A report of a customer that waits, with no details */
export const waitingReport: ModelsReviewReportResponse = {
  id: '7a2d4f61-3c8e-4b9a-9d1f-2e6c8b4a7f10',
  reviewId: first?.id ?? '',
  reportedBy: '0b6e1f2a-7c3d-4e5f-8a9b-1c2d3e4f5a60',
  reason: 'false_information',
  details: null,
  status: 'pending',
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-11-20T01:30:00.000Z',
  updatedAt: '2026-11-20T01:30:00.000Z',
}

/** A report of the salon that waits, for a reason of its own, with what is wrong on two lines */
export const reportWithDetails: ModelsReviewReportResponse = {
  id: '8b3e5a72-4d9f-4cab-8e20-3f7d9c5b8a21',
  reviewId: second?.id ?? '',
  reportedBy: '1c7f2a3b-8d4e-4f60-9bac-2d3e4f5a6b71',
  reason: 'other',
  details:
    '来店の記録がない日付のレビューです。\n予約台帳で確かめましたが、該当する予約がありません。',
  status: 'pending',
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-11-20T05:10:00.000Z',
  updatedAt: '2026-11-20T05:10:00.000Z',
}

/** A report the platform dismissed */
export const dismissedReport: ModelsReviewReportResponse = {
  id: '9c4f6b83-5eaf-4dbc-9f31-4a8e0d6c9b32',
  reviewId: first?.id ?? '',
  reportedBy: '2d8a3b4c-9e5f-4071-8bcd-3e4f5a6b7c82',
  reason: 'spam',
  details: null,
  status: 'dismissed',
  resolvedBy: '3e9b4c5d-af60-4182-9cde-4f5a6b7c8d93',
  resolvedAt: '2026-11-21T00:15:00.000Z',
  createdAt: '2026-11-19T23:45:00.000Z',
  updatedAt: '2026-11-21T00:15:00.000Z',
}

/** The reports of the examples, the first received first */
export const REPORTS: readonly ModelsReviewReportResponse[] = [
  dismissedReport,
  waitingReport,
  reportWithDetails,
]
