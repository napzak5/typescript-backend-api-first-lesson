import { unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsBookingResponse } from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  ButtonLink,
  Card,
  DescriptionList,
  EmptyState,
  Link,
  LoadingIndicator,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { match, P } from 'ts-pattern'
import { saleOfBooking, whyNoCheckout } from '../../checkout'
import { paymentStatusNameOf, paymentStatusToneOf } from '../../sale-format'
import type { SalesOfBooking } from '../../sales-api'

export type BookingSaleProps = {
  booking: Pick<ModelsBookingResponse, 'status'>
  /** The sales of the booking; `undefined` while they are on their way */
  sales: SalesOfBooking | undefined
  /** The currency of the salon */
  currency: string
  /** The address of the page of a sale */
  saleHref: (saleId: string) => string
  /** The address of the checkout of the booking */
  checkoutHref: string
  /** Asks for the sales again */
  onRetry: () => void
  retrying: boolean
}

/**
 * The part 「会計」 of the page of a booking: the sale that bills it, with
 * what it comes to and how far it was paid, or the way to its checkout
 * once the visit took place. A sale that was voided bills it no more.
 */
export const BookingSale = ({
  booking,
  sales,
  currency,
  saleHref,
  checkoutHref,
  onRetry,
  retrying,
}: BookingSaleProps) => (
  <Card title='会計'>
    {match(sales)
      .with(undefined, () => (
        <LoadingIndicator label='会計を読み込んでいます' />
      ))
      .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
        <UnreadNotice
          message={unreadMessageOf('会計', reason)}
          onRetry={onRetry}
          pending={retrying}
        />
      ))
      .with({ type: 'forbidden' }, () => (
        <p>この予約の会計は、見られません。</p>
      ))
      .with({ type: 'found' }, ({ sales: found }) => {
        const sale = saleOfBooking(found)
        if (sale !== undefined) {
          return (
            <DescriptionList
              items={[
                {
                  term: '売上番号',
                  description: (
                    <Link href={saleHref(sale.id)}>{sale.saleNumber}</Link>
                  ),
                },
                {
                  term: '合計',
                  description: amountOf(sale.totalAmount, currency),
                },
                {
                  term: '支払い',
                  description: (
                    <Badge tone={paymentStatusToneOf(sale.paymentStatus)}>
                      {paymentStatusNameOf(sale.paymentStatus)}
                    </Badge>
                  ),
                },
              ]}
            />
          )
        }

        const why = whyNoCheckout(booking)

        return why === undefined ? (
          <EmptyState
            kind='part'
            title='まだ会計を入れていません。'
            actions={
              <ButtonLink href={checkoutHref} variant='primary'>
                会計を入れる
              </ButtonLink>
            }
          />
        ) : (
          <p>{why}</p>
        )
      })
      .exhaustive()}
  </Card>
)
