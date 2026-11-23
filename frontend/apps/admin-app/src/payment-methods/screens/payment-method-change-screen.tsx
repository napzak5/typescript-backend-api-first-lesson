import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentMethodUpdateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  aboutTheAttempt,
  Button,
  ButtonLink,
  Dialog,
  type FormSays,
  inJapanese,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
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
import { paymentMethodsKeyOf } from '../../sales/api/sales-api'
import {
  changePaymentMethod,
  type PaymentMethodRead,
  paymentMethodKeyOf,
  readPaymentMethod,
  removePaymentMethod,
} from '../api/payment-methods-api'
import { PaymentMethodForm } from '../components/payment-method-form/payment-method-form'
import {
  afterPaymentMethodRemoval,
  afterPaymentMethodWrite,
  readPaymentMethodChange,
} from '../utils/payment-method-form'
import {
  PaymentMethodNotFound,
  PaymentMethodsForbidden,
  useKeepsPaymentMethods,
} from './keeps-payment-methods'

const TITLE = '支払い方法を直す'

type PaymentMethodChangeProps = {
  salon: ModelsSalonResponse
  method: ModelsPaymentMethodResponse
}

/**
 * The form of a payment method, opened with what the salon has of it now.
 * It sends what was changed and nothing else, and a form sent as it was
 * opened asks the API for nothing. Beside the form, the method is removed
 * after a dialog; one that a payment was received by stays, and the salon
 * is told to stop using it instead.
 */
const PaymentMethodChange = ({ salon, method }: PaymentMethodChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const [removing, setRemoving] = useState(false)
  /** What went wrong with a removal that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  const key = paymentMethodKeyOf(method.id)
  const page = paymentMethodHrefOf(salon.id, method.id)

  /** The methods that were read are dropped: the screens of the sales read them anew */
  const forgetList = (): void =>
    queryClient.removeQueries({ queryKey: paymentMethodsKeyOf(salon.id) })

  /** The method is not there any more: removed here, or by somebody else meanwhile */
  const gone = (): void => {
    forgetList()
    queryClient.setQueryData(key, NOT_FOUND)
  }

  const change = useMutation({
    mutationFn: (request: ModelsPaymentMethodUpdateRequest) =>
      changePaymentMethod(salon.id, method.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ method: changed }) => {
          const read: PaymentMethodRead = { type: 'found', method: changed }
          queryClient.setQueryData(key, read)
          forgetList()
          notify({
            tone: 'success',
            message: `支払い方法「${changed.displayName}」を直しました。`,
          })
          void navigate(page)
        })
        .with({ type: 'notFound' }, gone)
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterPaymentMethodWrite(refused)),
        )
        .exhaustive(),
  })

  const removal = useMutation({
    mutationFn: () => removePaymentMethod(salon.id, method.id),
    onSuccess: (outcome) =>
      match(afterPaymentMethodRemoval(outcome, method.displayName))
        .with({ type: 'done' }, ({ message: done }) => {
          gone()
          notify({ tone: 'success', message: done })
          void navigate(paymentMethodsHrefOf(salon.id))
        })
        .with({ type: 'gone' }, gone)
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setRemoving(false)
          setSaid(aboutTheAttempt(refused))
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readPaymentMethodChange(values, method))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(page)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        change.mutate(value)
      })
      .exhaustive()

  const close = (): void => {
    setRemoving(false)
    setMessage(undefined)
  }

  return (
    <>
      <PaymentMethodForm
        method={method}
        sortOrder={method.sortOrder}
        submitLabel='変更を保存する'
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={submit}
        actions={
          <>
            <ButtonLink href={page} variant='quiet'>
              やめる
            </ButtonLink>
            <Button variant='danger' onClick={() => setRemoving(true)}>
              削除
            </Button>
          </>
        }
      />
      <Dialog
        open={removing}
        onClose={close}
        title={`支払い方法「${method.displayName}」を削除しますか？`}
        description='売上の画面で選べなくなります。この支払い方法で受け取った支払いがあれば、削除できません。そのときは、使うのをやめてください。削除した支払い方法は、元に戻せません。'
        actions={
          <>
            <Button onClick={close}>戻る</Button>
            <Button
              variant='danger'
              pending={removal.isPending}
              onClick={() => {
                setMessage(undefined)
                removal.mutate()
              }}
            >
              削除する
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      </Dialog>
    </>
  )
}

type ChangePartProps = { salon: ModelsSalonResponse; paymentMethodId: string }

/**
 * The payment method of the address, read anew whenever the screen opens,
 * so that what the form writes on is what the salon holds now; the form
 * once it was. It is not read again when the window comes back: the form
 * compares what is sent with what it was opened with.
 */
const ChangePart = ({ salon, paymentMethodId }: ChangePartProps) => {
  const method = useQuery({
    queryKey: paymentMethodKeyOf(paymentMethodId),
    queryFn: () => readPaymentMethod(salon.id, paymentMethodId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const header = <PageHeader title={TITLE} description={salon.name} />

  return match(method.isFetchedAfterMount ? method.data : undefined)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label='支払い方法を読み込んでいます' />
      </>
    ))
    .with({ type: 'notFound' }, () => <PaymentMethodNotFound salon={salon} />)
    .with({ type: 'forbidden' }, () => (
      <>
        {header}
        <OtherSalonNotice what={writtenInJapanese('支払い方法')} />
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={inJapanese(
            unreadMessageOf(writtenInJapanese('支払い方法'), reason),
          )}
          onRetry={() => void method.refetch()}
          pending={method.isFetching}
        />
      </>
    ))
    .with({ type: 'found' }, (found) => (
      <>
        {header}
        <PaymentMethodChange salon={salon} method={found.method} />
      </>
    ))
    .exhaustive()
}

/** Changes a payment method of the salon of the address, and removes it, for the owner, a manager and an administrator. */
export const PaymentMethodChangeScreen = () => {
  const { salonId = '', paymentMethodId = '' } = useParams()
  const keeps = useKeepsPaymentMethods()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <ChangePart
            key={paymentMethodId}
            salon={salon}
            paymentMethodId={paymentMethodId}
          />
        ) : (
          <PaymentMethodsForbidden salon={salon} title={TITLE} />
        )
      }
    </WithSalon>
  )
}
