import type {
  ModelsCustomerResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { unreadMessageOf } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { customersHrefOf } from '../navigation'
import {
  customerKanaOf,
  customerKeyOf,
  customerNameOf,
  readCustomer,
} from './customers-api'

export type WithCustomerProps = {
  salon: ModelsSalonResponse
  /** The title of the screen */
  title: string
  /**
   * Whether the screen shows the customer only once they were read anew:
   * a screen that writes them does, so that what it writes on is what the
   * ledger holds now. A screen that shows them shows what was read before
   * at once, and what is read anew when it comes.
   */
  fresh: boolean
  /** The screen, below its heading, for the customer of the address that was read */
  children: (customer: ModelsCustomerResponse) => ReactNode
  /**
   * The screen for a customer the ledger does not show: one who was
   * removed may still be shown from their history. `undefined` for a
   * screen that shows them as not found
   */
  removed?: ((customerId: string) => ReactNode) | undefined
}

type CustomerNotFoundProps = {
  salon: ModelsSalonResponse
  /** The account is shown the customers who were removed: none was, with the ID */
  removedShown?: boolean | undefined
}

/** What a screen of a customer says when there is none to show. */
export const CustomerNotFound = ({
  salon,
  removedShown = false,
}: CustomerNotFoundProps) => (
  <>
    <PageHeader
      title='お客様が見つかりません'
      description={
        removedShown
          ? 'アドレスが正しいか、お確かめください。'
          : 'アドレスが正しいか、お確かめください。台帳から削除されたお客様は、表示できません。'
      }
    />
    <p>
      <ButtonLink href={customersHrefOf(salon.id)}>顧客台帳へ</ButtonLink>
    </p>
  </>
)

/** The name of a customer, with its kana when there is one: 「山田 花子（ヤマダ ハナコ）」. */
export const fullNameOf = (
  customer: Pick<
    ModelsCustomerResponse,
    'firstName' | 'lastName' | 'firstNameKana' | 'lastNameKana'
  >,
): string => {
  const kana = customerKanaOf(customer)

  return kana === ''
    ? customerNameOf(customer)
    : `${customerNameOf(customer)}（${kana}）`
}

/**
 * A screen of a customer of the ledger, below the salon of the address.
 * The customer is read whenever the screen opens. A customer who was
 * removed from the ledger is not found, as one who never was, unless the
 * screen shows such a customer otherwise (`removed`).
 *
 * Below the heading, the customer is named as soon as they are read.
 */
export const WithCustomer = ({
  salon,
  title,
  fresh,
  children,
  removed,
}: WithCustomerProps) => {
  const { customerId = '' } = useParams()
  const read = useQuery({
    queryKey: customerKeyOf(customerId),
    queryFn: () => readCustomer(customerId),
    // Customers are written at every salon: what is shown is read whenever the screen opens
    staleTime: 0,
    refetchOnReconnect: !fresh,
  })
  const shown = !fresh || read.isFetchedAfterMount ? read.data : undefined

  return match(shown)
    .with(undefined, () => (
      <>
        <PageHeader title={title} description={salon.name} />
        <LoadingIndicator label='お客様を読み込んでいます' />
      </>
    ))
    .with({ type: 'found' }, ({ customer }) => (
      <>
        <PageHeader title={title} description={salon.name} />
        <p>{`${fullNameOf(customer)} 様`}</p>
        {children(customer)}
      </>
    ))
    .with({ type: 'notFound' }, () =>
      removed === undefined ? (
        <CustomerNotFound salon={salon} />
      ) : (
        removed(customerId)
      ),
    )
    .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
      <>
        <PageHeader title={title} description={salon.name} />
        <UnreadNotice
          message={unreadMessageOf('お客様', reason)}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}
