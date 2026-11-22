import type { ProductCrudListParams } from '@beauty-salon-frontend/api-client'
import {
  keywordIn,
  LONGEST_KEYWORD,
} from '@beauty-salon-frontend/salon-screens'
import { type FormRead, textOf } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'

/*
 * Which products the ledger shows. The names are those of the query of the
 * address the ledger is kept in.
 */

/** Whether the salon still carries a product */
export type Carried = 'carried' | 'dropped'

/** What a product is for: sold at the counter, or used in a treatment */
export type Purpose = 'sale' | 'treatment'

export type ProductConditions = {
  /** Part of the name, of the code or of the brand of a product */
  keyword?: string
  /** The barcode of a product, whole */
  barcode?: string
  /** The category of a product, as it is written */
  category?: string
  carried?: Carried
  use?: Purpose
}

const CARRIED: readonly Carried[] = ['carried', 'dropped']

const PURPOSES: readonly Purpose[] = ['sale', 'treatment']

const carriedFrom = (value: string): Carried | undefined =>
  CARRIED.find((carried) => carried === value)

const purposeFrom = (value: string): Purpose | undefined =>
  PURPOSES.find((use) => use === value)

/** The longest category and barcode the API takes */
const LONGEST_NAME = 100

/** A barcode the API takes: not empty, and not too long. */
const barcodeFrom = (value: string | null): string | undefined => {
  const barcode = (value ?? '').trim()

  return barcode === '' || barcode.length > LONGEST_NAME ? undefined : barcode
}

/**
 * A category the API takes. It is one the salon wrote, chosen from those
 * of its products, and is compared as it is written: the spaces around it
 * stay.
 */
const categoryFrom = (value: string | null): string | undefined =>
  value === null || value.trim() === '' || value.length > LONGEST_NAME
    ? undefined
    : value

/**
 * The conditions in the query of an address. What the API does not take is
 * no condition: an address that somebody changed by hand shows what is
 * left of it.
 */
export const productConditionsIn = (
  query: URLSearchParams,
): ProductConditions => {
  const keyword = keywordIn(query, 'keyword')
  const barcode = barcodeFrom(query.get('barcode'))
  const category = categoryFrom(query.get('category'))
  const carried = carriedFrom(query.get('carried') ?? '')
  const use = purposeFrom(query.get('use') ?? '')

  return {
    ...(keyword === undefined ? {} : { keyword }),
    ...(barcode === undefined ? {} : { barcode }),
    ...(category === undefined ? {} : { category }),
    ...(carried === undefined ? {} : { carried }),
    ...(use === undefined ? {} : { use }),
  }
}

const KEYWORD_ERROR = `キーワードは ${LONGEST_KEYWORD} 文字以内で入力してください。`

const BARCODE_ERROR = `バーコードは ${LONGEST_NAME} 文字以内で入力してください。`

/** The conditions that were filled in: every one may be left empty. */
export const readProductConditions = (
  values: FormData,
): FormRead<ProductConditions> => {
  const keyword = textOf(values, 'keyword').trim()
  const barcode = textOf(values, 'barcode').trim()
  const errors: Record<string, string> = {
    ...(keyword.length > LONGEST_KEYWORD ? { keyword: KEYWORD_ERROR } : {}),
    ...(barcode.length > LONGEST_NAME ? { barcode: BARCODE_ERROR } : {}),
  }
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  const category = categoryFrom(textOf(values, 'category'))
  const carried = carriedFrom(textOf(values, 'carried'))
  const use = purposeFrom(textOf(values, 'use'))

  return {
    type: 'valid',
    value: {
      ...(keyword === '' ? {} : { keyword }),
      ...(barcode === '' ? {} : { barcode }),
      ...(category === undefined ? {} : { category }),
      ...(carried === undefined ? {} : { carried }),
      ...(use === undefined ? {} : { use }),
    },
  }
}

/**
 * The query that keeps conditions in an address: the same conditions are
 * the same address, whatever order they were filled in.
 */
export const productQueryOf = ({
  keyword,
  barcode,
  category,
  carried,
  use,
}: ProductConditions): URLSearchParams =>
  new URLSearchParams([
    ...(keyword === undefined ? [] : [['keyword', keyword]]),
    ...(barcode === undefined ? [] : [['barcode', barcode]]),
    ...(category === undefined ? [] : [['category', category]]),
    ...(carried === undefined ? [] : [['carried', carried]]),
    ...(use === undefined ? [] : [['use', use]]),
  ])

/** Whether the conditions narrow the ledger at all. */
export const isNarrowed = (conditions: ProductConditions): boolean =>
  productQueryOf(conditions).toString() !== ''

/** What the API is asked for. */
export const productListParamsOf = ({
  keyword,
  barcode,
  category,
  carried,
  use,
}: ProductConditions): Omit<ProductCrudListParams, 'cursor' | 'limit'> => ({
  ...(keyword === undefined ? {} : { keyword }),
  ...(barcode === undefined ? {} : { barcode }),
  ...(category === undefined ? {} : { category }),
  ...(carried === undefined ? {} : { isActive: carried === 'carried' }),
  ...match(use)
    .returnType<Pick<ProductCrudListParams, 'isForSale' | 'isForTreatment'>>()
    .with(undefined, () => ({}))
    .with('sale', () => ({ isForSale: true }))
    .with('treatment', () => ({ isForTreatment: true }))
    .exhaustive(),
})
