import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import { productsKeyOf, readProducts } from '../products/products-api'
import { unreadMessageOf } from '../reading'
import { OtherSalonNotice } from '../salons/with-salon'
import { readStockRow, stockRowKeyOf } from './inventory-api'
import { StockRowNotFound } from './keeps-stock'

type WithStockRowProps = {
  salon: ModelsSalonResponse
  inventoryId: string
  /** The title of the screen */
  title: string
  /** What the header offers to do with the row, once the row and the products are read */
  actions?: ((row: ModelsInventoryResponse) => ReactNode) | undefined
  /** The screen of the row, below its heading, with the products of the salon that name it */
  children: (
    row: ModelsInventoryResponse,
    products: readonly ModelsProductResponse[],
  ) => ReactNode
}

/**
 * A screen of a stock row of the salon, with the products of the salon,
 * both read whenever the screen opens: the row names its product by its ID
 * alone. A row of another salon is not found at the address of this one.
 *
 * The heading stays the one element while the screen reads what it shows
 * below it, so that the focus the heading took when the screen opened
 * stays on it.
 */
export const WithStockRow = ({
  salon,
  inventoryId,
  title,
  actions,
  children,
}: WithStockRowProps) => {
  const row = useQuery({
    queryKey: stockRowKeyOf(inventoryId),
    queryFn: () => readStockRow(inventoryId),
    staleTime: 0,
  })
  const products = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: () => readProducts(salon.id),
    staleTime: 0,
  })
  const header = <PageHeader title={title} description={salon.name} />

  const loading = (
    <>
      {header}
      <LoadingIndicator label='在庫の行を読み込んでいます' />
    </>
  )

  return (
    match([row.data, products.data])
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
      .with(
        [{ type: P.union('tooManyRequests', 'failed') }, P._],
        ([reason]) => (
          <>
            {header}
            <UnreadNotice
              message={unreadMessageOf('在庫の行', reason)}
              onRetry={() => void row.refetch()}
              retrying={row.isFetching}
            />
          </>
        ),
      )
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
              retrying={products.isFetching}
            />
          </>
        ),
      )
      .with([{ type: 'found' }, { type: 'found' }], ([found, named]) => (
        <>
          <PageHeader
            title={title}
            description={salon.name}
            actions={actions?.(found.row)}
          />
          {children(found.row, named.items)}
        </>
      ))
      .exhaustive()
  )
}
