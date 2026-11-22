import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import {
  inventoryHrefOf,
  movementEntryHrefOf,
  stockMovementsHrefOf,
  stockRowChangeHrefOf,
} from '../../navigation'
import {
  readStaffProfiles,
  staffProfilesKeyOf,
} from '../../salons/api/salons-api'
import { StockRecord } from '../components/stock-record/stock-record'
import { productOf } from '../utils/stock-format'
import { useKeepsStock } from './keeps-stock'
import { WithStockRow } from './with-stock-row'

const TITLE = '在庫の行'

type StockRowPartProps = {
  salon: ModelsSalonResponse
  inventoryId: string
}

/**
 * A stock row of the salon, with the ways to its movements: everybody who
 * works at the salon records them and reads them. An account that keeps
 * the stock is offered to change the row. Who counted the row last is
 * named once the staff of the salon are read.
 */
const StockRowPart = ({ salon, inventoryId }: StockRowPartProps) => {
  const keeps = useKeepsStock()
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })

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
          <ButtonLink href={stockMovementsHrefOf(salon.id, row.id)}>
            在庫の移動の履歴
          </ButtonLink>
          {keeps && (
            <ButtonLink href={stockRowChangeHrefOf(salon.id, row.id)}>
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
            staff={match(staff.data)
              .with({ type: 'found' }, ({ items }) => items)
              .otherwise(() => undefined)}
          />
          <ButtonLink href={inventoryHrefOf(salon.id)}>在庫へ</ButtonLink>
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
