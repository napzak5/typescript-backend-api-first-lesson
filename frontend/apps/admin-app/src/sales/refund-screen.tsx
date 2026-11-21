import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentRefundRequest,
  ModelsPaymentResponse,
  ModelsSaleResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { NOT_FOUND, WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { saleHrefOf } from '../navigation'
import { RefundForm } from './components/refund-form/refund-form'
import { afterRefund, readRefund, voidableAfter, whyNoRefund } from './refunds'
import { mayUndoSales, UNDONE_BY_OTHERS } from './sale-changes'
import {
  attemptRefund,
  type SaleRead,
  saleKeyOf,
  saleListsKeyOf,
  salesOfBookingKeyOf,
} from './sales-api'
import { WithPaymentMethods, WithSale } from './with-sale'

const TITLE = '返金する'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type RefundProps = {
  salon: ModelsSalonResponse
  sale: ModelsSaleResponse
  payment: ModelsPaymentResponse
  methods: readonly ModelsPaymentMethodResponse[]
}

/**
 * The form that records a payment of a sale as given back, whole or in
 * part. The page of the sale is read anew after it: the API answers with
 * the payment, and works out the state of the sale again. When every
 * payment was then given back whole, the sale can be voided, and paid
 * again: the screen says so.
 *
 * A payment that was given back meanwhile is shown as it is now, and the
 * screen says why it is not given back again.
 */
const Refund = ({ salon, sale, payment, methods }: RefundProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const key = saleKeyOf(sale.id)
  const back = saleHrefOf(salon.id, sale.id)
  const forgetLists = (): void => {
    queryClient.removeQueries({ queryKey: saleListsKeyOf(salon.id) })
    if (sale.bookingId !== null) {
      queryClient.removeQueries({
        queryKey: salesOfBookingKeyOf(sale.bookingId),
      })
    }
  }
  const refund = useMutation({
    mutationFn: (request: ModelsPaymentRefundRequest) =>
      attemptRefund(sale.id, payment.id, request),
    onSuccess: (outcome, request) =>
      match(afterRefund(outcome))
        .with({ type: 'done' }, () => {
          queryClient.removeQueries({ queryKey: key, exact: true })
          forgetLists()
          notify({
            tone: 'success',
            message: voidableAfter(sale, payment.id, request)
              ? '返金を記録しました。すべての支払いを全額返金したので、売上を取り消せます。'
              : '返金を記録しました。',
          })
          void navigate(back)
        })
        .with({ type: 'again' }, ({ message, errors }) =>
          setSaid({ message, errors }),
        )
        // The payment was given back meanwhile: the screen shows it as it is now
        .with({ type: 'refused' }, ({ sale: now }) => {
          const read: SaleRead = { type: 'found', sale: now }
          queryClient.setQueryData(key, read)
          forgetLists()
        })
        // The payment or its sale was removed meanwhile, or is no longer this account's to see
        .with({ type: 'gone' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void => {
    const read = readRefund(values, payment, salon.currency)
    if (read.type === 'invalid') {
      setSaid({ message: undefined, errors: read.errors })
      return
    }
    setSaid(NOTHING_SAID)
    refund.mutate(read.request)
  }

  return (
    <RefundForm
      payment={payment}
      methods={methods}
      timezone={salon.timezone}
      currency={salon.currency}
      message={said.message}
      errors={said.errors}
      pending={refund.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** What the screen says when the payment is not given back: why, and the way back. */
const Unrefundable = ({ why, back }: { why: string; back: string }) => (
  <>
    <p>{why}</p>
    <p>
      <ButtonLink href={back}>売上の内容へ</ButtonLink>
    </p>
  </>
)

/**
 * Gives back a payment of a sale of the salon of the address: one that was
 * received, by an account that may give money back.
 */
export const RefundScreen = () => {
  const { salonId = '', paymentId = '' } = useParams()
  const session = useSession()
  const mayRefund =
    session.type === 'signedIn' && mayUndoSales(session.user.role)

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithSale key={salon.id} salon={salon} title={TITLE} fresh>
          {(sale) => {
            const back = saleHrefOf(salon.id, sale.id)
            const payment = sale.payments.find(({ id }) => id === paymentId)

            return match([payment, mayRefund])
              .with([P._, false], () => (
                <Unrefundable why={UNDONE_BY_OTHERS} back={back} />
              ))
              .with([undefined, true], () => (
                <Unrefundable
                  why='この売上に、この支払いはありません。アドレスが正しいか、お確かめください。'
                  back={back}
                />
              ))
              .with([P.nonNullable, true], ([received]) =>
                match(whyNoRefund(received))
                  .with(P.string, (why) => (
                    <Unrefundable why={why} back={back} />
                  ))
                  .with(undefined, () => (
                    <WithPaymentMethods salonId={salon.id}>
                      {(methods) => (
                        <Refund
                          salon={salon}
                          sale={sale}
                          payment={received}
                          methods={methods}
                        />
                      )}
                    </WithPaymentMethods>
                  ))
                  .exhaustive(),
              )
              .exhaustive()
          }}
        </WithSale>
      )}
    </WithSalon>
  )
}
