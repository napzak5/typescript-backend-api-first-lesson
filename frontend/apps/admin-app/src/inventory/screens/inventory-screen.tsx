import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsProductResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  moreOf,
  Navigation,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  inventoryHrefOf,
  stockAlertsHrefOf,
  stockCountHrefOf,
  stockEntryHrefOf,
  stockRowHrefOf,
  stockValueHrefOf,
} from '../../navigation'
import { productsKeyOf, readProducts } from '../../products/api/products-api'
import { readStockPage, stockKeyOf } from '../api/inventory-api'
import { StockFilter } from '../components/stock-filter/stock-filter'
import { StockTable } from '../components/stock-table/stock-table'
import { viewItemsOf } from '../utils/stock-format'
import {
  isNarrowed,
  readExpiryWindow,
  readStockConditions,
  type StockView,
  stockQueryOf,
  stockViewIn,
} from '../utils/stock-view'
import { useKeepsStock } from './keeps-stock'

const { names, stock, titles } = adminInventoryMessages

/** What a view is called above its rows, and what it says when it has none */
type ViewWords = {
  caption: LocalizedText
  empty: LocalizedText
  emptyDescription: LocalizedText
}

const wordsOf = (view: StockView, keeps: boolean): ViewWords =>
  match(view)
    .returnType<ViewWords>()
    .with({ type: 'lowStock' }, () => stock.lowStock)
    .with({ type: 'expiring' }, () => stock.expiring)
    .with({ type: 'all' }, (all) =>
      isNarrowed(all)
        ? stock.narrowed
        : {
            caption: stock.all.caption,
            empty: stock.all.empty,
            emptyDescription: keeps
              ? stock.all.keeperDescription
              : stock.all.staffDescription,
          },
    )
    .exhaustive()

type StockLedgerProps = { salon: ModelsSalonResponse }

/**
 * The stock of a salon, in the view of the address: every row, in the
 * order of the codes of the products and their lots, narrowed to a
 * product or a lot; the rows of the products whose stock is low; or the
 * rows that expire within a window of days, in the order of their
 * expiry. A reload, the way back from a row and an address that is passed
 * on show the same view. A row names its product by its ID alone: the
 * products of the salon are read beside the rows, whenever the screen
 * opens, and the rows are shown once the products that name them are there.
 */
const StockLedger = ({ salon }: StockLedgerProps) => {
  const say = useSay()
  const keeps = useKeepsStock()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors<LocalizedText> | undefined>(
    undefined,
  )
  const view = stockViewIn(query)
  const asked = stockQueryOf(view).toString()
  const words = wordsOf(view, keeps)
  const read = useInfiniteQuery({
    queryKey: [...stockKeyOf(salon.id), 'page', asked],
    queryFn: ({ pageParam }) => readStockPage(salon.id, view, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: (page) =>
      page.type === 'forbidden' ? undefined : cursorAfter(page),
    // Stock is moved by others all day: it is read whenever it is shown
    staleTime: 0,
  })
  const products = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: () => readProducts(salon.id),
    staleTime: 0,
  })
  const pages = read.data?.pages ?? []

  const show = (shown: StockView): void => {
    const next = stockQueryOf(shown)
    if (next.toString() === asked) {
      // The same rows again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const filter = (values: FormData): void => {
    if (view.type === 'expiring') {
      show(readExpiryWindow(values))
      return
    }
    const filled = readStockConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    show(filled.value)
  }

  const entry = keeps ? (
    <ButtonLink href={stockEntryHrefOf(salon.id)} variant='primary'>
      {say(stock.addRow)}
    </ButtonLink>
  ) : undefined
  // Every member of the staff sees to the alerts
  const alerts = (
    <ButtonLink href={stockAlertsHrefOf(salon.id)}>
      {say(stock.alerts)}
    </ButtonLink>
  )
  // Who keeps the stock adds rows to it, and has the alerts, the count and
  // the value as other actions
  const header = keeps
    ? {
        actions: entry,
        otherActions: (
          <>
            {alerts}
            <ButtonLink href={stockCountHrefOf(salon.id)}>
              {say(stock.count)}
            </ButtonLink>
            <ButtonLink href={stockValueHrefOf(salon.id)}>
              {say(stock.value)}
            </ButtonLink>
          </>
        ),
      }
    : { actions: alerts, otherActions: undefined }

  if (pages[0]?.type === 'forbidden') {
    return (
      <>
        <PageHeader title={say(titles.inventory)} description={salon.name} />
        <OtherSalonNotice what={names.inventoryOfTheSalon} />
      </>
    )
  }

  const shown = (named: readonly ModelsProductResponse[]): ReactNode => (
    <>
      {match(view)
        .with({ type: 'lowStock' }, () => <p>{say(stock.lowStockAbout)}</p>)
        .with({ type: P.union('all', 'expiring') }, (narrowing) => (
          <StockFilter
            view={narrowing}
            products={named}
            errors={errors}
            clearHref={isNarrowed(narrowing) ? '?' : undefined}
            onSubmit={filter}
          />
        ))
        .exhaustive()}
      {match(
        read.data === undefined
          ? undefined
          : listingOf(
              // A page after the first is refused only when the account was
              // moved to another salon meanwhile: it ends the rows there
              pages.map((page) => (page.type === 'forbidden' ? FAILED : page)),
            ),
      )
        .with(undefined, () => <LoadingIndicator label={say(stock.loading)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.inventory, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState
            title={say(words.empty)}
            description={say(words.emptyDescription)}
            actions={view.type === 'all' ? entry : undefined}
          />
        ))
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <StockTable
            // Another view is another list
            key={asked}
            caption={words.caption}
            rows={items}
            products={named}
            today={dayAt(new Date(), salon.timezone)}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
            rowHref={(inventoryId) => stockRowHrefOf(salon.id, inventoryId)}
          />
        ))
        .exhaustive()}
    </>
  )

  return (
    <>
      <PageHeader
        title={say(titles.inventory)}
        description={salon.name}
        actions={header.actions}
        otherActions={header.otherActions}
      />
      <Navigation
        label={say(stock.viewsLabel)}
        items={viewItemsOf(view, inventoryHrefOf(salon.id)).map((item) => ({
          ...item,
          label: say(item.label),
        }))}
      />
      {match(products.data)
        .with(undefined, () => <LoadingIndicator label={say(stock.loading)} />)
        .with({ type: 'found' }, ({ items }) => shown(items))
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

/** The stock of the salon of the address, for everybody who works there and an administrator. */
export const InventoryScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.inventory)}>
      {(salon) => <StockLedger key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
