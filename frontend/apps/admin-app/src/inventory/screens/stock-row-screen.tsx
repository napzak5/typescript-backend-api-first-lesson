import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink, useSay } from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
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

const { record, titles, words } = adminInventoryMessages

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
  const say = useSay()
  const keeps = useKeepsStock()
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })

  return (
    <WithStockRow
      salon={salon}
      inventoryId={inventoryId}
      title={titles.row}
      actions={(row) => (
        <>
          <ButtonLink
            href={movementEntryHrefOf(salon.id, row.id)}
            variant='primary'
          >
            {say(words.recordMovement)}
          </ButtonLink>
          <ButtonLink href={stockMovementsHrefOf(salon.id, row.id)}>
            {say(record.history)}
          </ButtonLink>
          {keeps && (
            <ButtonLink href={stockRowChangeHrefOf(salon.id, row.id)}>
              {say(record.change)}
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
          <ButtonLink href={inventoryHrefOf(salon.id)}>
            {say(words.toInventory)}
          </ButtonLink>
        </>
      )}
    </WithStockRow>
  )
}

/** A stock row of the salon of the address, for everybody who works there and an administrator. */
export const StockRowScreen = () => {
  const say = useSay()
  const { salonId = '', inventoryId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.row)}>
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
