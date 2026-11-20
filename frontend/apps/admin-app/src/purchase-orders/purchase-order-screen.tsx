import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { purchaseOrdersHrefOf, stockRowHrefOf } from '../navigation'
import { unreadMessageOf } from '../reading'
import { readStaffProfiles, staffProfilesKeyOf } from '../salons/salons-api'
import { OtherSalonNotice, WithSalon } from '../salons/with-salon'
import { OrderRecord } from './components/order-record/order-record'
import { purchaseOrderKeyOf, readOrder } from './purchase-orders-api'

const TITLE = '発注'

/** The way back to the orders of the salon */
const ToTheOrders = ({ salonId }: { salonId: string }) => (
  <p>
    <ButtonLink href={purchaseOrdersHrefOf(salonId)} variant='secondary'>
      発注へ
    </ButtonLink>
  </p>
)

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
  const notFound = (
    <>
      <PageHeader
        title='発注が見つかりません'
        description='アドレスが正しいか、お確かめください。'
      />
      <ToTheOrders salonId={salon.id} />
    </>
  )

  return (
    match(read.data)
      .with(undefined, () => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <LoadingIndicator label='発注を読み込んでいます' />
        </>
      ))
      .with({ type: 'notFound' }, () => notFound)
      // An order of another salon. The salon is compared by a predicate: as a
      // pattern, a string that is no literal would rule out every order
      .with(
        { type: 'found', order: P.when(({ salonId }) => salonId !== salon.id) },
        () => notFound,
      )
      .with({ type: 'forbidden' }, () => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <OtherSalonNotice what='発注' />
        </>
      ))
      .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <UnreadNotice
            message={unreadMessageOf('発注', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        </>
      ))
      .with({ type: 'found' }, ({ order }) => (
        <>
          <PageHeader
            title={`${TITLE} ${order.orderNumber}`}
            description={salon.name}
          />
          <OrderRecord
            order={order}
            timezone={salon.timezone}
            currency={salon.currency}
            staff={match(staff.data)
              .with({ type: 'found' }, ({ items }) => items)
              .otherwise(() => undefined)}
            rowHref={(inventoryId) => stockRowHrefOf(salon.id, inventoryId)}
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
