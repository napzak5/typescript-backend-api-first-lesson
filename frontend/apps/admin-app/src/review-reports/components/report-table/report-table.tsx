import type { ModelsReviewReportResponse } from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Button,
  countOf,
  Link,
  type More,
  type TableColumn,
} from '@beauty-salon-frontend/ui'
import {
  reasonNameOf,
  reportMomentOf,
  reportStateOf,
} from '../../review-reports'
import styles from './report-table.module.css'

type Report = ModelsReviewReportResponse

export type ReportTableProps = {
  /** What the table lists: 「未処理の通報」, 「このレビューへの通報」 */
  caption: string
  /** The reports that were read so far, the first received first; at least one */
  reports: readonly Report[]
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /**
   * The review of a report, which its row names and leads to. Without it,
   * the table lists the reports of one review, and names none
   */
  reviewOf?: ((reviewId: string) => { name: string; href: string }) | undefined
  /** Asks to dismiss a report that waits. Without it, the table offers no dismissal */
  onDismiss?: ((report: Report) => void) | undefined
  /** How many reports there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the reports that come next */
  onMore: () => void
}

/**
 * Reports of reviews: when each was received at the salon, the review it
 * is of, why, what its account wrote, and whether it waits for the
 * platform or when it was dismissed. A report that waits may be dismissed
 * from the row.
 */
export const ReportTable = ({
  caption,
  reports,
  timezone,
  reviewOf,
  onDismiss,
  total,
  more,
  onMore,
}: ReportTableProps) => {
  const columns: TableColumn<Report>[] = [
    {
      key: 'createdAt',
      header: '受け付けた日時',
      cell: ({ createdAt }) => reportMomentOf(createdAt, timezone),
    },
    ...(reviewOf === undefined
      ? []
      : [
          {
            key: 'reviewId',
            header: 'レビュー',
            cell: ({ reviewId }: Report) => {
              const review = reviewOf(reviewId)

              return <Link href={review.href}>{review.name}</Link>
            },
          },
        ]),
    {
      key: 'reason',
      header: '理由',
      cell: ({ reason }) => reasonNameOf(reason),
    },
    {
      key: 'details',
      header: '詳しい内容',
      wrap: 'lines',
      cell: ({ details }) => details,
    },
    {
      key: 'status',
      header: '状態',
      wrap: 'words',
      cell: (report) => {
        const state = reportStateOf(report, timezone)

        return (
          <span className={styles['state']}>
            <Badge tone={state.waits ? 'danger' : 'neutral'}>
              {state.label}
            </Badge>
            {state.note !== undefined && (
              <span className={styles['note']}>{state.note}</span>
            )}
          </span>
        )
      },
    },
    ...(onDismiss === undefined
      ? []
      : [
          {
            key: 'dismissal',
            header: '却下',
            cell: (report: Report) =>
              reportStateOf(report, timezone).waits ? (
                <Button
                  size='small'
                  aria-label={`${reportMomentOf(report.createdAt, timezone)}に受け付けた通報を却下する`}
                  onClick={() => onDismiss(report)}
                >
                  却下する
                </Button>
              ) : (
                '済み'
              ),
          },
        ]),
  ]

  return (
    <PagedTable
      caption={caption}
      columns={columns}
      rowHeader='createdAt'
      rows={reports}
      rowKey={({ id }) => id}
      emptyMessage='通報はありません'
      count={countOf(total, reports.length, '件')}
      more={more}
      onMore={onMore}
    />
  )
}
