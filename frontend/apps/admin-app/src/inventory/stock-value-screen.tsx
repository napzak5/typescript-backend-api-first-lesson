import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import { inventoryHrefOf } from '../navigation'
import { unreadMessageOf } from '../reading'
import { OtherSalonNotice, WithSalon } from '../salons/with-salon'
import { ValueReport } from './components/value-report/value-report'
import { readValueReport, valueReportKeyOf } from './count-api'
import { StockForbidden, useKeepsStock } from './keeps-stock'

const TITLE = '在庫評価額'

/** What the stock of the salon is worth now: read whenever the screen opens, since stock moves all day. */
const ValuePart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const report = useQuery({
    queryKey: valueReportKeyOf(salon.id),
    queryFn: () => readValueReport(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {match(report.data)
        .with(undefined, () => (
          <LoadingIndicator label='在庫評価額を読み込んでいます' />
        ))
        .with({ type: 'forbidden' }, () => <OtherSalonNotice what='在庫' />)
        .with({ type: 'tooManyRequests' }, { type: 'failed' }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('在庫評価額', reason)}
            onRetry={() => void report.refetch()}
            retrying={report.isFetching}
          />
        ))
        .with({ type: 'found' }, ({ report: found }) => (
          <ValueReport report={found} currency={salon.currency} />
        ))
        .exhaustive()}
      <p>
        <ButtonLink href={inventoryHrefOf(salon.id)} variant='secondary'>
          在庫へ
        </ButtonLink>
      </p>
    </>
  )
}

/** What the stock of the salon of the address is worth, for its owner, a manager and an administrator. */
export const StockValueScreen = () => {
  const { salonId = '' } = useParams()
  const keeps = useKeepsStock()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <ValuePart key={salon.id} salon={salon} />
        ) : (
          <StockForbidden
            salon={salon}
            title={TITLE}
            message='このアカウントでは、在庫評価額を見られません。在庫評価額を見られるのは、サロンのオーナーとマネージャーと、管理者です。'
          />
        )
      }
    </WithSalon>
  )
}
