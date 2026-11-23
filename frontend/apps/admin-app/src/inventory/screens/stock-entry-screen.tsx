import { NOT_FOUND, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryCreateRequest,
  ModelsProductResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { salonKeyOf, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormSays,
  LoadingIndicator,
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
import {
  inventoryHrefOf,
  productEntryHrefOf,
  stockRowHrefOf,
} from '../../navigation'
import { productsKeyOf, readProducts } from '../../products/api/products-api'
import {
  addStockRow,
  type StockRowRead,
  stockKeyOf,
  stockRowKeyOf,
} from '../api/inventory-api'
import { StockForm } from '../components/stock-form/stock-form'
import {
  afterStockWrite,
  productsChanged,
  readStockEntry,
} from '../utils/stock-form'
import { productOf, stockRowNameOf } from '../utils/stock-format'
import { StockForbidden, useKeepsStock } from './keeps-stock'

const { entry: words, form, names, titles } = adminInventoryMessages

type StockEntryProps = {
  salon: ModelsSalonResponse
  /** The products the salon carries, in the order of their codes */
  carried: readonly ModelsProductResponse[]
}

/**
 * The form of a new stock row, of a product the salon carries. The rows
 * that were read are dropped: the new one belongs among them. When the
 * API says that a product was removed or marked otherwise meanwhile, the
 * products are read anew, and the form follows them.
 */
const StockEntry = ({ salon, carried }: StockEntryProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const entry = useMutation({
    mutationFn: (request: ModelsInventoryCreateRequest) => addStockRow(request),
    onSuccess: (outcome, request) =>
      match(outcome)
        .with({ type: 'written' }, ({ row }) => {
          const read: StockRowRead = { type: 'found', row }
          queryClient.setQueryData(stockRowKeyOf(row.id), read)
          queryClient.removeQueries({ queryKey: stockKeyOf(salon.id) })
          notify({
            tone: 'success',
            message: adminInventoryMessages.added(
              stockRowNameOf(row, productOf(carried, row.productId)),
            ),
          })
          void navigate(stockRowHrefOf(salon.id, row.id))
        })
        // The salon was removed meanwhile
        .with({ type: 'notFound' }, () =>
          queryClient.setQueryData(salonKeyOf(salon.id), NOT_FOUND),
        )
        .with({ type: 'invalid' }, (refused) => {
          if (productsChanged(refused.values)) {
            void queryClient.invalidateQueries({
              queryKey: productsKeyOf(salon.id),
            })
          }
          setSaid(afterStockWrite(refused, request.lotNumber !== null))
        })
        .with(
          {
            type: P.union('lotTaken', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) =>
            setSaid(afterStockWrite(refused, request.lotNumber !== null)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readStockEntry(values, salon.id, carried))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <StockForm
      row={null}
      products={carried}
      submitLabel={say(form.add)}
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={inventoryHrefOf(salon.id)} variant='quiet'>
          {say(form.cancel)}
        </ButtonLink>
      }
    />
  )
}

type EntryPartProps = { salon: ModelsSalonResponse }

/**
 * The products the salon carries, read whenever the screen opens: those
 * that were added meanwhile are among them. A salon that carries none is
 * led to add one first.
 */
const EntryPart = ({ salon }: EntryPartProps) => {
  const say = useSay()
  const products = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: () => readProducts(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={say(titles.entry)} description={salon.name} />
      {match(products.data)
        .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
        .with({ type: 'found' }, ({ items }) => {
          const carried = items.filter(({ isActive }) => isActive)

          return carried.length === 0 ? (
            <EmptyState
              title={say(words.noProducts)}
              description={say(words.noProductsDescription)}
              actions={
                <ButtonLink
                  href={productEntryHrefOf(salon.id)}
                  variant='primary'
                >
                  {say(words.addProduct)}
                </ButtonLink>
              }
            />
          ) : (
            <StockEntry salon={salon} carried={carried} />
          )
        })
        // The salon was removed meanwhile, or the products could not be read
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.products, reason))}
              onRetry={() => void products.refetch()}
              pending={products.isFetching}
            />
          ),
        )
        .exhaustive()}
    </>
  )
}

/** Adds a stock row to the salon of the address, for the owner, a manager and an administrator. */
export const StockEntryScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const keeps = useKeepsStock()

  return (
    <WithSalon salonId={salonId} title={say(titles.entry)}>
      {(salon) =>
        keeps ? (
          <EntryPart key={salon.id} salon={salon} />
        ) : (
          <StockForbidden salon={salon} title={titles.entry} />
        )
      }
    </WithSalon>
  )
}
