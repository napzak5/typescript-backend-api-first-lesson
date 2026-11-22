import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentMethodResponse,
  ModelsSaleProcessRequest,
  ModelsSaleResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf, WithSalon } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { saleHrefOf } from '../navigation'
import { PaymentForm } from './components/payment-form/payment-form'
import { afterPayment, methodsInUse, readPayment } from './payments'
import { owedOf, whyNoPayment } from './sale-format'
import {
  attemptPayment,
  type SaleRead,
  saleKeyOf,
  saleListsKeyOf,
  salesOfBookingKeyOf,
} from './sales-api'
import { WithPaymentMethods, WithSale } from './with-sale'

const TITLE = '支払いを記録する'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type PaymentEntryProps = {
  salon: ModelsSalonResponse
  sale: ModelsSaleResponse
  methods: readonly ModelsPaymentMethodResponse[]
}

/**
 * The form that records a payment of a sale, by a method the salon uses,
 * of at most what is left to pay. The page of the sale is read anew after
 * it: the API answers with the payment, and works out the state of the
 * sale again.
 *
 * A sale that changed meanwhile so that it takes no payment (it was voided,
 * part of it was given back, or it was paid) is shown as it is now, and
 * the screen says why.
 */
const PaymentEntry = ({ salon, sale, methods }: PaymentEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const key = saleKeyOf(sale.id)
  const back = saleHrefOf(salon.id, sale.id)
  const owed = owedOf(sale)
  const offered = methodsInUse(methods)
  const forgetLists = (): void => {
    queryClient.removeQueries({ queryKey: saleListsKeyOf(salon.id) })
    if (sale.bookingId !== null) {
      queryClient.removeQueries({
        queryKey: salesOfBookingKeyOf(sale.bookingId),
      })
    }
  }
  const recording = useMutation({
    mutationFn: (request: ModelsSaleProcessRequest) =>
      attemptPayment(sale.id, request),
    onSuccess: (outcome, request) =>
      match(afterPayment(outcome))
        .with({ type: 'done' }, () => {
          queryClient.removeQueries({ queryKey: key, exact: true })
          forgetLists()
          notify({
            tone: 'success',
            message:
              request.amount === owed
                ? '支払いを記録しました。合計を受け取ったので、レシートを出せます。'
                : '支払いを記録しました。',
          })
          void navigate(back)
        })
        .with({ type: 'again' }, ({ message, errors }) =>
          setSaid({ message, errors }),
        )
        // The sale changed meanwhile: the screen shows it as it is now
        .with({ type: 'refused' }, ({ sale: now }) => {
          const read: SaleRead = { type: 'found', sale: now }
          queryClient.setQueryData(key, read)
          forgetLists()
        })
        // The sale was removed meanwhile, or is no longer this account's to see
        .with({ type: 'gone' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void => {
    const read = readPayment(values, offered, owed, salon.currency)
    if (read.type === 'invalid') {
      setSaid({ message: undefined, errors: read.errors })
      return
    }
    setSaid(NOTHING_SAID)
    recording.mutate(read.request)
  }

  if (offered.length === 0) {
    return (
      <Unpayable
        why='このサロンには、使っている支払い方法がありません。サロンの設定で、支払い方法を使えるようにしてください。'
        back={back}
      />
    )
  }

  return (
    <PaymentForm
      methods={offered}
      owed={owed}
      currency={salon.currency}
      message={said.message}
      errors={said.errors}
      pending={recording.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** What the screen says when the sale takes no payment: why, and the way back. */
const Unpayable = ({ why, back }: { why: string; back: string }) => (
  <>
    <p>{why}</p>
    <ButtonLink href={back}>売上の内容へ</ButtonLink>
  </>
)

/** Records a payment of a sale of the salon of the address. */
export const PaymentEntryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithSale key={salon.id} salon={salon} title={TITLE} fresh>
          {(sale) => (
            <>
              <p>
                {`合計 ${amountOf(sale.totalAmount, salon.currency)}、未払い残額 ${amountOf(owedOf(sale), salon.currency)}`}
              </p>
              {match(whyNoPayment(sale))
                .with(P.string, (why) => (
                  <Unpayable why={why} back={saleHrefOf(salon.id, sale.id)} />
                ))
                .with(undefined, () => (
                  <WithPaymentMethods salonId={salon.id}>
                    {(methods) => (
                      <PaymentEntry
                        salon={salon}
                        sale={sale}
                        methods={methods}
                      />
                    )}
                  </WithPaymentMethods>
                ))
                .exhaustive()}
            </>
          )}
        </WithSale>
      )}
    </WithSalon>
  )
}
