import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryCreateRequest,
  ModelsInventoryResponse,
  ModelsInventoryUpdateRequest,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import {
  isDay,
  lengthOf,
  tooLongError,
  tooLongOf,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  errorAt,
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { TreatmentRemovalSays } from '../../treatments/utils/treatment-format'
import type { StockRowRemoval, StockRowWrite } from '../api/inventory-api'
import { LONGEST_LOT, LOT_TOO_LONG } from './lot-number'
import { productOf } from './stock-format'

/*
 * How the forms of a stock row are read, and what they say when the API
 * did not take them. The limits are those of the API; a text is counted in
 * characters, as the API counts it.
 */

/** The longest place of storage */
export const LONGEST_LOCATION = 100
/** The longest shelf */
export const LONGEST_SHELF = 50

const { errors: words, form, removal } = adminInventoryMessages

const LOT_ERROR = words.lotNeeded(LONGEST_LOT)
const LOCATION_ERROR = tooLongOf(form.location, LONGEST_LOCATION)
const SHELF_ERROR = tooLongOf(form.shelf, LONGEST_SHELF)

/** The controls of the forms, under the names of the properties of the requests */
const CONTROLS: readonly string[] = [
  'productId',
  'lotNumber',
  'expiryDate',
  'location',
  'shelf',
  'notes',
]

/** Whether the form of a row shows its lot: the product is kept by lots, or the row has one to clear. */
export const showsLot = (
  row: Pick<ModelsInventoryResponse, 'lotNumber'> | null,
  product: Pick<ModelsProductResponse, 'requiresLotTracking'> | undefined,
): boolean =>
  product?.requiresLotTracking === true ||
  (row !== null && row.lotNumber !== null)

/** What the controls of a row hold besides its product and its lot */
type Place = Pick<
  ModelsInventoryCreateRequest,
  'expiryDate' | 'location' | 'shelf' | 'notes'
>

/** The expiry, the place and the notes of a row, or what is wrong with them. */
const readPlace = (
  values: FormData,
): { place: Place; errors: [string, LocalizedText][] } => {
  const expiry = textOf(values, 'expiryDate').trim()
  const location = textOrNull(textOf(values, 'location'))
  const shelf = textOrNull(textOf(values, 'shelf'))

  return {
    place: {
      expiryDate: expiry === '' ? null : expiry,
      location,
      shelf,
      notes: textOrNull(textOf(values, 'notes')),
    },
    errors: [
      ...errorAt(
        'expiryDate',
        expiry === '' || isDay(expiry) ? undefined : words.expiry,
      ),
      ...errorAt(
        'location',
        tooLongError(location, LONGEST_LOCATION, LOCATION_ERROR),
      ),
      ...errorAt('shelf', tooLongError(shelf, LONGEST_SHELF, SHELF_ERROR)),
    ],
  }
}

/**
 * A new row of a product of the salon, with no stock in it. The lot is
 * read when the product is kept by lots, and must be there then; the
 * form of another product has no lot.
 */
export const readStockEntry = (
  values: FormData,
  salonId: string,
  products: readonly ModelsProductResponse[],
): FormRead<ModelsInventoryCreateRequest, FormErrors<LocalizedText>> => {
  const product = productOf(products, textOf(values, 'productId'))
  const lot = textOrNull(textOf(values, 'lotNumber'))
  const { place, errors: placeErrors } = readPlace(values)
  const errors = Object.fromEntries([
    ...errorAt('productId', product === undefined ? words.product : undefined),
    ...errorAt(
      'lotNumber',
      product?.requiresLotTracking === true &&
        (lot === null || lengthOf(lot) > LONGEST_LOT)
        ? LOT_ERROR
        : undefined,
    ),
    ...placeErrors,
  ])
  if (product === undefined || Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      salonId,
      productId: product.id,
      lotNumber: product.requiresLotTracking ? lot : null,
      ...place,
    },
  }
}

/** What a change of a row asks for: nothing, when nothing was changed. */
type StockRowChange =
  | FormRead<ModelsInventoryUpdateRequest, FormErrors<LocalizedText>>
  | { type: 'unchanged' }
/** The lot that was sent, or what is wrong with it; `undefined` when the form has no lot. */
const readLot = (
  values: FormData,
  row: ModelsInventoryResponse,
  product: ModelsProductResponse | undefined,
): { lot: string | null | undefined; error: LocalizedText | undefined } => {
  if (!showsLot(row, product)) {
    return { lot: undefined, error: undefined }
  }
  const lot = textOrNull(textOf(values, 'lotNumber'))
  const required = product?.requiresLotTracking === true
  const error =
    required && (lot === null || lengthOf(lot) > LONGEST_LOT)
      ? LOT_ERROR
      : lot !== null && lengthOf(lot) > LONGEST_LOT
        ? LOT_TOO_LONG
        : !required && lot !== null && lot !== textOrNull(row.lotNumber)
          ? words.lotNotKept
          : undefined

  return { lot, error }
}

/**
 * What was changed in the form of a row: the values that are others than
 * those of the row it was opened with, each compared as the form reads it.
 * The lot follows the product as it is now: it must be there for a product
 * kept by lots, and may only be cleared for one that is not.
 */
export const readStockChange = (
  values: FormData,
  row: ModelsInventoryResponse,
  product: ModelsProductResponse | undefined,
): StockRowChange => {
  const { lot, error } = readLot(values, row, product)
  const { place, errors: placeErrors } = readPlace(values)
  const errors = Object.fromEntries([
    ...errorAt('lotNumber', error),
    ...placeErrors,
  ])
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  const changes: ModelsInventoryUpdateRequest = {
    ...(lot === undefined || lot === textOrNull(row.lotNumber)
      ? {}
      : { lotNumber: lot }),
    ...(place.expiryDate === row.expiryDate
      ? {}
      : { expiryDate: place.expiryDate }),
    ...(place.location === textOrNull(row.location)
      ? {}
      : { location: place.location }),
    ...(place.shelf === textOrNull(row.shelf) ? {} : { shelf: place.shelf }),
    ...(place.notes === textOrNull(row.notes) ? {} : { notes: place.notes }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** Whether the API refused a lot because its product is kept by lots otherwise than the form knew. */
const isLotMarkRefusal = ({ field, rule }: RefusedValue): boolean =>
  field === 'lotNumber' && rule === 'custom'

/** What is said at a control the API refused a value of. */
const refusalAt = (field: string, rule: string): LocalizedText =>
  match(field)
    .with('productId', () =>
      rule === 'not_found' ? words.productRemoved : words.product,
    )
    .with('lotNumber', () => LOT_TOO_LONG)
    .with('expiryDate', () => words.expiry)
    .with('location', () => LOCATION_ERROR)
    .with('shelf', () => SHELF_ERROR)
    .otherwise(() => REFUSED_VALUE_MESSAGE)

/**
 * What the form says after the API did not take it. A lot that another
 * row has is said at the lot; a second row without a lot, above the form:
 * the form of a product without lots has no lot, and a lot that was
 * cleared has nothing to say it at. A lot refused for the mark of its
 * product is said above the form as well: the form showed the lot by the
 * mark it knew.
 */
export const afterStockWrite = (
  outcome:
    | Extract<StockRowWrite, { type: 'invalid' | 'lotTaken' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
  lotSent: boolean,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.filter(({ field }) => CONTROLS.includes(field))
      const atControls = said.filter((value) => !isLotMarkRefusal(value))

      return {
        message:
          said.length === 0
            ? CHECK_THE_VALUES_MESSAGE
            : said.length > atControls.length
              ? words.lotMarkChanged
              : undefined,
        errors: Object.fromEntries(
          atControls.map(({ field, rule }) => [field, refusalAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'lotTaken' }, () =>
      lotSent
        ? { message: undefined, errors: { lotNumber: words.lotTaken } }
        : aboutTheAttempt(words.rowTaken),
    )
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt(adminInventoryMessages.forbidden),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(adminInventoryMessages.saveFailed),
    )
    .exhaustive()

/**
 * What is said after a row was to be removed. A row that still counts
 * stock stays: its stock is brought to 0 by a movement first.
 */
export const afterStockRemoval = (
  outcome: StockRowRemoval,
  name: LocalizedText,
): TreatmentRemovalSays =>
  match(outcome)
    .returnType<TreatmentRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: removal.done(name),
    }))
    .with({ type: 'inStock' }, () => ({
      type: 'refused',
      message: removal.inStock(name),
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: adminInventoryMessages.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: removal.failed,
    }))
    .exhaustive()
