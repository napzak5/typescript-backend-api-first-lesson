import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerVersionResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import {
  type Removal,
  readRemoved,
  removedKeyOf,
} from '../api/customer-history-api'
import { customerKeyOf } from '../api/customers-api'
import { mayKeepCustomers } from '../utils/customer-history'
import { CustomerNotFound, honoredNameOf } from './with-customer'

const { names, customer: words, removed: removedWords } = adminCustomerMessages

export type RemovedCustomerProps = {
  salon: ModelsSalonResponse
  customerId: string
  /** The title of the screen, said in the language of the page */
  title: string
  /** The screen, below its heading, for the customer as their latest version keeps them */
  children: (removed: {
    version: ModelsCustomerVersionResponse
    removal: Removal
  }) => ReactNode
}

/**
 * A screen of a customer the ledger does not show. Their history is kept
 * when they were removed, and an owner or a manager reads it: its latest
 * version holds their values and how they left. Anybody else, and anybody
 * for a customer that never was, is told that there is no such customer.
 */
export const RemovedCustomer = ({
  salon,
  customerId,
  title,
  children,
}: RemovedCustomerProps) => {
  const say = useSay()
  const session = useSession()
  const keeper =
    session.type === 'signedIn' && mayKeepCustomers(session.user.role)
  const queryClient = useQueryClient()
  const read = useQuery({
    queryKey: removedKeyOf(customerId),
    queryFn: () => readRemoved(customerId),
    enabled: keeper,
    // A customer comes back from any salon: what is shown is read whenever the screen opens
    staleTime: 0,
  })
  if (!keeper) {
    return <CustomerNotFound salon={salon} />
  }
  const header = <PageHeader title={title} description={salon.name} />

  return (
    match(read.data)
      .with(undefined, () => (
        <>
          {header}
          <LoadingIndicator label={say(words.loading)} />
        </>
      ))
      .with({ type: 'removed' }, (removed) => (
        <>
          {header}
          <p>{say(honoredNameOf(removed.version))}</p>
          {children(removed)}
        </>
      ))
      // No customer had the ID; or the account may not read histories any more
      .with({ type: 'notFound' }, () => (
        <CustomerNotFound salon={salon} removedShown />
      ))
      .with({ type: 'forbidden' }, () => <CustomerNotFound salon={salon} />)
      .with({ type: 'present' }, () => (
        <>
          {header}
          <UnreadNotice
            message={say(removedWords.restoredMeanwhile)}
            onRetry={() =>
              void queryClient.invalidateQueries({
                queryKey: customerKeyOf(customerId),
                exact: true,
              })
            }
            pending={false}
          />
        </>
      ))
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          {header}
          <UnreadNotice
            message={say(unreadMessageOf(names.customer, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .exhaustive()
  )
}
