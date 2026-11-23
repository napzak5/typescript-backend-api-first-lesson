import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
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
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match, P } from 'ts-pattern'
import type { SalesOfBooking } from '../../api/sales-api'
import { saleOfBooking, whyNoCheckout } from '../../utils/checkout'
import {
  paymentStatusNameOf,
  paymentStatusToneOf,
} from '../../utils/sale-format'

const { loading, names, ofBooking, titles, words } = adminSaleMessages

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
}: BookingSaleProps) => {
  const say = useSay()

  return (
    <Card title={say(ofBooking.title)}>
      {match(sales)
        .with(undefined, () => (
          <LoadingIndicator label={say(loading.checkout)} />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.checkout, reason))}
            onRetry={onRetry}
            pending={retrying}
          />
        ))
        .with({ type: 'forbidden' }, () => <p>{say(ofBooking.forbidden)}</p>)
        .with({ type: 'found' }, ({ sales: found }) => {
          const sale = saleOfBooking(found)
          if (sale !== undefined) {
            return (
              <DescriptionList
                items={[
                  {
                    term: say(words.saleNumber),
                    description: (
                      <Link href={saleHref(sale.id)}>{sale.saleNumber}</Link>
                    ),
                  },
                  {
                    term: say(words.total),
                    description: say(amountOf(sale.totalAmount, currency)),
                  },
                  {
                    term: say(words.payment),
                    description: (
                      <Badge tone={paymentStatusToneOf(sale.paymentStatus)}>
                        {say(paymentStatusNameOf(sale.paymentStatus))}
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
              title={say(ofBooking.notYet)}
              actions={
                <ButtonLink href={checkoutHref} variant='primary'>
                  {say(titles.checkout)}
                </ButtonLink>
              }
            />
          ) : (
            <p>{say(why)}</p>
          )
        })
        .exhaustive()}
    </Card>
  )
}
