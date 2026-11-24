import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { productEntryHrefOf, productHrefOf } from '../../navigation'
import {
  productsKeyOf,
  readProductPage,
  readProducts,
} from '../api/products-api'
import { ProductFilter } from '../components/product-filter/product-filter'
import { ProductTable } from '../components/product-table/product-table'
import { categoriesOf } from '../utils/product-format'
import {
  isNarrowed,
  productConditionsIn,
  productQueryOf,
  readProductConditions,
} from '../utils/product-ledger'
import { useKeepsProducts } from './keeps-products'

const { ledger, loading, names, titles } = adminProductMessages

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
  const say = useSay()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors<LocalizedText> | undefined>(
    undefined,
  )
  const conditions = productConditionsIn(query)
  const asked = productQueryOf(conditions).toString()
  const narrowed = isNarrowed(conditions)
  const read = useInfiniteQuery({
    queryKey: [...productsKeyOf(salon.id), 'ledger', asked],
    queryFn: ({ pageParam }) =>
      readProductPage(salon.id, conditions, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
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
    const next = productQueryOf(filled.value)
    if (next.toString() === asked) {
      // The same products again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const entry = keeps ? (
    <ButtonLink href={productEntryHrefOf(salon.id)} variant='primary'>
      {say(ledger.entry)}
    </ButtonLink>
  ) : undefined

  if (pages[0]?.type === 'forbidden') {
    return (
      <>
        <PageHeader title={say(titles.ledger)} description={salon.name} />
        <OtherSalonNotice what={names.productsOfTheSalon} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={say(titles.ledger)}
        description={salon.name}
        actions={entry}
      />
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
          <LoadingIndicator label={say(loading.products)} />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.ledger, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title={say(ledger.noneMatching)}
              description={say(ledger.noneMatchingDescription)}
              actions={entry}
            />
          ) : (
            <EmptyState
              title={say(ledger.empty)}
              description={say(
                keeps ? ledger.keeperDescription : ledger.otherDescription,
              )}
              actions={entry}
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <ProductTable
            // Other conditions are another list
            key={asked}
            caption={say(narrowed ? ledger.narrowedCaption : titles.ledger)}
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
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.ledger)}>
      {(salon) => <ProductLedger key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
