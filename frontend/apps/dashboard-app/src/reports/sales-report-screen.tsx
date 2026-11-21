import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { saveFile } from '@beauty-salon-frontend/io'
import {
  dayAt,
  monthUntil,
  type Period,
  periodIn,
  periodNameOf,
  periodQueryOf,
  readPeriod,
  StatisticsPeriod,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Button,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { SalesReport } from './components/sales-report/sales-report'
import { ReportRefusal } from './report-refusal'
import { afterReportExport, REPORT_PERIOD } from './sales-report'
import {
  exportSalesReport,
  readSalesReport,
  salesReportKeyOf,
} from './sales-report-api'

const TITLE = '売上レポート'

const UNREAD = P.union('tooManyRequests', 'failed')

/** Why the last export saved nothing, for the period it was asked for */
type ExportSaid = { asked: string; message: string }

/** What was wrong with the form, and the days the address showed when it was sent */
type Refused = { asked: string; errors: FormErrors }

/**
 * The sales of the salon over a period, counted: the month up to today at
 * the salon, or the days in the query of the address. The report is read
 * whenever the screen is shown, and what an earlier screen read is not
 * shown meanwhile: a sale is entered at every checkout. A salon whose
 * report the account may not see says so instead of the period.
 */
const ReportPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const [query, setQuery] = useSearchParams()
  // What was wrong with what was sent, while the address shows the days it was sent from
  const [refused, setRefused] = useState<Refused>()
  const [exportSaid, setExportSaid] = useState<ExportSaid>()
  const { notify } = useNotifications()
  const period = periodIn(query, monthUntil(dayAt(new Date(), salon.timezone)))
  const asked = periodQueryOf(period).toString()
  const errors = refused?.asked === asked ? refused.errors : undefined
  const read = useQuery({
    queryKey: salesReportKeyOf(salon.id, period),
    queryFn: () => readSalesReport(salon.id, period),
    staleTime: 0,
  })
  const shown = read.isFetchedAfterMount ? read.data : undefined

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

  const count = (values: FormData): void => {
    const filled = readPeriod(values)
    if (filled.type === 'invalid') {
      setRefused({ asked, errors: filled.errors })
      return
    }
    setRefused(undefined)
    if (periodQueryOf(filled.request).toString() === asked) {
      // The same days again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(periodQueryOf(filled.request), { replace: true })
  }

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
    .with(P.union(undefined, { type: P.union('found', UNREAD) }), (counted) => (
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
            <SalesReport report={report} currency={salon.currency} />
          ))
          .with({ type: UNREAD }, (reason) => (
            <UnreadNotice
              message={unreadMessageOf('売上レポート', reason)}
              onRetry={() => void read.refetch()}
              retrying={read.isFetching}
            />
          ))
          .exhaustive()}
      </>
    ))
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
