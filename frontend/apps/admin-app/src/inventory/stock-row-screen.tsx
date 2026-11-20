import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { inventoryHrefOf, stockRowChangeHrefOf } from '../navigation'
import { productsKeyOf, readProducts } from '../products/products-api'
import { unreadMessageOf } from '../reading'
import { dayAt } from '../salon-time'
import { OtherSalonNotice, WithSalon } from '../salons/with-salon'
import { StockRecord } from './components/stock-record/stock-record'
import { readStockRow, stockRowKeyOf } from './inventory-api'
import { StockRowNotFound, useKeepsStock } from './keeps-stock'
import { productOf } from './stock-format'

const TITLE = '在庫の行'

type StockRowPartProps = {
  salon: ModelsSalonResponse
  inventoryId: string
}

/**
 * A stock row of the salon, read whenever the screen opens, with the
 * products that name it. A row of another salon is not found at the
 * address of this one. An account that keeps the stock is offered to
 * change the row.
 */
const StockRowPart = ({ salon, inventoryId }: StockRowPartProps) => {
  const keeps = useKeepsStock()
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
  const header = <PageHeader title={TITLE} description={salon.name} />

  return (
    match([row.data, products.data])
      .with([undefined, P._], () => (
        <>
          {header}
          <LoadingIndicator label='在庫の行を読み込んでいます' />
        </>
      ))
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
      .with([{ type: 'found' }, undefined], () => (
        <>
          {header}
          <LoadingIndicator label='在庫の行を読み込んでいます' />
        </>
      ))
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
            title={TITLE}
            description={salon.name}
            actions={
              keeps ? (
                <ButtonLink
                  href={stockRowChangeHrefOf(salon.id, found.row.id)}
                  variant='primary'
                >
                  在庫の行を直す
                </ButtonLink>
              ) : undefined
            }
          />
          <StockRecord
            row={found.row}
            product={productOf(named.items, found.row.productId)}
            today={dayAt(new Date(), salon.timezone)}
            timezone={salon.timezone}
          />
          <p>
            <ButtonLink href={inventoryHrefOf(salon.id)} variant='secondary'>
              在庫へ
            </ButtonLink>
          </p>
        </>
      ))
      .exhaustive()
  )
}

/** A stock row of the salon of the address, for everybody who works there and an administrator. */
export const StockRowScreen = () => {
  const { salonId = '', inventoryId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <StockRowPart
          key={inventoryId}
          salon={salon}
          inventoryId={inventoryId}
        />
      )}
    </WithSalon>
  )
}
