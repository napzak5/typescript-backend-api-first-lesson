import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsPurchaseOrderResponse,
  ModelsPurchaseOrderUpdateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { purchaseOrderHrefOf } from '../../navigation'
import {
  changeOrder,
  type OrderRead,
  purchaseOrderKeyOf,
  purchaseOrdersKeyOf,
  readOrder,
} from '../api/purchase-orders-api'
import { OrderChangeForm } from '../components/order-change-form/order-change-form'
import {
  afterOrderChange,
  CLOSED_ORDERS,
  readOrderChange,
} from '../utils/order-change'
import { OrderNotFound } from './order-not-found'

const { form, loading, names, titles, words } = adminPurchaseOrderMessages
const WORDS = form.change

type OrderChangeProps = {
  salon: ModelsSalonResponse
  order: ModelsPurchaseOrderResponse
}

/**
 * The day of the delivery and the notes of an order, opened with what the
 * order holds now. It sends what was changed and nothing else, and a form
 * sent as it was opened asks the API for nothing. An order that was
 * delivered or cancelled meanwhile is read anew, and the screen says that
 * it does not change.
 */
const OrderChange = ({ salon, order }: OrderChangeProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const key = purchaseOrderKeyOf(order.id)
  const page = purchaseOrderHrefOf(salon.id, order.id)

  const change = useMutation({
    mutationFn: (request: ModelsPurchaseOrderUpdateRequest) =>
      changeOrder(order.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'changed' }, ({ order: changed }) => {
          const read: OrderRead = { type: 'found', order: changed }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({
            queryKey: purchaseOrdersKeyOf(salon.id),
          })
          notify({
            tone: 'success',
            message: WORDS.changed(changed.orderNumber),
          })
          void navigate(page)
        })
        .with({ type: P.union('conflict', 'notFound') }, () => {
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterOrderChange(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readOrderChange(values, order, salon.timezone))
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

  return (
    <>
      <p>{say(words.orderOf(order.orderNumber, order.supplier))}</p>
      <OrderChangeForm
        order={order}
        timezone={salon.timezone}
        submitLabel={say(WORDS.submit)}
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={submit}
        actions={
          <ButtonLink href={page} variant='quiet'>
            {say(words.cancel)}
          </ButtonLink>
        }
      />
    </>
  )
}

type ChangePartProps = { salon: ModelsSalonResponse; purchaseOrderId: string }

/**
 * The order of the address, read anew whenever the screen opens, so that
 * what the form writes on is what the order holds now. It is not read
 * again when the window comes back: the form compares what is sent with
 * what it was opened with.
 */
const ChangePart = ({ salon, purchaseOrderId }: ChangePartProps) => {
  const say = useSay()
  const read = useQuery({
    queryKey: purchaseOrderKeyOf(purchaseOrderId),
    queryFn: () => readOrder(purchaseOrderId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const header = (
    <PageHeader title={say(titles.change)} description={salon.name} />
  )

  return match(read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label={say(loading.order)} />
      </>
    ))
    .with({ type: 'notFound' }, () => <OrderNotFound salonId={salon.id} />)
    .with(
      { type: 'found', order: P.when(({ salonId }) => salonId !== salon.id) },
      () => <OrderNotFound salonId={salon.id} />,
    )
    .with({ type: 'forbidden' }, () => (
      <>
        {header}
        <OtherSalonNotice what={names.ordersOfTheSalon} />
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={say(unreadMessageOf(names.order, reason))}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .with(
      { type: 'found', order: { status: P.union('delivered', 'cancelled') } },
      ({ order }) => (
        <>
          {header}
          <p>{say(CLOSED_ORDERS[order.status])}</p>
          <ButtonLink href={purchaseOrderHrefOf(salon.id, order.id)}>
            {say(words.toOrder)}
          </ButtonLink>
        </>
      ),
    )
    .with({ type: 'found' }, ({ order }) => (
      <>
        {header}
        <OrderChange salon={salon} order={order} />
      </>
    ))
    .exhaustive()
}

/** The day of the delivery and the notes of an order of the salon of the address, for every member of its staff and an administrator. */
export const PurchaseOrderChangeScreen = () => {
  const say = useSay()
  const { salonId = '', purchaseOrderId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.change)}>
      {(salon) => (
        <ChangePart
          key={purchaseOrderId}
          salon={salon}
          purchaseOrderId={purchaseOrderId}
        />
      )}
    </WithSalon>
  )
}
