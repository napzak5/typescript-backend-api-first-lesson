import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsPurchaseOrderReceiveRequest,
  ModelsPurchaseOrderResponse,
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
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { stockKeyOf, stockRowKeyOf } from '../inventory/inventory-api'
import { purchaseOrderHrefOf } from '../navigation'
import { OrderReceiptForm } from './components/order-receipt-form/order-receipt-form'
import { OrderNotFound } from './order-not-found'
import {
  afterOrderReceipt,
  NO_ROW_LEFT,
  readOrderReceipt,
  receivableItemsOf,
  UNRECEIVABLE,
} from './order-receipt'
import {
  type OrderRead,
  purchaseOrderKeyOf,
  purchaseOrdersKeyOf,
  readOrder,
  receiveOrder,
} from './purchase-orders-api'

const TITLE = '入荷を記録する'

type OrderReceiptProps = {
  salon: ModelsSalonResponse
  order: ModelsPurchaseOrderResponse
}

/**
 * The goods that came for an order, entered over what it ordered. The
 * order is shown as the API delivered it; what was read of the stock of
 * the salon, and of its orders and suggestions, is dropped, as the
 * receipt changes them. An order whose row was removed or that changed
 * meanwhile is read anew: the form then shows what can be received now,
 * or the screen says why nothing can.
 */
const OrderReceipt = ({ salon, order }: OrderReceiptProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const key = purchaseOrderKeyOf(order.id)
  const page = purchaseOrderHrefOf(salon.id, order.id)

  const receipt = useMutation({
    mutationFn: (request: ModelsPurchaseOrderReceiveRequest) =>
      receiveOrder(order.id, request),
    onSuccess: (outcome, request) =>
      match(outcome)
        .with({ type: 'received' }, ({ order: delivered }) => {
          const read: OrderRead = { type: 'found', order: delivered }
          queryClient.setQueryData(key, read)
          // The lists and the suggestions of the orders, and the stock of
          // the salon: its rows, their movements, its alerts and its value
          queryClient.removeQueries({
            queryKey: purchaseOrdersKeyOf(salon.id),
          })
          queryClient.removeQueries({ queryKey: stockKeyOf(salon.id) })
          for (const { inventoryId } of request.items) {
            queryClient.removeQueries({ queryKey: stockRowKeyOf(inventoryId) })
          }
          notify({
            tone: 'success',
            message: `発注 ${delivered.orderNumber} の入荷を記録しました。届いた ${request.items.length} 件の明細を、在庫に入れました。`,
          })
          void navigate(page)
        })
        .with({ type: 'notFound' }, () => {
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .with({ type: P.union('rowsChanged', 'conflict') }, (refused) => {
          void queryClient.invalidateQueries({ queryKey: key })
          setSaid(afterOrderReceipt(refused))
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterOrderReceipt(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readOrderReceipt(values, order))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        receipt.mutate(value)
      })
      .exhaustive()

  return (
    <>
      <p>
        発注 {order.orderNumber}（{order.supplier}）
      </p>
      <OrderReceiptForm
        order={order}
        submitLabel='入荷を記録する'
        message={said.message}
        errors={said.errors}
        pending={receipt.isPending}
        onSubmit={submit}
        actions={
          <ButtonLink href={page} variant='quiet'>
            やめる
          </ButtonLink>
        }
      />
    </>
  )
}

/** Why the goods of an order are not received now, and the way back to it */
const NotReceived = ({
  salonId,
  order,
  reason,
}: {
  salonId: string
  order: Pick<ModelsPurchaseOrderResponse, 'id'>
  reason: string
}) => (
  <>
    <p>{reason}</p>
    <ButtonLink href={purchaseOrderHrefOf(salonId, order.id)}>
      発注へ戻る
    </ButtonLink>
  </>
)

type ReceiptPartProps = { salon: ModelsSalonResponse; purchaseOrderId: string }

/**
 * The order of the address, read anew whenever the screen opens, so that
 * the form starts from what the order holds now. It is not read again
 * when the window comes back: the form compares the notes that are sent
 * with those it was opened with.
 */
const ReceiptPart = ({ salon, purchaseOrderId }: ReceiptPartProps) => {
  const read = useQuery({
    queryKey: purchaseOrderKeyOf(purchaseOrderId),
    queryFn: () => readOrder(purchaseOrderId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const header = <PageHeader title={TITLE} description={salon.name} />

  return match(read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label='発注を読み込んでいます' />
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
        <OtherSalonNotice what='発注' />
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={unreadMessageOf('発注', reason)}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .with(
      {
        type: 'found',
        order: {
          status: P.union(
            'draft',
            'pending',
            'approved',
            'delivered',
            'cancelled',
          ),
        },
      },
      ({ order }) => (
        <>
          {header}
          <NotReceived
            salonId={salon.id}
            order={order}
            reason={UNRECEIVABLE[order.status]}
          />
        </>
      ),
    )
    .with(
      {
        type: 'found',
        order: P.when(({ items }) => receivableItemsOf(items).length === 0),
      },
      ({ order }) => (
        <>
          {header}
          <NotReceived salonId={salon.id} order={order} reason={NO_ROW_LEFT} />
        </>
      ),
    )
    .with({ type: 'found' }, ({ order }) => (
      <>
        {header}
        <OrderReceipt salon={salon} order={order} />
      </>
    ))
    .exhaustive()
}

/** The goods that came for an order of the salon of the address, for every member of its staff and an administrator. */
export const PurchaseOrderReceiptScreen = () => {
  const { salonId = '', purchaseOrderId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <ReceiptPart
          key={purchaseOrderId}
          salon={salon}
          purchaseOrderId={purchaseOrderId}
        />
      )}
    </WithSalon>
  )
}
