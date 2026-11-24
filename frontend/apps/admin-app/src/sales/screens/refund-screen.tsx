import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentRefundRequest,
  ModelsPaymentResponse,
  ModelsSaleResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  type FormSays,
  NOTHING_TO_SAY,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { saleHrefOf } from '../../navigation'
import {
  attemptRefund,
  forgetListsOf,
  type SaleRead,
  saleKeyOf,
} from '../api/sales-api'
import { RefundForm } from '../components/refund-form/refund-form'
import {
  afterRefund,
  readRefund,
  voidableAfter,
  whyNoRefund,
} from '../utils/refunds'
import { mayUndoSales } from '../utils/sale-changes'
import { Unwritable, WithPaymentMethods, WithSale } from './with-sale'

const { titles, undoneByOthers, words } = adminSaleMessages
const { refund: texts } = adminSaleMessages.payments

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
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const key = saleKeyOf(sale.id)
  const back = saleHrefOf(salon.id, sale.id)
  const refund = useMutation({
    mutationFn: (request: ModelsPaymentRefundRequest) =>
      attemptRefund(sale.id, payment.id, request),
    onSuccess: (outcome, request) =>
      match(afterRefund(outcome))
        .with({ type: 'done' }, () => {
          queryClient.removeQueries({ queryKey: key, exact: true })
          forgetListsOf(queryClient, sale)
          notify({
            tone: 'success',
            message: voidableAfter(sale, payment.id, request)
              ? texts.notices.voidable
              : texts.notices.recorded,
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
          forgetListsOf(queryClient, sale)
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
    setSaid(NOTHING_TO_SAY)
    refund.mutate(read.value)
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
          {say(words.cancel)}
        </ButtonLink>
      }
    />
  )
}

/**
 * Gives back a payment of a sale of the salon of the address: one that was
 * received, by an account that may give money back.
 */
export const RefundScreen = () => {
  const say = useSay()
  const { salonId = '', paymentId = '' } = useParams()
  const session = useSession()
  const mayRefund =
    session.type === 'signedIn' && mayUndoSales(session.user.role)
  const title = say(titles.refund)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <WithSale key={salon.id} salon={salon} title={title} fresh>
          {(sale) => {
            const back = saleHrefOf(salon.id, sale.id)
            const payment = sale.payments.find(({ id }) => id === paymentId)

            return match([payment, mayRefund])
              .with([P._, false], () => (
                <Unwritable why={undoneByOthers} back={back} />
              ))
              .with([undefined, true], () => (
                <Unwritable why={texts.why.noSuchPayment} back={back} />
              ))
              .with([P.nonNullable, true], ([received]) =>
                match(whyNoRefund(received))
                  .with(P.nonNullable, (why) => (
                    <Unwritable why={why} back={back} />
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
