import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { saveFile } from '@beauty-salon-frontend/io'
import {
  type Period,
  periodNameOf,
  periodQueryOf,
  StatisticsPeriod,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Button,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { categorySalesHrefOf, staffSalesHrefOf } from '../navigation'
import { SalesReport } from './components/sales-report/sales-report'
import { ReportRefusal } from './report-refusal'
import { afterReportExport, REPORT_PERIOD } from './sales-report'
import {
  exportSalesReport,
  readSalesReport,
  salesReportKeyOf,
} from './sales-report-api'
import { usePeriodCount } from './use-period-count'

const TITLE = '売上レポート'

/** Why the last export saved nothing, for the period it was asked for */
type ExportSaid = { asked: string; message: string }

/**
 * The sales of the salon over a period, counted: the month up to today at
 * the salon, or the days in the query of the address. The report is read
 * whenever the screen is shown, and what an earlier screen read is not
 * shown meanwhile: a sale is entered at every checkout. A salon whose
 * report the account may not see says so instead of the period.
 */
const ReportPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const [exportSaid, setExportSaid] = useState<ExportSaid>()
  const { notify } = useNotifications()
  const { period, asked, errors, count, read, shown } = usePeriodCount(
    salon,
    (counted) => salesReportKeyOf(salon.id, counted),
    (counted) => readSalesReport(salon.id, counted),
  )

  const exporting = useMutation({
    mutationFn: (exported: Period) => exportSalesReport(salon.id, exported),
    onMutate: () => setExportSaid(undefined),
    onSuccess: (outcome, exported) =>
      match(afterReportExport(outcome, exported))
        .with({ type: 'saved' }, ({ file, message }) => {
          saveFile(file)
          notify({ tone: 'success', message })
        })
        .with({ type: 'refused' }, ({ message }) =>
          setExportSaid({
            asked: periodQueryOf(exported).toString(),
            message,
          }),
        )
        .exhaustive(),
  })

  const header = (exportable: boolean) => (
    <PageHeader
      title={TITLE}
      description={salon.name}
      actions={
        exportable ? (
          <Button
            pending={exporting.isPending}
            onClick={() => exporting.mutate(period)}
          >
            CSV に出力する
          </Button>
        ) : undefined
      }
    />
  )

  return match(shown)
    .with({ type: P.union('forbidden', 'notFound') }, ({ type }) => (
      <>
        {header(false)}
        <ReportRefusal refusal={type} what={TITLE} />
      </>
    ))
    .with(
      P.union(undefined, { type: P.union('found', P.union(...UNREAD_TYPES)) }),
      (counted) => (
        <>
          {header(
            counted?.type === 'found' && counted.report.transactionCount > 0,
          )}
          {exportSaid !== undefined && exportSaid.asked === asked && (
            <Alert tone='danger'>{exportSaid.message}</Alert>
          )}
          <StatisticsPeriod
            period={period}
            description={REPORT_PERIOD}
            errors={errors}
            onSubmit={count}
          />
          <p>{`${periodNameOf(period)}の売上`}</p>
          {match(counted)
            .with(undefined, () => (
              <LoadingIndicator label='売上を集計しています' />
            ))
            .with({ type: 'found', report: { transactionCount: 0 } }, () => (
              <EmptyState
                title='この期間の売上はありません'
                description='期間を変えて集計してください。'
              />
            ))
            .with({ type: 'found' }, ({ report }) => (
              <SalesReport
                report={report}
                currency={salon.currency}
                staffHref={`${staffSalesHrefOf(salon.id)}?${asked}`}
                categoriesHref={`${categorySalesHrefOf(salon.id)}?${asked}`}
              />
            ))
            .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
              <UnreadNotice
                message={unreadMessageOf('売上レポート', reason)}
                onRetry={() => void read.refetch()}
                pending={read.isFetching}
              />
            ))
            .exhaustive()}
        </>
      ),
    )
    .exhaustive()
}

/** The sales report of the salon of the address. */
export const SalesReportScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <ReportPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
