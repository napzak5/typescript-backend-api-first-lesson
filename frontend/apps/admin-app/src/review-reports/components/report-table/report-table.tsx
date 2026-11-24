import type { ModelsReviewReportResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Button,
  COUNTED,
  countOf,
  Link,
  type More,
  type TableColumn,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminReviewMessages,
  adminReviewReportMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { reasonNameOf, reportStateOf } from '../../utils/review-reports'
import styles from './report-table.module.css'

const { table } = adminReviewReportMessages

type Report = ModelsReviewReportResponse

export type ReportTableProps = {
  /** What the table lists, in the language of the page: 「未処理の通報」, 「このレビューへの通報」 */
  caption: string
  /** The reports that were read so far, the first received first; at least one */
  reports: readonly Report[]
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /**
   * The review of a report, which its row names and leads to. Without it,
   * the table lists the reports of one review, and names none
   */
  reviewOf?:
    | ((reviewId: string) => { name: LocalizedText; href: string })
    | undefined
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
  const say = useSay()
  const columns: TableColumn<Report>[] = [
    {
      key: 'createdAt',
      header: say(table.receivedAt),
      cell: ({ createdAt }) => say(momentNameAt(createdAt, timezone)),
    },
    ...(reviewOf === undefined
      ? []
      : [
          {
            key: 'reviewId',
            header: say(adminReviewMessages.words.review),
            cell: ({ reviewId }: Report) => {
              const review = reviewOf(reviewId)

              return <Link href={review.href}>{say(review.name)}</Link>
            },
          },
        ]),
    {
      key: 'reason',
      header: say(table.reason),
      cell: ({ reason }) => say(reasonNameOf(reason)),
    },
    {
      key: 'details',
      header: say(reviewMessages.report.details),
      wrap: 'lines',
      cell: ({ details }) => details,
    },
    {
      key: 'status',
      header: say(table.status),
      wrap: 'words',
      cell: (report) => {
        const state = reportStateOf(report, timezone)

        return (
          <span className={styles['state']}>
            <Badge tone={state.waits ? 'danger' : 'neutral'}>
              {say(state.label)}
            </Badge>
            {state.note !== undefined && (
              <span className={styles['note']}>{say(state.note)}</span>
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
            header: say(table.dismissal),
            cell: (report: Report) =>
              reportStateOf(report, timezone).waits ? (
                <Button
                  size='small'
                  aria-label={say(
                    table.dismissOf(momentNameAt(report.createdAt, timezone)),
                  )}
                  onClick={() => onDismiss(report)}
                >
                  {say(table.dismiss)}
                </Button>
              ) : (
                say(table.done)
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
      emptyMessage={say(table.none)}
      count={say(countOf(total, reports.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
