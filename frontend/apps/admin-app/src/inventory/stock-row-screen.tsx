import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { useParams } from 'react-router'
import {
  inventoryHrefOf,
  movementEntryHrefOf,
  stockMovementsHrefOf,
  stockRowChangeHrefOf,
} from '../navigation'
import { dayAt } from '../salon-time'
import { WithSalon } from '../salons/with-salon'
import { StockRecord } from './components/stock-record/stock-record'
import { useKeepsStock } from './keeps-stock'
import { productOf } from './stock-format'
import { WithStockRow } from './with-stock-row'

const TITLE = '在庫の行'

type StockRowPartProps = {
  salon: ModelsSalonResponse
  inventoryId: string
}

/**
 * A stock row of the salon, with the ways to its movements: everybody who
 * works at the salon records them and reads them. An account that keeps
 * the stock is offered to change the row.
 */
const StockRowPart = ({ salon, inventoryId }: StockRowPartProps) => {
  const keeps = useKeepsStock()

  return (
    <WithStockRow
      salon={salon}
      inventoryId={inventoryId}
      title={TITLE}
      actions={(row) => (
        <>
          <ButtonLink
            href={movementEntryHrefOf(salon.id, row.id)}
            variant='primary'
          >
            在庫の移動を記録する
          </ButtonLink>
          <ButtonLink
            href={stockMovementsHrefOf(salon.id, row.id)}
            variant='secondary'
          >
            在庫の移動の履歴
          </ButtonLink>
          {keeps && (
            <ButtonLink
              href={stockRowChangeHrefOf(salon.id, row.id)}
              variant='secondary'
            >
              在庫の行を直す
            </ButtonLink>
          )}
        </>
      )}
    >
      {(row, products) => (
        <>
          <StockRecord
            row={row}
            product={productOf(products, row.productId)}
            today={dayAt(new Date(), salon.timezone)}
            timezone={salon.timezone}
          />
          <p>
            <ButtonLink href={inventoryHrefOf(salon.id)} variant='secondary'>
              在庫へ
            </ButtonLink>
          </p>
        </>
      )}
    </WithStockRow>
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
