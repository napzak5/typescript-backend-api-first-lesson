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
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
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

const {
  entry: ENTRY,
  loading,
  names,
  titles,
  words,
} = adminPaymentMethodMessages

type PaymentMethodEntryProps = { salon: ModelsSalonResponse; sortOrder: number }

/**
 * The form of a new payment method, last in the order unless it is given
 * another place. The methods that were read are dropped: the new one
 * belongs among them, and the screens of the sales offer it.
 */
const PaymentMethodEntry = ({ salon, sortOrder }: PaymentMethodEntryProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
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
            message: ENTRY.added(method.displayName),
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
      submitLabel={say(ENTRY.submit)}
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={paymentMethodsHrefOf(salon.id)} variant='quiet'>
          {say(words.cancel)}
        </ButtonLink>
      }
    />
  )
}

type EntryPartProps = { salon: ModelsSalonResponse }

/** The payment methods there are, read anew to place the new one last, and the form once they were. */
const EntryPart = ({ salon }: EntryPartProps) => {
  const say = useSay()
  const methods = useQuery({
    queryKey: paymentMethodsKeyOf(salon.id),
    queryFn: () => readPaymentMethods(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={say(titles.entry)} description={salon.name} />
      {match(methods.isFetchedAfterMount ? methods.data : undefined)
        .with(undefined, () => (
          <LoadingIndicator label={say(loading.methods)} />
        ))
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what={names.methodsOfTheSalon} />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.methods, reason))}
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
  const say = useSay()
  const { salonId = '' } = useParams()
  const keeps = useKeepsPaymentMethods()

  return (
    <WithSalon salonId={salonId} title={say(titles.entry)}>
      {(salon) =>
        keeps ? (
          <EntryPart key={salon.id} salon={salon} />
        ) : (
          <PaymentMethodsForbidden salon={salon} title={titles.entry} />
        )
      }
    </WithSalon>
  )
}
