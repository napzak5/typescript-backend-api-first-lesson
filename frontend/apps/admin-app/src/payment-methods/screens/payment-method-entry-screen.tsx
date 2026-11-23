import { NOT_FOUND, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentMethodCreateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  salonKeyOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  inJapanese,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { paymentMethodHrefOf, paymentMethodsHrefOf } from '../../navigation'
import {
  paymentMethodsKeyOf,
  readPaymentMethods,
} from '../../sales/api/sales-api'
import {
  addPaymentMethod,
  type PaymentMethodRead,
  paymentMethodKeyOf,
} from '../api/payment-methods-api'
import { PaymentMethodForm } from '../components/payment-method-form/payment-method-form'
import {
  afterPaymentMethodWrite,
  readPaymentMethodEntry,
} from '../utils/payment-method-form'
import { nextSortOrderOf } from '../utils/payment-method-format'
import {
  PaymentMethodsForbidden,
  useKeepsPaymentMethods,
} from './keeps-payment-methods'

const TITLE = '支払い方法を足す'

type PaymentMethodEntryProps = { salon: ModelsSalonResponse; sortOrder: number }

/**
 * The form of a new payment method, last in the order unless it is given
 * another place. The methods that were read are dropped: the new one
 * belongs among them, and the screens of the sales offer it.
 */
const PaymentMethodEntry = ({ salon, sortOrder }: PaymentMethodEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const entry = useMutation({
    mutationFn: (request: ModelsPaymentMethodCreateRequest) =>
      addPaymentMethod(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ method }) => {
          const read: PaymentMethodRead = { type: 'found', method }
          queryClient.setQueryData(paymentMethodKeyOf(method.id), read)
          queryClient.removeQueries({
            queryKey: paymentMethodsKeyOf(salon.id),
          })
          notify({
            tone: 'success',
            message: `支払い方法「${method.displayName}」を足しました。`,
          })
          void navigate(paymentMethodHrefOf(salon.id, method.id))
        })
        // The salon was removed meanwhile
        .with({ type: 'notFound' }, () =>
          queryClient.setQueryData(salonKeyOf(salon.id), NOT_FOUND),
        )
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterPaymentMethodWrite(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readPaymentMethodEntry(values))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <PaymentMethodForm
      method={null}
      sortOrder={sortOrder}
      submitLabel='足す'
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={paymentMethodsHrefOf(salon.id)} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type EntryPartProps = { salon: ModelsSalonResponse }

/** The payment methods there are, read anew to place the new one last, and the form once they were. */
const EntryPart = ({ salon }: EntryPartProps) => {
  const methods = useQuery({
    queryKey: paymentMethodsKeyOf(salon.id),
    queryFn: () => readPaymentMethods(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {match(methods.isFetchedAfterMount ? methods.data : undefined)
        .with(undefined, () => (
          <LoadingIndicator label='支払い方法を読み込んでいます' />
        ))
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what={writtenInJapanese('支払い方法')} />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={inJapanese(
                unreadMessageOf(writtenInJapanese('支払い方法'), reason),
              )}
              onRetry={() => void methods.refetch()}
              pending={methods.isFetching}
            />
          ),
        )
        .with({ type: 'found' }, ({ items }) => (
          <PaymentMethodEntry
            salon={salon}
            sortOrder={nextSortOrderOf(items)}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** Adds a payment method to the salon of the address, for the owner, a manager and an administrator. */
export const PaymentMethodEntryScreen = () => {
  const { salonId = '' } = useParams()
  const keeps = useKeepsPaymentMethods()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <EntryPart key={salon.id} salon={salon} />
        ) : (
          <PaymentMethodsForbidden salon={salon} title={TITLE} />
        )
      }
    </WithSalon>
  )
}
