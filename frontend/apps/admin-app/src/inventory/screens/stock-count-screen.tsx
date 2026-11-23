import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryResponse,
  ModelsInventoryStockCountRequest,
  ModelsInventoryStockCountResponse,
  ModelsProductResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  ButtonLink,
  EmptyState,
  type FormSays,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  inventoryHrefOf,
  stockEntryHrefOf,
  stockRowHrefOf,
} from '../../navigation'
import { productsKeyOf, readProducts } from '../../products/api/products-api'
import { countStock } from '../api/count-api'
import {
  everyStockRowKeyOf,
  readEveryStockRow,
  stockKeyOf,
  stockRowKeyOf,
} from '../api/inventory-api'
import { CountForm } from '../components/count-form/count-form'
import { CountResult } from '../components/count-result/count-result'
import { afterStockCount, readStockCount } from '../utils/stock-count'
import { StockForbidden, useKeepsStock } from './keeps-stock'

const { names, titles, words } = adminInventoryMessages
const counting = adminInventoryMessages.count

/** A count that was recorded, with the rows and the products it was entered on */
type Counted = {
  result: ModelsInventoryStockCountResponse
  rows: readonly ModelsInventoryResponse[]
  products: readonly ModelsProductResponse[]
}

/** What a count is sent with: the rows and the products the form showed */
type Sent = {
  request: ModelsInventoryStockCountRequest
  rows: readonly ModelsInventoryResponse[]
  products: readonly ModelsProductResponse[]
}

/**
 * A count of the stock of the salon: every row of it, read whenever the
 * screen opens, with what the books say of it. Once the count is recorded,
 * the screen says which rows differed, and the stock that was read is
 * dropped: the rows counted were changed. When the API says that the rows
 * changed meanwhile, they are read anew, and the counts entered stay.
 */
const CountPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const focusHeading = useScreenHeadingFocus()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [counted, setCounted] = useState<Counted | undefined>(undefined)
  const shownBefore = useRef(counted)
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

  // The form, or the result, took the place of what had the focus
  useLayoutEffect(() => {
    if (shownBefore.current !== counted) {
      focusHeading()
    }
    shownBefore.current = counted
  }, [counted, focusHeading])

  const count = useMutation({
    mutationFn: ({ request }: Sent) => countStock(request),
    onSuccess: (outcome, sent) =>
      match(outcome)
        .with({ type: 'counted' }, ({ result }) => {
          // What was read of the stock is gone, the rows of this screen as
          // well: the form comes back with the rows read anew
          queryClient.removeQueries({ queryKey: stockKeyOf(salon.id) })
          for (const { inventoryId } of sent.request.items) {
            // The row, and its movements below it
            queryClient.removeQueries({ queryKey: stockRowKeyOf(inventoryId) })
          }
          notify({
            tone: 'success',
            message: counting.done(
              sent.request.items.length,
              result.discrepancies.length,
            ),
          })
          setCounted({ result, rows: sent.rows, products: sent.products })
        })
        .with({ type: P.union('rowsChanged', 'belowReserved') }, (refused) => {
          void queryClient.invalidateQueries({
            queryKey: everyStockRowKeyOf(salon.id),
            exact: true,
          })
          setSaid(afterStockCount(refused, sent.request))
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterStockCount(refused, sent.request)),
        )
        .exhaustive(),
  })

  const submit = (
    values: FormData,
    read: readonly ModelsInventoryResponse[],
    named: readonly ModelsProductResponse[],
  ): void =>
    match(readStockCount(values, salon.id, read, named))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        count.mutate({ request: value, rows: read, products: named })
      })
      .exhaustive()

  const shown =
    counted === undefined ? (
      match([rows.data, products.data])
        .with([undefined, P._], [{ type: 'found' }, undefined], () => (
          <LoadingIndicator label={say(counting.loading)} />
        ))
        .with([{ type: 'forbidden' }, P._], () => (
          <OtherSalonNotice what={names.inventoryOfTheSalon} />
        ))
        .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([reason]) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.row, reason))}
            onRetry={() => void rows.refetch()}
            pending={rows.isFetching}
          />
        ))
        // The salon was removed meanwhile, or the products could not be read
        .with(
          [
            { type: 'found' },
            { type: P.union('notFound', 'tooManyRequests', 'failed') },
          ],
          ([, reason]) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.products, reason))}
              onRetry={() => void products.refetch()}
              pending={products.isFetching}
            />
          ),
        )
        .with([{ type: 'found', items: [] }, { type: 'found' }], () => (
          <EmptyState
            title={say(counting.noRows)}
            description={say(counting.noRowsDescription)}
            actions={
              <ButtonLink href={stockEntryHrefOf(salon.id)} variant='primary'>
                {say(words.addRow)}
              </ButtonLink>
            }
          />
        ))
        .with([{ type: 'found' }, { type: 'found' }], ([read, named]) => (
          <CountForm
            rows={read.items}
            products={named.items}
            submitLabel={say(counting.form.record)}
            message={said.message}
            errors={said.errors}
            pending={count.isPending}
            onSubmit={(values) => submit(values, read.items, named.items)}
            actions={
              <ButtonLink href={inventoryHrefOf(salon.id)} variant='quiet'>
                {say(counting.form.cancel)}
              </ButtonLink>
            }
          />
        ))
        .exhaustive()
    ) : (
      <>
        <CountResult
          discrepancies={counted.result.discrepancies}
          rows={counted.rows}
          products={counted.products}
          rowHref={(inventoryId) => stockRowHrefOf(salon.id, inventoryId)}
        />
        <p>
          <ButtonLink href={inventoryHrefOf(salon.id)} variant='primary'>
            {say(words.toInventory)}
          </ButtonLink>{' '}
          <Button onClick={() => setCounted(undefined)}>
            {say(counting.result.again)}
          </Button>
        </p>
      </>
    )

  return (
    <>
      <PageHeader title={say(titles.count)} description={salon.name} />
      {shown}
    </>
  )
}

/** The count of the stock of the salon of the address, for its owner, a manager and an administrator. */
export const StockCountScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const keeps = useKeepsStock()

  return (
    <WithSalon salonId={salonId} title={say(titles.count)}>
      {(salon) =>
        keeps ? (
          <CountPart key={salon.id} salon={salon} />
        ) : (
          <StockForbidden
            salon={salon}
            title={titles.count}
            message={counting.forbidden}
          />
        )
      }
    </WithSalon>
  )
}
