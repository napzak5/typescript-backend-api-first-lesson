import {
  CHECK_THE_VALUES_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryResponse,
  ModelsInventoryStockCountItem,
  ModelsInventoryStockCountRequest,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { levelOf } from '../../products/utils/product-form'
import { hundredthsOf } from '../../products/utils/quantity'
import type { StockCount } from '../api/count-api'
import { productOf, quantityNameOf } from './stock-format'

/*
 * How the form of a count is read, and what it says when the API did not
 * take it. A row whose count is left empty is not counted: a salon counts
 * its stock shelf by shelf, in as many counts as it likes.
 */

/** The most rows one count holds */
const MOST_ROWS = 500

const { count } = adminInventoryMessages
const { errors: words } = count

/** The name of the control of what was counted of a row */
export const countedControlOf = (inventoryId: string): string =>
  `counted.${inventoryId}`

/** What a row of the form holds: nothing when it was not counted */
type CountedRow =
  | { type: 'counted'; item: ModelsInventoryStockCountItem }
  | { type: 'notCounted' }
  | { type: 'wrong'; control: string; message: LocalizedText }

const countedRowOf = (
  values: FormData,
  row: Pick<ModelsInventoryResponse, 'id' | 'productId' | 'reservedStock'>,
  products: readonly ModelsProductResponse[],
): CountedRow => {
  const control = countedControlOf(row.id)
  const counted = levelOf(textOf(values, control))
  if (counted === null) {
    return { type: 'notCounted' }
  }
  if (counted === undefined) {
    return { type: 'wrong', control, message: words.count }
  }
  if (hundredthsOf(counted) < hundredthsOf(row.reservedStock)) {
    return {
      type: 'wrong',
      control,
      message: words.belowReserved(
        quantityNameOf(row.reservedStock, productOf(products, row.productId)),
      ),
    }
  }

  return {
    type: 'counted',
    item: { inventoryId: row.id, countedQuantity: counted },
  }
}

/**
 * A count of the rows that were counted, in the order of the form. What
 * was counted of a row may not be below what is reserved of it: the
 * reserved stock is still on the shelf.
 */
export const readStockCount = (
  values: FormData,
  salonId: string,
  rows: readonly Pick<
    ModelsInventoryResponse,
    'id' | 'productId' | 'reservedStock'
  >[],
  products: readonly ModelsProductResponse[],
): FormRead<ModelsInventoryStockCountRequest, FormErrors<LocalizedText>> => {
  const read = rows.map((row) => countedRowOf(values, row, products))
  const wrong = Object.fromEntries(
    read.flatMap((row): [string, LocalizedText][] =>
      row.type === 'wrong' ? [[row.control, row.message]] : [],
    ),
  )
  if (Object.keys(wrong).length > 0) {
    return { type: 'invalid', errors: wrong }
  }
  const items = read.flatMap((row) =>
    row.type === 'counted' ? [row.item] : [],
  )
  if (items.length === 0) {
    // Said at the first row: the form is shown with one at least
    return {
      type: 'invalid',
      errors: Object.fromEntries(
        rows
          .slice(0, 1)
          .map(({ id }) => [countedControlOf(id), words.noneCounted]),
      ),
    }
  }
  const beyond = items[MOST_ROWS]
  if (beyond !== undefined) {
    return {
      type: 'invalid',
      errors: {
        [countedControlOf(beyond.inventoryId)]: words.tooMany(MOST_ROWS),
      },
    }
  }

  return {
    type: 'valid',
    value: {
      salonId,
      items,
      reason: textOrNull(textOf(values, 'reason')),
    },
  }
}

/** The control of the item the API refused a value of, by its place in the request. */
const controlOfItem = (
  field: string,
  request: Pick<ModelsInventoryStockCountRequest, 'items'>,
): string | undefined => {
  const place = /^items\.(\d+)\.countedQuantity$/.exec(field)?.[1]
  const item = place === undefined ? undefined : request.items[Number(place)]

  return item === undefined ? undefined : countedControlOf(item.inventoryId)
}

/**
 * What the form says after the API did not take it. When rows changed
 * meanwhile, they are read anew, and the counts entered stay where they
 * are.
 */
export const afterStockCount = (
  outcome: Exclude<StockCount, { type: 'counted' }>,
  request: Pick<ModelsInventoryStockCountRequest, 'items'>,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap(({ field }): [string, LocalizedText][] => {
        const control = controlOfItem(field, request)

        return control === undefined ? [] : [[control, words.count]]
      })

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(said),
      }
    })
    .with({ type: 'rowsChanged' }, () => aboutTheAttempt(count.rowsChanged))
    .with({ type: 'belowReserved' }, () =>
      aboutTheAttempt(count.reservedMeanwhile),
    )
    .with({ type: 'forbidden' }, () => aboutTheAttempt(count.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(count.failed))
    .exhaustive()
