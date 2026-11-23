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
  inJapanese,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
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

export type WithSaleProps = {
  salon: ModelsSalonResponse
  /** The title of the screen */
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
          <LoadingIndicator label='売上を読み込んでいます' />
        </>
      ))
      .with({ type: 'found', sale: { salonId: salon.id } }, ({ sale }) => (
        <>
          <PageHeader title={title} description={salon.name} />
          <p>
            {`売上番号 ${sale.saleNumber}（${inJapanese(momentNameAt(sale.saleTime, salon.timezone))}）`}
          </p>
          {children(sale)}
        </>
      ))
      // A sale of another salon is not one of this salon's
      .with({ type: P.union('found', 'notFound') }, () => (
        <>
          <PageHeader
            title='売上が見つかりません'
            description='アドレスが正しいか、お確かめください。'
          />
          <ButtonLink href={salesHrefOf(salon.id)}>今日の売上へ</ButtonLink>
        </>
      ))
      .with({ type: 'forbidden' }, () => (
        <>
          <PageHeader title={title} description={salon.name} />
          <OtherSalonNotice what={writtenInJapanese('売上')} />
        </>
      ))
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          <PageHeader title={title} description={salon.name} />
          <UnreadNotice
            message={inJapanese(
              unreadMessageOf(writtenInJapanese('売上'), reason),
            )}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .exhaustive()
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
  const methods = useQuery({
    queryKey: paymentMethodsKeyOf(salonId),
    queryFn: () => readPaymentMethods(salonId),
    refetchOnReconnect: false,
  })

  return match(methods.data)
    .with(undefined, () => (
      <LoadingIndicator label='支払い方法を読み込んでいます' />
    ))
    .with({ type: 'found' }, ({ items }) => children(items))
    .with({ type: 'forbidden' }, () => (
      <OtherSalonNotice what={writtenInJapanese('売上')} />
    ))
    .with({ type: P.union(...UNREAD_TYPES, 'notFound') }, (reason) => (
      <UnreadNotice
        message={inJapanese(
          unreadMessageOf(writtenInJapanese('支払い方法'), reason),
        )}
        onRetry={() => void methods.refetch()}
        pending={methods.isFetching}
      />
    ))
    .exhaustive()
}
