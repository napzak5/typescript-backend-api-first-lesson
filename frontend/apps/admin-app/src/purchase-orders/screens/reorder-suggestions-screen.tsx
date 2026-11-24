import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { purchaseOrdersHrefOf, suggestedOrderHrefOf } from '../../navigation'
import {
  readEverySuggestion,
  suggestionsKeyOf,
} from '../api/purchase-orders-api'
import { ReorderSuggestions } from '../components/reorder-suggestions/reorder-suggestions'
import { suggestionGroupsOf } from '../utils/order-suggestions'
import { ToTheOrders } from './order-not-found'

const {
  loading,
  names,
  suggestions: WORDS,
  titles,
  words,
} = adminPurchaseOrderMessages

/**
 * The products a salon had better order, read whenever the screen opens,
 * by supplier, each supplier leading to a new order that starts with its
 * suggestions.
 */
const SuggestionsPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const read = useQuery({
    queryKey: suggestionsKeyOf(salon.id),
    queryFn: () => readEverySuggestion(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={say(titles.suggestions)} description={salon.name} />
      <p>{say(WORDS.description)}</p>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(loading.suggestions)} />
        ))
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what={names.suggestionsOfTheSalon} />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.suggestions, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'found', items: [] }, () => (
          <EmptyState
            title={say(WORDS.none)}
            description={say(WORDS.noneDescription)}
            actions={
              <ButtonLink href={purchaseOrdersHrefOf(salon.id)}>
                {say(words.toOrders)}
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
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.suggestions)}>
      {(salon) => <SuggestionsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
