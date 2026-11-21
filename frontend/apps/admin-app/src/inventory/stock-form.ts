import type {
  ModelsInventoryCreateRequest,
  ModelsInventoryResponse,
  ModelsInventoryUpdateRequest,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import {
  isDay,
  type Read,
  type RefusedValue,
  textOf,
} from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import {
  type FormSays,
  nullIfBlank,
  TOO_MANY_REQUESTS,
} from '../bookings/booking-entry'
import type { TreatmentRemovalSays } from '../treatments/treatment-format'
import type { StockRowRemoval, StockRowWrite } from './inventory-api'
import { productOf } from './stock-format'

/*
 * How the forms of a stock row are read, and what they say when the API
 * did not take them. The limits are those of the API; a text is counted in
 * characters, as the API counts it.
 */

const LONGEST_LOT = 100
const LONGEST_LOCATION = 100
const LONGEST_SHELF = 50

const PRODUCT_ERROR = '商品を選んでください。'
const LOT_ERROR =
  'ロット番号を、100 文字までで入力してください。この商品は、在庫をロット番号で分けます。'
const LOT_LENGTH_ERROR = 'ロット番号は、100 文字までで入力してください。'
const LOT_NOT_KEPT =
  'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。'
const EXPIRY_ERROR =
  '使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。'
const LOCATION_ERROR = '保管場所は、100 文字までで入力してください。'
const SHELF_ERROR = '棚は、50 文字までで入力してください。'
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

const lengthOf = (text: string): number => [...text].length

/** What is said at a control, under its name; nothing when the value may be sent. */
const errorAt = (
  control: string,
  message: string | undefined,
): [string, string][] => (message === undefined ? [] : [[control, message]])

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
  const location = nullIfBlank(textOf(values, 'location'))
  const shelf = nullIfBlank(textOf(values, 'shelf'))

  return {
    place: {
      expiryDate: expiry === '' ? null : expiry,
      location,
      shelf,
      notes: nullIfBlank(textOf(values, 'notes')),
    },
    errors: [
      ...errorAt(
        'expiryDate',
        expiry === '' || isDay(expiry) ? undefined : EXPIRY_ERROR,
      ),
      ...errorAt(
        'location',
        location !== null && lengthOf(location) > LONGEST_LOCATION
          ? LOCATION_ERROR
          : undefined,
      ),
      ...errorAt(
        'shelf',
        shelf !== null && lengthOf(shelf) > LONGEST_SHELF
          ? SHELF_ERROR
          : undefined,
      ),
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
): Read<ModelsInventoryCreateRequest> => {
  const product = productOf(products, textOf(values, 'productId'))
  const lot = nullIfBlank(textOf(values, 'lotNumber'))
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
    request: {
      salonId,
      productId: product.id,
      lotNumber: product.requiresLotTracking ? lot : null,
      ...place,
    },
  }
}

/** What a change of a row asks for: nothing, when nothing was changed. */
type StockRowChange = Read<ModelsInventoryUpdateRequest> | { type: 'unchanged' }

/** A text of a row as the form reads it back: without the spaces around it, nothing as `null`. */
const shownText = (text: string | null): string | null =>
  nullIfBlank(text ?? '')

/** The lot that was sent, or what is wrong with it; `undefined` when the form has no lot. */
const readLot = (
  values: FormData,
  row: ModelsInventoryResponse,
  product: ModelsProductResponse | undefined,
): { lot: string | null | undefined; error: string | undefined } => {
  if (!showsLot(row, product)) {
    return { lot: undefined, error: undefined }
  }
  const lot = nullIfBlank(textOf(values, 'lotNumber'))
  const required = product?.requiresLotTracking === true
  const error =
    required && (lot === null || lengthOf(lot) > LONGEST_LOT)
      ? LOT_ERROR
      : lot !== null && lengthOf(lot) > LONGEST_LOT
        ? LOT_LENGTH_ERROR
        : !required && lot !== null && lot !== shownText(row.lotNumber)
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
    ...(lot === undefined || lot === shownText(row.lotNumber)
      ? {}
      : { lotNumber: lot }),
    ...(place.expiryDate === row.expiryDate
      ? {}
      : { expiryDate: place.expiryDate }),
    ...(place.location === shownText(row.location)
      ? {}
      : { location: place.location }),
    ...(place.shelf === shownText(row.shelf) ? {} : { shelf: place.shelf }),
    ...(place.notes === shownText(row.notes) ? {} : { notes: place.notes }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', request: changes }
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
    .with('lotNumber', () => LOT_LENGTH_ERROR)
    .with('expiryDate', () => EXPIRY_ERROR)
    .with('location', () => LOCATION_ERROR)
    .with('shelf', () => SHELF_ERROR)
    .otherwise(
      () => 'この値は受け付けられませんでした。入力を確かめてください。',
    )

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
            ? '入力した内容を確かめて、もう一度お試しください。'
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
        : { message: ROW_TAKEN, errors: {} },
    )
    .with({ type: 'forbidden' }, () => ({
      message: FORBIDDEN_MESSAGE,
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '在庫の行を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
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
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '在庫の行を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
