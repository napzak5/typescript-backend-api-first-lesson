import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
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
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  movementEntryHrefOf,
  stockMovementsHrefOf,
  stockRowHrefOf,
} from '../navigation'
import { readStaffProfiles, staffProfilesKeyOf } from '../salons/salons-api'
import { MovementFilter } from './components/movement-filter/movement-filter'
import { MovementTable } from './components/movement-table/movement-table'
import { stockRowKeyOf } from './inventory-api'
import {
  isNarrowedHistory,
  movementConditionsIn,
  movementQueryOf,
  readMovementConditions,
} from './movement-search'
import { movementsKeyOf, readMovementPage } from './movements-api'
import { productOf, quantityNameOf, stockRowNameOf } from './stock-format'
import { WithStockRow } from './with-stock-row'

const TITLE = '在庫の移動'

/** The way to record a movement of a row, in the header and when it has none */
const RecordMovement = ({
  salon,
  row,
}: {
  salon: ModelsSalonResponse
  row: ModelsInventoryResponse
}) => (
  <ButtonLink href={movementEntryHrefOf(salon.id, row.id)} variant='primary'>
    在庫の移動を記録する
  </ButtonLink>
)

type MovementHistoryProps = {
  salon: ModelsSalonResponse
  row: ModelsInventoryResponse
  product: ModelsProductResponse | undefined
  staff: readonly ModelsStaffProfileResponse[]
}

/**
 * The movements of a stock row, the latest first, narrowed to a kind and
 * to days at the salon; the conditions are kept in the address. They are
 * read whenever the screen opens: everybody who works at the salon records
 * them.
 */
const MovementHistory = ({
  salon,
  row,
  product,
  staff,
}: MovementHistoryProps) => {
  const queryClient = useQueryClient()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const conditions = movementConditionsIn(query)
  const asked = movementQueryOf(conditions).toString()
  const narrowed = isNarrowedHistory(conditions)
  const read = useInfiniteQuery({
    queryKey: [...movementsKeyOf(row.id), asked],
    queryFn: ({ pageParam }) =>
      readMovementPage(row.id, conditions, salon.timezone, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: (page) =>
      page.type === 'notFound' || page.type === 'forbidden'
        ? undefined
        : cursorAfter(page),
    staleTime: 0,
  })
  const pages = read.data?.pages ?? []
  const gone = pages[0]?.type === 'notFound'

  useEffect(() => {
    if (gone) {
      // The row was removed after it was read: the screen says so in its place
      queryClient.setQueryData(stockRowKeyOf(row.id), NOT_FOUND)
    }
  }, [gone, queryClient, row.id])

  const filter = (values: FormData): void => {
    const filled = readMovementConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next = movementQueryOf(filled.value)
    if (next.toString() === asked) {
      // The same movements again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  return match(pages[0])
    .with({ type: 'notFound' }, () => (
      <LoadingIndicator label='在庫の移動を読み込んでいます' />
    ))
    .with({ type: 'forbidden' }, () => <OtherSalonNotice what='在庫' />)
    .otherwise(() => (
      <>
        <p>
          {`${stockRowNameOf(row, product)}。在庫数は ${quantityNameOf(row.currentStock, product)} です。`}
        </p>
        <MovementFilter
          conditions={conditions}
          errors={errors}
          clearHref={
            narrowed ? stockMovementsHrefOf(salon.id, row.id) : undefined
          }
          onSubmit={filter}
        />
        {match(
          read.data === undefined
            ? undefined
            : listingOf(
                // A page after the first is refused only when the row was
                // removed, or the account moved, meanwhile: it ends the list there
                pages.map((page) =>
                  page.type === 'notFound' || page.type === 'forbidden'
                    ? FAILED
                    : page,
                ),
              ),
        )
          .with(undefined, () => (
            <LoadingIndicator label='在庫の移動を読み込んでいます' />
          ))
          .with({ type: 'unread' }, ({ reason }) => (
            <UnreadNotice
              message={unreadMessageOf('在庫の移動', reason)}
              onRetry={() => void read.refetch()}
              pending={read.isFetching}
            />
          ))
          .with({ type: 'listed', items: [] }, () =>
            narrowed ? (
              <EmptyState
                title='条件に合う在庫の移動はありません'
                description='条件を変えて、見直してください。'
              />
            ) : (
              <EmptyState
                title='在庫の移動はありません'
                description='仕入れ、販売、施術での使用などを記録すると、ここに出ます。'
                actions={<RecordMovement salon={salon} row={row} />}
              />
            ),
          )
          .with({ type: 'listed' }, ({ items, total, rest }) => (
            <MovementTable
              // Other conditions are another list
              key={asked}
              caption={narrowed ? '条件に合う在庫の移動' : TITLE}
              movements={items}
              product={product}
              staff={staff}
              timezone={salon.timezone}
              currency={salon.currency}
              total={total}
              more={moreOf(rest, {
                nextPage: read.isFetchingNextPage,
                again: read.isRefetching,
              })}
              onMore={() =>
                void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
              }
            />
          ))
          .exhaustive()}
        <ButtonLink href={stockRowHrefOf(salon.id, row.id)}>
          在庫の行へ
        </ButtonLink>
      </>
    ))
}

type MovementsPartProps = {
  salon: ModelsSalonResponse
  inventoryId: string
}

/** The row, the products that name it, and the staff who record its movements: all of them before the movements. */
const MovementsPart = ({ salon, inventoryId }: MovementsPartProps) => {
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })

  return (
    <WithStockRow
      salon={salon}
      inventoryId={inventoryId}
      title={TITLE}
      actions={(row) => <RecordMovement salon={salon} row={row} />}
    >
      {(row, products) =>
        match(staff.data)
          .with(undefined, () => (
            <LoadingIndicator label='在庫の移動を読み込んでいます' />
          ))
          .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
            <UnreadNotice
              message={unreadMessageOf('スタッフ', reason)}
              onRetry={() => void staff.refetch()}
              pending={staff.isFetching}
            />
          ))
          .with({ type: 'found' }, ({ items }) => (
            <MovementHistory
              salon={salon}
              row={row}
              product={productOf(products, row.productId)}
              staff={items}
            />
          ))
          .exhaustive()
      }
    </WithStockRow>
  )
}

/** The movements of a stock row of the salon of the address, for everybody who works there and an administrator. */
export const MovementsScreen = () => {
  const { salonId = '', inventoryId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <MovementsPart
          key={inventoryId}
          salon={salon}
          inventoryId={inventoryId}
        />
      )}
    </WithSalon>
  )
}
