import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerVersionResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  inJapanese,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
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
import { CustomerNotFound, fullNameOf } from './with-customer'

export type RemovedCustomerProps = {
  salon: ModelsSalonResponse
  customerId: string
  /** The title of the screen */
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
          <LoadingIndicator label='お客様を読み込んでいます' />
        </>
      ))
      .with({ type: 'removed' }, (removed) => (
        <>
          {header}
          <p>{`${fullNameOf(removed.version)} 様`}</p>
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
            message='このお客様は、その間に台帳に戻されました。読み込み直してください。'
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
            message={inJapanese(
              unreadMessageOf(writtenInJapanese('お客様'), reason),
            )}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .exhaustive()
  )
}
