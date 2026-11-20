import type {
  ModelsInventoryResponse,
  ModelsPurchaseOrderCreateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import {
  everyStockRowKeyOf,
  readEveryStockRow,
} from '../inventory/inventory-api'
import {
  inventoryHrefOf,
  purchaseOrderHrefOf,
  purchaseOrdersHrefOf,
} from '../navigation'
import { productsKeyOf, readProducts } from '../products/products-api'
import { unreadMessageOf } from '../reading'
import { OtherSalonNotice, WithSalon } from '../salons/with-salon'
import { OrderForm } from './components/order-form/order-form'
import { afterOrderEntry, readOrderEntry } from './order-entry'
import { orderStatusNameOf } from './order-format'
import {
  makeOrder,
  type OrderRead,
  purchaseOrderKeyOf,
  purchaseOrdersKeyOf,
} from './purchase-orders-api'

const TITLE = '発注を作る'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

/**
 * The form of a new purchase order of the salon: every stock row of it,
 * read whenever the screen opens, with the products that name the rows
 * and price them. The order is made as a draft, and its screen shows it.
 * When the API says that a row was removed meanwhile, the rows are read
 * anew, and what was entered stays.
 */
const EntryPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const rows = useQuery({
    queryKey: everyStockRowKeyOf(salon.id),
    queryFn: () => readEveryStockRow(salon.id),
    staleTime: 0,
  })
  const products = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: () => readProducts(salon.id),
    staleTime: 0,
  })

  const entry = useMutation({
    mutationFn: (request: ModelsPurchaseOrderCreateRequest) =>
      makeOrder(request),
    onSuccess: (outcome, request) =>
      match(outcome)
        .with({ type: 'made' }, ({ order }) => {
          const read: OrderRead = { type: 'found', order }
          queryClient.setQueryData(purchaseOrderKeyOf(order.id), read)
          // The new order belongs in every list of the orders of the salon
          queryClient.removeQueries({
            queryKey: purchaseOrdersKeyOf(salon.id),
          })
          notify({
            tone: 'success',
            message: `発注 ${order.orderNumber} を${orderStatusNameOf(order.status)}として作りました。`,
          })
          void navigate(purchaseOrderHrefOf(salon.id, order.id))
        })
        .with({ type: 'rowsChanged' }, (refused) => {
          void queryClient.invalidateQueries({
            queryKey: everyStockRowKeyOf(salon.id),
            exact: true,
          })
          setSaid(afterOrderEntry(refused, request))
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterOrderEntry(refused, request)),
        )
        .exhaustive(),
  })

  const submit = (
    values: FormData,
    read: readonly ModelsInventoryResponse[],
  ): void =>
    match(readOrderEntry(values, salon, read))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'tooMuch' }, ({ message }) =>
        setSaid({ message, errors: {} }),
      )
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        entry.mutate(request)
      })
      .exhaustive()

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {match([rows.data, products.data])
        .with([undefined, P._], [{ type: 'found' }, undefined], () => (
          <LoadingIndicator label='在庫の行を読み込んでいます' />
        ))
        .with([{ type: 'forbidden' }, P._], () => (
          <OtherSalonNotice what='発注' />
        ))
        .with(
          [{ type: P.union('tooManyRequests', 'failed') }, P._],
          ([reason]) => (
            <UnreadNotice
              message={unreadMessageOf('在庫の行', reason)}
              onRetry={() => void rows.refetch()}
              retrying={rows.isFetching}
            />
          ),
        )
        // The salon was removed meanwhile, or the products could not be read
        .with(
          [
            { type: 'found' },
            { type: P.union('notFound', 'tooManyRequests', 'failed') },
          ],
          ([, reason]) => (
            <UnreadNotice
              message={unreadMessageOf('商品', reason)}
              onRetry={() => void products.refetch()}
              retrying={products.isFetching}
            />
          ),
        )
        .with([{ type: 'found', items: [] }, { type: 'found' }], () => (
          <EmptyState
            title='発注する在庫の行がありません'
            description='発注は、在庫の行ごとに作ります。在庫の行は、サロンのオーナーとマネージャーと、管理者が足します。'
            action={
              <ButtonLink href={inventoryHrefOf(salon.id)} variant='secondary'>
                在庫へ
              </ButtonLink>
            }
          />
        ))
        .with([{ type: 'found' }, { type: 'found' }], ([read, named]) => (
          <OrderForm
            rows={read.items}
            products={named.items}
            salon={salon}
            submitLabel='発注を作る'
            message={said.message}
            errors={said.errors}
            pending={entry.isPending}
            onSubmit={(values) => submit(values, read.items)}
            actions={
              <ButtonLink href={purchaseOrdersHrefOf(salon.id)} variant='quiet'>
                やめる
              </ButtonLink>
            }
          />
        ))
        .exhaustive()}
    </>
  )
}

/** A new purchase order of the salon of the address, for every member of its staff and an administrator. */
export const PurchaseOrderEntryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <EntryPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
