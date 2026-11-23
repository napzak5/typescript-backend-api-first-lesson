import { unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import { inventoryHrefOf } from '../../navigation'
import { readValueReport, valueReportKeyOf } from '../api/count-api'
import { ValueReport } from '../components/value-report/value-report'
import { StockForbidden, useKeepsStock } from './keeps-stock'

const { count, names, titles, words } = adminInventoryMessages

/** What the stock of the salon is worth now: read whenever the screen opens, since stock moves all day. */
const ValuePart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const report = useQuery({
    queryKey: valueReportKeyOf(salon.id),
    queryFn: () => readValueReport(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={say(titles.value)} description={salon.name} />
      {match(report.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(count.value.loading)} />
        ))
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what={names.inventoryOfTheSalon} />
        ))
        .with({ type: 'tooManyRequests' }, { type: 'failed' }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.value, reason))}
            onRetry={() => void report.refetch()}
            pending={report.isFetching}
          />
        ))
        .with({ type: 'found' }, ({ report: found }) => (
          <ValueReport report={found} currency={salon.currency} />
        ))
        .exhaustive()}
      <ButtonLink href={inventoryHrefOf(salon.id)}>
        {say(words.toInventory)}
      </ButtonLink>
    </>
  )
}

/** What the stock of the salon of the address is worth, for its owner, a manager and an administrator. */
export const StockValueScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const keeps = useKeepsStock()

  return (
    <WithSalon salonId={salonId} title={say(titles.value)}>
      {(salon) =>
        keeps ? (
          <ValuePart key={salon.id} salon={salon} />
        ) : (
          <StockForbidden
            salon={salon}
            title={titles.value}
            message={count.value.forbidden}
          />
        )
      }
    </WithSalon>
  )
}
