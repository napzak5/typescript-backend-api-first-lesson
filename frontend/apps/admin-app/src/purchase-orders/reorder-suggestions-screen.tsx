import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { purchaseOrdersHrefOf, suggestedOrderHrefOf } from '../navigation'
import { ReorderSuggestions } from './components/reorder-suggestions/reorder-suggestions'
import { ToTheOrders } from './order-not-found'
import { suggestionGroupsOf } from './order-suggestions'
import { readEverySuggestion, suggestionsKeyOf } from './purchase-orders-api'

const TITLE = '発注の提案'

/**
 * The products a salon had better order, read whenever the screen opens,
 * by supplier, each supplier leading to a new order that starts with its
 * suggestions.
 */
const SuggestionsPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const read = useQuery({
    queryKey: suggestionsKeyOf(salon.id),
    queryFn: () => readEverySuggestion(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      <p>
        在庫と発注中の数の和が、発注点以下になった商品です。提案する数量は、最大在庫数（ない商品は発注点）まで補う数です。発注中の数には、下書きと承認待ちの発注も入ります。
      </p>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='発注の提案を読み込んでいます' />
        ))
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what='発注の提案' />
        ))
        .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('発注の提案', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'found', items: [] }, () => (
          <EmptyState
            title='発注の提案はありません'
            description='在庫と発注中の数の和が、発注点以下になった商品はありません。'
            actions={
              <ButtonLink href={purchaseOrdersHrefOf(salon.id)}>
                発注へ
              </ButtonLink>
            }
          />
        ))
        .with({ type: 'found' }, ({ items }) => (
          <>
            <ReorderSuggestions
              groups={suggestionGroupsOf(items)}
              timezone={salon.timezone}
              entryHrefOf={(supplier) =>
                suggestedOrderHrefOf(salon.id, supplier)
              }
            />
            <ToTheOrders salonId={salon.id} />
          </>
        ))
        .exhaustive()}
    </>
  )
}

/** The reorder suggestions of the salon of the address, for every member of its staff and an administrator. */
export const ReorderSuggestionsScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <SuggestionsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
