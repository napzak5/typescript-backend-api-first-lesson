import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentMethodResponse,
  ModelsSaleResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  momentNameAt,
  OtherSalonNotice,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { salesHrefOf } from '../../navigation'
import {
  paymentMethodsKeyOf,
  readPaymentMethods,
  readSale,
  saleKeyOf,
} from '../api/sales-api'

const { loading, names, notFound, words } = adminSaleMessages

export type WithSaleProps = {
  salon: ModelsSalonResponse
  /** The title of the screen, in the language of the page */
  title: string
  /**
   * Whether the screen shows the sale only once it was read anew: a screen
   * that writes it does, so that what it writes on is what the ledger
   * holds now. A screen that shows it shows what was read before at once,
   * and what is read anew when it comes.
   */
  fresh: boolean
  /** The screen, below its heading, for the sale of the address that was read */
  children: (sale: ModelsSaleResponse) => ReactNode
}

/**
 * A screen of a sale of the salon of the address. The sale is read
 * whenever the screen opens; a sale of another salon is not found under
 * the address of this one, as a booking is not.
 *
 * Below the heading, the sale is named by its number and its time, as soon
 * as it is read: what the screen shows of it besides may need more.
 */
export const WithSale = ({ salon, title, fresh, children }: WithSaleProps) => {
  const say = useSay()
  const { saleId = '' } = useParams()
  const read = useQuery({
    queryKey: saleKeyOf(saleId),
    queryFn: () => readSale(saleId),
    // A sale is paid at the counter: what is shown is read whenever the screen opens
    staleTime: 0,
    refetchOnReconnect: !fresh,
  })
  const shown = !fresh || read.isFetchedAfterMount ? read.data : undefined

  return (
    match(shown)
      .with(undefined, () => (
        <>
          <PageHeader title={title} description={salon.name} />
          <LoadingIndicator label={say(loading.sale)} />
        </>
      ))
      .with({ type: 'found', sale: { salonId: salon.id } }, ({ sale }) => (
        <>
          <PageHeader title={title} description={salon.name} />
          <p>
            {say(
              adminSaleMessages.saleOf(
                sale.saleNumber,
                momentNameAt(sale.saleTime, salon.timezone),
              ),
            )}
          </p>
          {children(sale)}
        </>
      ))
      // A sale of another salon is not one of this salon's
      .with({ type: P.union('found', 'notFound') }, () => (
        <>
          <PageHeader
            title={say(notFound.title)}
            description={say(notFound.description)}
          />
          <ButtonLink href={salesHrefOf(salon.id)}>
            {say(notFound.toToday)}
          </ButtonLink>
        </>
      ))
      .with({ type: 'forbidden' }, () => (
        <>
          <PageHeader title={title} description={salon.name} />
          <OtherSalonNotice what={names.salesOfTheSalon} />
        </>
      ))
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          <PageHeader title={title} description={salon.name} />
          <UnreadNotice
            message={say(unreadMessageOf(names.sale, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .exhaustive()
  )
}

/**
 * What a screen that writes a sale says when the sale takes nothing of it
 * now, or not from this account: why, and the way back to the sale.
 */
export const Unwritable = ({
  why,
  back,
}: {
  why: LocalizedText
  back: string
}) => {
  const say = useSay()

  return (
    <>
      <p>{say(why)}</p>
      <ButtonLink href={back}>{say(words.toSale)}</ButtonLink>
    </>
  )
}

export type WithPaymentMethodsProps = {
  salonId: string
  /** The part of a screen that names and offers them */
  children: (methods: readonly ModelsPaymentMethodResponse[]) => ReactNode
}

/**
 * The part of a screen that names the payment methods of the salon, or
 * offers them: shown once they were read. They change seldom, and are not
 * read behind a form that is filled in.
 */
export const WithPaymentMethods = ({
  salonId,
  children,
}: WithPaymentMethodsProps) => {
  const say = useSay()
  const methods = useQuery({
    queryKey: paymentMethodsKeyOf(salonId),
    queryFn: () => readPaymentMethods(salonId),
    refetchOnReconnect: false,
  })

  return match(methods.data)
    .with(undefined, () => <LoadingIndicator label={say(loading.methods)} />)
    .with({ type: 'found' }, ({ items }) => children(items))
    .with({ type: 'forbidden' }, () => (
      <OtherSalonNotice what={names.salesOfTheSalon} />
    ))
    .with({ type: P.union(...UNREAD_TYPES, 'notFound') }, (reason) => (
      <UnreadNotice
        message={say(unreadMessageOf(names.methods, reason))}
        onRetry={() => void methods.refetch()}
        pending={methods.isFetching}
      />
    ))
    .exhaustive()
}
