import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  moreOf,
  OtherSalonNotice,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { productEntryHrefOf, productHrefOf } from '../navigation'
import { ProductFilter } from './components/product-filter/product-filter'
import { ProductTable } from './components/product-table/product-table'
import { useKeepsProducts } from './keeps-products'
import { categoriesOf } from './product-format'
import {
  isNarrowed,
  productConditionsIn,
  productQueryOf,
  readProductConditions,
} from './product-ledger'
import { productsKeyOf, readProductPage, readProducts } from './products-api'

const TITLE = '商品台帳'

type ProductLedgerProps = {
  salon: ModelsSalonResponse
}

/**
 * The products of a salon, in the order of their codes, those it no
 * longer carries among them. The conditions are in the query of the
 * address, as those of the customers are: a reload, the way back from a
 * product and an address that is passed on show the same products. The
 * categories to choose from are those of all the products of the salon,
 * read beside the ledger; until they are, the category of the address is
 * the only one.
 */
const ProductLedger = ({ salon }: ProductLedgerProps) => {
  const keeps = useKeepsProducts()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const conditions = productConditionsIn(query)
  const asked = productQueryOf(conditions).toString()
  const narrowed = isNarrowed(conditions)
  const read = useInfiniteQuery({
    queryKey: [...productsKeyOf(salon.id), 'ledger', asked],
    queryFn: ({ pageParam }) =>
      readProductPage(salon.id, conditions, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: (page) =>
      page.type === 'forbidden' ? undefined : cursorAfter(page),
    // Products are added and changed by others: the ledger is read whenever it is shown
    staleTime: 0,
  })
  const all = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: () => readProducts(salon.id),
    // The categories of what others added belong among the choices
    staleTime: 0,
  })
  const pages = read.data?.pages ?? []

  const filter = (values: FormData): void => {
    const filled = readProductConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next = productQueryOf(filled.request)
    if (next.toString() === asked) {
      // The same products again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const entry = keeps ? (
    <ButtonLink href={productEntryHrefOf(salon.id)} variant='primary'>
      商品を足す
    </ButtonLink>
  ) : undefined

  if (pages[0]?.type === 'forbidden') {
    return (
      <>
        <PageHeader title={TITLE} description={salon.name} />
        <OtherSalonNotice what='商品' />
      </>
    )
  }

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} actions={entry} />
      <ProductFilter
        conditions={conditions}
        categories={categoriesOf(
          all.data?.type === 'found' ? all.data.items : [],
          conditions.category,
        )}
        errors={errors}
        clearHref={narrowed ? '?' : undefined}
        onSubmit={filter}
      />
      {match(
        read.data === undefined
          ? undefined
          : listingOf(
              // A page after the first is refused only when the account was
              // moved to another salon meanwhile: it ends the ledger there
              pages.map((page) => (page.type === 'forbidden' ? FAILED : page)),
            ),
      )
        .with(undefined, () => (
          <LoadingIndicator label='商品を読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('商品台帳', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title='条件に合う商品はありません'
              description='条件を変えて探してください。'
              actions={entry}
            />
          ) : (
            <EmptyState
              title='台帳に商品はありません'
              description={
                keeps
                  ? '店頭で売るものと、施術で使うものを足してください。'
                  : '商品を足せるのは、サロンのオーナーとマネージャーと、管理者です。'
              }
              actions={entry}
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <ProductTable
            // Other conditions are another list
            key={asked}
            caption={narrowed ? '条件に合う商品' : TITLE}
            rows={items}
            total={total}
            currency={salon.currency}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
            productHref={(productId) => productHrefOf(salon.id, productId)}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The product ledger of the salon of the address, for everybody who works there and an administrator. */
export const ProductsScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <ProductLedger key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
