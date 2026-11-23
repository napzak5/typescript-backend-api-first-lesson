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
  aboutTheAttempt,
  Button,
  ButtonLink,
  Dialog,
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
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { inventoryHrefOf, stockRowHrefOf } from '../../navigation'
import { productsKeyOf, readProducts } from '../../products/api/products-api'
import {
  changeStockRow,
  readStockRow,
  removeStockRow,
  type StockRowRead,
  stockKeyOf,
  stockRowKeyOf,
} from '../api/inventory-api'
import { StockForm } from '../components/stock-form/stock-form'
import {
  afterStockRemoval,
  afterStockWrite,
  productsChanged,
  readStockChange,
} from '../utils/stock-form'
import { productOf, stockRowNameOf } from '../utils/stock-format'
import { StockForbidden, StockRowNotFound, useKeepsStock } from './keeps-stock'

const { form, names, removal: words, titles } = adminInventoryMessages

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
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [removing, setRemoving] = useState(false)
  /** What went wrong with a removal that can be made again: said in the dialog */
  const [message, setMessage] = useState<LocalizedText>()
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
            message: adminInventoryMessages.changed(
              stockRowNameOf(changed, product),
            ),
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
          setSaid(aboutTheAttempt(refused))
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readStockChange(values, row, product))
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
      <StockForm
        row={row}
        products={products}
        submitLabel={say(form.save)}
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={submit}
        actions={
          <>
            <ButtonLink href={page} variant='quiet'>
              {say(form.cancel)}
            </ButtonLink>
            <Button variant='danger' onClick={() => setRemoving(true)}>
              {say(form.remove)}
            </Button>
          </>
        }
      />
      <Dialog
        open={removing}
        onClose={close}
        title={say(words.confirm(name))}
        description={say(words.description)}
        actions={
          <>
            <Button onClick={close}>{say(words.back)}</Button>
            <Button
              variant='danger'
              pending={removal.isPending}
              onClick={() => {
                setMessage(undefined)
                removal.mutate()
              }}
            >
              {say(words.confirmRemoval)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
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
  const say = useSay()
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
  const header = (
    <PageHeader title={say(titles.change)} description={salon.name} />
  )
  const loading = (
    <>
      {header}
      <LoadingIndicator label={say(adminInventoryMessages.words.loadingRow)} />
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
          <OtherSalonNotice what={names.inventoryOfTheSalon} />
        </>
      ))
      .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([reason]) => (
        <>
          {header}
          <UnreadNotice
            message={say(unreadMessageOf(names.row, reason))}
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
              message={say(unreadMessageOf(names.products, reason))}
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
  const say = useSay()
  const { salonId = '', inventoryId = '' } = useParams()
  const keeps = useKeepsStock()

  return (
    <WithSalon salonId={salonId} title={say(titles.change)}>
      {(salon) =>
        keeps ? (
          <ChangePart
            key={inventoryId}
            salon={salon}
            inventoryId={inventoryId}
          />
        ) : (
          <StockForbidden salon={salon} title={titles.change} />
        )
      }
    </WithSalon>
  )
}
