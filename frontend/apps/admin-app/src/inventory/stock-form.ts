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
  neededWithin,
  tooLongError,
  tooLongOf,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  errorAt,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { TreatmentRemovalSays } from '../treatments/treatment-format'
import type { StockRowRemoval, StockRowWrite } from './inventory-api'
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

const PRODUCT_ERROR = '商品を選んでください。'
const LOT_ERROR = `${neededWithin('ロット番号', LONGEST_LOT)}この商品は、在庫をロット番号で分けます。`
const LOT_NOT_KEPT =
  'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。'
const EXPIRY_ERROR =
  '使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。'
const LOCATION_ERROR = tooLongOf('保管場所', LONGEST_LOCATION)
const SHELF_ERROR = tooLongOf('棚', LONGEST_SHELF)
const LOT_TAKEN =
  'このロット番号の在庫の行は、この商品にすでにあります。同じロットの在庫は、その行で記録してください。'
const ROW_TAKEN =
  'ロット番号のない在庫の行は、この商品にすでにあります。ロット番号のない在庫は、その行で記録してください。'
const LOT_MARK_CHANGED =
  'この商品の「在庫をロット番号で分ける」の印が、変わっていました。いまの印で読み直したので、ロット番号を確かめて、もう一度お試しください。'
const FORBIDDEN_MESSAGE =
  'このサロンの在庫は、変えられません。在庫の行を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'

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
): { place: Place; errors: [string, string][] } => {
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
        expiry === '' || isDay(expiry) ? undefined : EXPIRY_ERROR,
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
): FormRead<ModelsInventoryCreateRequest> => {
  const product = productOf(products, textOf(values, 'productId'))
  const lot = textOrNull(textOf(values, 'lotNumber'))
  const { place, errors: placeErrors } = readPlace(values)
  const errors = Object.fromEntries([
    ...errorAt('productId', product === undefined ? PRODUCT_ERROR : undefined),
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
  | FormRead<ModelsInventoryUpdateRequest>
  | { type: 'unchanged' }
/** The lot that was sent, or what is wrong with it; `undefined` when the form has no lot. */
const readLot = (
  values: FormData,
  row: ModelsInventoryResponse,
  product: ModelsProductResponse | undefined,
): { lot: string | null | undefined; error: string | undefined } => {
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
          ? LOT_NOT_KEPT
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

/**
 * Whether the products a form was opened with are not what the API holds:
 * the product was removed, or marked otherwise as to its lots, meanwhile.
 * They are read anew, so that the form offers and asks what it may.
 */
export const productsChanged = (values: readonly RefusedValue[]): boolean =>
  values.some((value) => value.field === 'productId' || isLotMarkRefusal(value))

/** What is said at a control the API refused a value of. */
const refusalAt = (field: string, rule: string): string =>
  match(field)
    .with('productId', () =>
      rule === 'not_found'
        ? 'この商品は、削除されました。ほかの商品を選んでください。'
        : PRODUCT_ERROR,
    )
    .with('lotNumber', () => LOT_TOO_LONG)
    .with('expiryDate', () => EXPIRY_ERROR)
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
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.filter(({ field }) => CONTROLS.includes(field))
      const atControls = said.filter((value) => !isLotMarkRefusal(value))

      return {
        message:
          said.length === 0
            ? CHECK_THE_VALUES_MESSAGE
            : said.length > atControls.length
              ? LOT_MARK_CHANGED
              : undefined,
        errors: Object.fromEntries(
          atControls.map(({ field, rule }) => [field, refusalAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'lotTaken' }, () =>
      lotSent
        ? { message: undefined, errors: { lotNumber: LOT_TAKEN } }
        : aboutTheAttempt(ROW_TAKEN),
    )
    .with({ type: 'forbidden' }, () => aboutTheAttempt(FORBIDDEN_MESSAGE))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        '在庫の行を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
    .exhaustive()

/**
 * What is said after a row was to be removed. A row that still counts
 * stock stays: its stock is brought to 0 by a movement first.
 */
export const afterStockRemoval = (
  outcome: StockRowRemoval,
  name: string,
): TreatmentRemovalSays =>
  match(outcome)
    .returnType<TreatmentRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: `在庫の行「${name}」を削除しました。`,
    }))
    .with({ type: 'inStock' }, () => ({
      type: 'refused',
      message: `在庫の行「${name}」は、在庫数が 0 でないので、削除できません。在庫の移動で在庫数を 0 にしてから、削除してください。`,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: FORBIDDEN_MESSAGE,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '在庫の行を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
