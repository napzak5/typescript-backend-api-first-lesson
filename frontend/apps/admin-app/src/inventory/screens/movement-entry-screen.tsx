import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryMovementRequest,
  ModelsInventoryResponse,
  ModelsProductResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  NOTHING_TO_SAY,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { stockMovementsHrefOf, stockRowHrefOf } from '../../navigation'
import { stockKeyOf, stockRowKeyOf } from '../api/inventory-api'
import { recordMovement } from '../api/movements-api'
import { MovementForm } from '../components/movement-form/movement-form'
import { afterMovementRecord, readMovement } from '../utils/movement-form'
import { movementTypeNameOf, recordedKindsOf } from '../utils/movement-format'
import { productOf, quantityNameOf } from '../utils/stock-format'
import { useKeepsStock } from './keeps-stock'
import { WithStockRow } from './with-stock-row'

const TITLE = '在庫の移動を記録する'

type MovementEntryProps = {
  salon: ModelsSalonResponse
  row: ModelsInventoryResponse
  product: ModelsProductResponse | undefined
}

/**
 * The form of a movement of a row, of the kinds the account records. Once
 * it is recorded, the row and the stock that were read are dropped: their
 * stock changed. When the API says that the stock would fall below what is
 * reserved of it, the row is read anew, and the form says its stock.
 */
const MovementEntry = ({ salon, row, product }: MovementEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const keeps = useKeepsStock()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const offered = recordedKindsOf(keeps)
  const rowKey = stockRowKeyOf(row.id)

  const entry = useMutation({
    mutationFn: (request: ModelsInventoryMovementRequest) =>
      recordMovement(request),
    onSuccess: (outcome, request) =>
      match(outcome)
        .with({ type: 'recorded' }, ({ movement }) => {
          // The row, and its movements below it
          queryClient.removeQueries({ queryKey: rowKey })
          queryClient.removeQueries({ queryKey: stockKeyOf(salon.id) })
          notify({
            tone: 'success',
            message: `${movementTypeNameOf(movement.transactionType)}を記録しました。在庫数は ${quantityNameOf(movement.balanceAfter, product)} になりました。`,
          })
          void navigate(stockMovementsHrefOf(salon.id, row.id))
        })
        // The row was removed meanwhile
        .with({ type: 'notFound' }, () =>
          queryClient.setQueryData(rowKey, NOT_FOUND),
        )
        .with({ type: 'outOfRange' }, (refused) => {
          void queryClient.invalidateQueries({ queryKey: rowKey, exact: true })
          setSaid(afterMovementRecord(refused, request.quantity))
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterMovementRecord(refused, request.quantity)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readMovement(values, row, product, offered))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <MovementForm
      row={row}
      product={product}
      offered={offered}
      submitLabel='記録する'
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={stockRowHrefOf(salon.id, row.id)} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type EntryPartProps = {
  salon: ModelsSalonResponse
  inventoryId: string
}

/** The row, read whenever the screen opens: the movement starts from the stock it has now. */
const EntryPart = ({ salon, inventoryId }: EntryPartProps) => (
  <WithStockRow salon={salon} inventoryId={inventoryId} title={TITLE}>
    {(row, products) => (
      <MovementEntry
        salon={salon}
        row={row}
        product={productOf(products, row.productId)}
      />
    )}
  </WithStockRow>
)

/** The form of a movement of a stock row of the salon of the address, for everybody who works there and an administrator. */
export const MovementEntryScreen = () => {
  const { salonId = '', inventoryId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <EntryPart key={inventoryId} salon={salon} inventoryId={inventoryId} />
      )}
    </WithSalon>
  )
}
