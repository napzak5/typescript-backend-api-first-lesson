import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsPurchaseOrderCancelRequest,
  ModelsPurchaseOrderResponse,
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  orderChangeHrefOf,
  orderReceiptHrefOf,
  stockRowHrefOf,
} from '../navigation'
import { readStaffProfiles, staffProfilesKeyOf } from '../salons/salons-api'
import { OrderRecord } from './components/order-record/order-record'
import {
  type OrderMoveAction,
  OrderStatusActions,
} from './components/order-status-actions/order-status-actions'
import {
  afterOrderStep,
  isClosedOrder,
  isReceivableOrder,
  MOVED_TO,
  mayApproveOrders,
  ORDER_CHANGED_ELSEWHERE,
  orderActionNoteOf,
  orderActionsOf,
  readOrderCancellation,
} from './order-actions'
import { OrderNotFound, ToTheOrders } from './order-not-found'
import {
  approveOrder,
  cancelOrder,
  moveOrder,
  type OrderRead,
  type OrderStep,
  purchaseOrderKeyOf,
  purchaseOrdersKeyOf,
  readOrder,
} from './purchase-orders-api'

const TITLE = '発注'

/** An operation on the status of an order, with what it sends. */
type Operation =
  | { type: OrderMoveAction }
  | { type: 'cancel'; request: ModelsPurchaseOrderCancelRequest }

const send = (id: string, operation: Operation): Promise<OrderStep> =>
  match(operation)
    .with({ type: 'approve' }, () => approveOrder(id))
    .with({ type: 'cancel' }, ({ request }) => cancelOrder(id, request))
    .with({ type: P.union('submit', 'order', 'ship') }, ({ type }) =>
      moveOrder(id, MOVED_TO[type]),
    )
    .exhaustive()

/** What is said about an attempt, and where: in the open dialog, or where the status is. */
type Said = { where: 'dialog' | 'page'; message: string }

type OrderDetailsProps = {
  salon: ModelsSalonResponse
  order: ModelsPurchaseOrderResponse
  /** The staff of the salon, who name who made and approved the order; `undefined` while they are read */
  staff: readonly ModelsStaffProfileResponse[] | undefined
}

/**
 * The status of an order with what the account may do to it, and the
 * order itself. After an operation, the order the API answered with is
 * shown, and the focus goes to the heading of the status. When the order
 * changed elsewhere meanwhile, it is read anew, and the screen says so
 * where the status is.
 */
const OrderDetails = ({ salon, order, staff }: OrderDetailsProps) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const session = useSession()
  const approves =
    session.type === 'signedIn' && mayApproveOrders(session.user.role)
  const [asking, setAsking] = useState(false)
  const [said, setSaid] = useState<Said>()
  const [cancellationErrors, setCancellationErrors] = useState<FormErrors>({})
  const statusHeading = useRef<HTMLHeadingElement>(null)
  /**
   * When the order was last changed, as the screen showed it when an
   * operation on it was done: the focus goes to the heading of the status
   * in the commit that shows it changed
   */
  const changedFrom = useRef<string>(undefined)
  const key = purchaseOrderKeyOf(order.id)

  useLayoutEffect(() => {
    if (
      changedFrom.current !== undefined &&
      changedFrom.current !== order.updatedAt
    ) {
      changedFrom.current = undefined
      statusHeading.current?.focus()
    }
  }, [order.updatedAt])

  // The dialog that had the focus is gone, and what is said is said where
  // the status is: the focus goes there in the commit that says it
  useLayoutEffect(() => {
    if (said?.message === ORDER_CHANGED_ELSEWHERE) {
      statusHeading.current?.focus()
    }
  }, [said])

  /** The lists that were read are dropped: the order is in another place in them */
  const forgetLists = (): void =>
    queryClient.removeQueries({ queryKey: purchaseOrdersKeyOf(salon.id) })

  const step = useMutation({
    mutationFn: (operation: Operation) => send(order.id, operation),
    onSuccess: (outcome, operation) =>
      match(afterOrderStep(outcome, operation.type, order.orderNumber))
        .with({ type: 'done' }, ({ message }) => {
          if (outcome.type !== 'changed') {
            return
          }
          const read: OrderRead = { type: 'found', order: outcome.order }
          changedFrom.current = order.updatedAt
          setAsking(false)
          setSaid(undefined)
          queryClient.setQueryData(key, read)
          forgetLists()
          notify({ tone: 'success', message })
        })
        .with({ type: 'again' }, ({ message }) =>
          setSaid({
            where: operation.type === 'cancel' ? 'dialog' : 'page',
            message,
          }),
        )
        .with({ type: 'changed' }, ({ message }) => {
          setAsking(false)
          setSaid({ where: 'page', message })
          forgetLists()
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .with({ type: 'gone' }, () => {
          setAsking(false)
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .exhaustive(),
  })

  const act = (operation: Operation): void => {
    setSaid(undefined)
    step.mutate(operation)
  }

  return (
    <>
      {said?.where === 'page' && <Alert tone='danger'>{said.message}</Alert>}
      <OrderStatusActions
        order={order}
        actions={orderActionsOf(order.status, approves)}
        note={orderActionNoteOf(order.status, approves)}
        receiveHref={
          isReceivableOrder(order.status)
            ? orderReceiptHrefOf(salon.id, order.id)
            : undefined
        }
        headingRef={statusHeading}
        pending={step.isPending ? step.variables.type : undefined}
        asking={asking}
        message={said?.where === 'dialog' ? said.message : undefined}
        cancellationErrors={cancellationErrors}
        onAct={(action) => act({ type: action })}
        onAsk={() => {
          // What was said about an attempt before is said no longer
          setSaid(undefined)
          setCancellationErrors({})
          setAsking(true)
        }}
        onClose={() => setAsking(false)}
        onCancel={(values) =>
          match(readOrderCancellation(values))
            .with({ type: 'invalid' }, ({ errors }) =>
              setCancellationErrors(errors),
            )
            .with({ type: 'valid' }, ({ value }) => {
              setCancellationErrors({})
              act({ type: 'cancel', request: value })
            })
            .exhaustive()
        }
      />
      <OrderRecord
        order={order}
        timezone={salon.timezone}
        currency={salon.currency}
        staff={staff}
        rowHref={(inventoryId) => stockRowHrefOf(salon.id, inventoryId)}
      />
    </>
  )
}

type OrderPartProps = {
  salon: ModelsSalonResponse
  purchaseOrderId: string
}

/**
 * A purchase order of the salon, read whenever the screen opens: its
 * status moves on by other hands. An order of another salon is not found
 * at the address of this one. Who made it and who approved it are named
 * once the staff of the salon are read.
 *
 * The heading stays the one element while the screen reads what it shows
 * below it, so that the focus the heading took when the screen opened
 * stays on it.
 */
const OrderPart = ({ salon, purchaseOrderId }: OrderPartProps) => {
  const read = useQuery({
    queryKey: purchaseOrderKeyOf(purchaseOrderId),
    queryFn: () => readOrder(purchaseOrderId),
    staleTime: 0,
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })

  return (
    match(read.data)
      .with(undefined, () => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <LoadingIndicator label='発注を読み込んでいます' />
        </>
      ))
      .with({ type: 'notFound' }, () => <OrderNotFound salonId={salon.id} />)
      // An order of another salon. The salon is compared by a predicate: as a
      // pattern, a string that is no literal would rule out every order
      .with(
        { type: 'found', order: P.when(({ salonId }) => salonId !== salon.id) },
        () => <OrderNotFound salonId={salon.id} />,
      )
      .with({ type: 'forbidden' }, () => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <OtherSalonNotice what='発注' />
        </>
      ))
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <UnreadNotice
            message={unreadMessageOf('発注', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .with({ type: 'found' }, ({ order }) => (
        <>
          <PageHeader
            title={`${TITLE} ${order.orderNumber}`}
            description={salon.name}
            actions={
              !isClosedOrder(order.status) && (
                <ButtonLink href={orderChangeHrefOf(salon.id, order.id)}>
                  納品予定日とメモを直す
                </ButtonLink>
              )
            }
          />
          <OrderDetails
            salon={salon}
            order={order}
            staff={match(staff.data)
              .with({ type: 'found' }, ({ items }) => items)
              .otherwise(() => undefined)}
          />
          <ToTheOrders salonId={salon.id} />
        </>
      ))
      .exhaustive()
  )
}

/** A purchase order of the salon of the address, for every member of its staff and an administrator. */
export const PurchaseOrderScreen = () => {
  const { salonId = '', purchaseOrderId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <OrderPart
          key={purchaseOrderId}
          salon={salon}
          purchaseOrderId={purchaseOrderId}
        />
      )}
    </WithSalon>
  )
}
