import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryResponse,
  ModelsInventoryUpdateRequest,
  ModelsProductResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  Button,
  ButtonLink,
  Dialog,
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
import { inventoryHrefOf, stockRowHrefOf } from '../navigation'
import { productsKeyOf, readProducts } from '../products/products-api'
import { StockForm } from './components/stock-form/stock-form'
import {
  changeStockRow,
  readStockRow,
  removeStockRow,
  type StockRowRead,
  stockKeyOf,
  stockRowKeyOf,
} from './inventory-api'
import { StockForbidden, StockRowNotFound, useKeepsStock } from './keeps-stock'
import {
  afterStockRemoval,
  afterStockWrite,
  productsChanged,
  readStockChange,
} from './stock-form'
import { productOf, stockRowNameOf } from './stock-format'

const TITLE = '在庫の行を直す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type StockChangeProps = {
  salon: ModelsSalonResponse
  row: ModelsInventoryResponse
  /** The products of the salon, among which the product of the row is looked for */
  products: readonly ModelsProductResponse[]
}

/**
 * The form of a stock row, opened with what the salon has of it now. It
 * sends what was changed and nothing else, and a form sent as it was
 * opened asks the API for nothing. When the API says that the product
 * was marked otherwise as to its lots meanwhile, the products are read
 * anew, and the form follows them. Beside the form, the row is removed
 * after a dialog; one that still counts stock stays.
 */
const StockChange = ({ salon, row, products }: StockChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const [removing, setRemoving] = useState(false)
  /** What went wrong with a removal that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  const key = stockRowKeyOf(row.id)
  const page = stockRowHrefOf(salon.id, row.id)
  const product = productOf(products, row.productId)
  const name = stockRowNameOf(row, product)

  /** The rows that were read are dropped: every view reads them anew */
  const forgetList = (): void =>
    queryClient.removeQueries({ queryKey: stockKeyOf(salon.id) })

  /** The row is not there any more: removed here, or by somebody else meanwhile */
  const gone = (): void => {
    forgetList()
    queryClient.setQueryData(key, NOT_FOUND)
  }

  const change = useMutation({
    mutationFn: (request: ModelsInventoryUpdateRequest) =>
      changeStockRow(row.id, request),
    onSuccess: (outcome, request) =>
      match(outcome)
        .with({ type: 'written' }, ({ row: changed }) => {
          const read: StockRowRead = { type: 'found', row: changed }
          queryClient.setQueryData(key, read)
          forgetList()
          notify({
            tone: 'success',
            message: `在庫の行「${stockRowNameOf(changed, product)}」を直しました。`,
          })
          void navigate(page)
        })
        .with({ type: 'notFound' }, gone)
        .with({ type: 'invalid' }, (refused) => {
          if (productsChanged(refused.values)) {
            void queryClient.invalidateQueries({
              queryKey: productsKeyOf(salon.id),
            })
          }
          setSaid(
            afterStockWrite(refused, typeof request.lotNumber === 'string'),
          )
        })
        .with(
          {
            type: P.union('lotTaken', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) =>
            setSaid(
              afterStockWrite(refused, typeof request.lotNumber === 'string'),
            ),
        )
        .exhaustive(),
  })

  const removal = useMutation({
    mutationFn: () => removeStockRow(row.id),
    onSuccess: (outcome) =>
      match(afterStockRemoval(outcome, name))
        .with({ type: 'done' }, ({ message: done }) => {
          gone()
          notify({ tone: 'success', message: done })
          void navigate(inventoryHrefOf(salon.id))
        })
        .with({ type: 'gone' }, gone)
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setRemoving(false)
          setSaid({ message: refused, errors: {} })
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readStockChange(values, row, product))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: '変更はありませんでした。' })
        void navigate(page)
      })
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        change.mutate(request)
      })
      .exhaustive()

  const close = (): void => {
    setRemoving(false)
    setMessage(undefined)
  }

  return (
    <>
      <StockForm
        row={row}
        products={products}
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
        title={`在庫の行「${name}」を削除しますか？`}
        description='在庫数が 0 の行だけを削除できます。この行の在庫の移動の記録は残ります。削除した行は、元に戻せません。'
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

type ChangePartProps = { salon: ModelsSalonResponse; inventoryId: string }

/**
 * The row of the address, read anew whenever the screen opens, so that
 * what the form writes on is what the salon holds now; the form once it
 * was, with the products as they are now, which say whether its lot is
 * asked for. It is not read again when the window comes back: the form
 * compares what is sent with what it was opened with.
 */
const ChangePart = ({ salon, inventoryId }: ChangePartProps) => {
  const row = useQuery({
    queryKey: stockRowKeyOf(inventoryId),
    queryFn: () => readStockRow(inventoryId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const products = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: () => readProducts(salon.id),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const header = <PageHeader title={TITLE} description={salon.name} />
  const loading = (
    <>
      {header}
      <LoadingIndicator label='在庫の行を読み込んでいます' />
    </>
  )

  return (
    match([
      row.isFetchedAfterMount ? row.data : undefined,
      products.isFetchedAfterMount ? products.data : undefined,
    ])
      .with([undefined, P._], () => loading)
      .with([{ type: 'notFound' }, P._], () => (
        <StockRowNotFound salon={salon} />
      ))
      .with([{ type: 'found', row: { salonId: P.not(salon.id) } }, P._], () => (
        <StockRowNotFound salon={salon} />
      ))
      .with([{ type: 'forbidden' }, P._], () => (
        <>
          {header}
          <OtherSalonNotice what='在庫' />
        </>
      ))
      .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([reason]) => (
        <>
          {header}
          <UnreadNotice
            message={unreadMessageOf('在庫の行', reason)}
            onRetry={() => void row.refetch()}
            pending={row.isFetching}
          />
        </>
      ))
      .with([{ type: 'found' }, undefined], () => loading)
      // The salon was removed meanwhile, or the products could not be read
      .with(
        [
          { type: 'found' },
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
        ],
        ([, reason]) => (
          <>
            {header}
            <UnreadNotice
              message={unreadMessageOf('商品', reason)}
              onRetry={() => void products.refetch()}
              pending={products.isFetching}
            />
          </>
        ),
      )
      .with([{ type: 'found' }, { type: 'found' }], ([found, named]) => (
        <>
          {header}
          <StockChange salon={salon} row={found.row} products={named.items} />
        </>
      ))
      .exhaustive()
  )
}

/** Changes a stock row of the salon of the address, and removes it, for the owner, a manager and an administrator. */
export const StockChangeScreen = () => {
  const { salonId = '', inventoryId = '' } = useParams()
  const keeps = useKeepsStock()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <ChangePart
            key={inventoryId}
            salon={salon}
            inventoryId={inventoryId}
          />
        ) : (
          <StockForbidden salon={salon} title={TITLE} />
        )
      }
    </WithSalon>
  )
}
