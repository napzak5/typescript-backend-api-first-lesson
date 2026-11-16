import type { ReviewReportStatusType } from '@beauty-salon-backend/generated'
import { match } from 'ts-pattern'

/**
 * From a dismissal of a report and the report as it is where it is
 * written, to whether it is written.
 */

/** What a dismissal of a report meets where it is written. */
export type ReportDismissalContext = {
  /**
   * The report, read once its review is held; null when there is none or
   * the salon of its review is deleted.
   */
  report: { status: ReviewReportStatusType } | null
}

/**
 * A dismissal to write, or why it is not written:
 * - `reportNotFound`: there is no report with the ID, or the salon of its
 *   review is deleted
 * - `dismissedAlready`: the report was dismissed before; who dismissed it
 *   and when stay as they were written
 */
export type ReportDismissalPlan =
  | { type: 'planned' }
  | { type: 'reportNotFound' }
  | { type: 'dismissedAlready' }

/** Whether the report is dismissed: only a pending one is. */
export const planReportDismissal = ({
  report,
}: ReportDismissalContext): ReportDismissalPlan =>
  report === null
    ? { type: 'reportNotFound' }
    : match(report.status)
        .returnType<ReportDismissalPlan>()
        .with('pending', () => ({ type: 'planned' }))
        .with('dismissed', () => ({ type: 'dismissedAlready' }))
        .exhaustive()
