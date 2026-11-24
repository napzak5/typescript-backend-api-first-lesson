import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsProductCreateRequest,
  ModelsProductResponse,
  ModelsProductUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  neededError,
  neededWithin,
  tooLongError,
  tooLongOf,
  WEB_ADDRESS_ERROR,
  webAddressError,
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
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { yenOf } from '../../bookings/utils/booking-entry'
import { numberOf } from '../../treatments/utils/treatment-form'
import type { TreatmentRemovalSays } from '../../treatments/utils/treatment-format'
import type { ProductRemoval, ProductWrite } from '../api/products-api'

const { form, removal, words } = adminProductMessages
const { errors: ERRORS } = form

type Errors = FormErrors<LocalizedText>

/*
 * The form of a product: what it sends, and what it says about the
 * answers. The limits are those the API takes; a text is counted in
 * characters, as the API counts it.
 */

/** The longest product code the API takes */
export const LONGEST_CODE = 100
/** The longest name of a product */
export const LONGEST_NAME = 255
/** The longest category, brand, product code of the supplier and barcode */
export const LONGEST_LABEL = 100
/** The longest unit */
export const LONGEST_UNIT = 20
/** The longest name of a supplier */
export const LONGEST_SUPPLIER = 255

const CODE_ERROR = neededWithin(words.productCode, LONGEST_CODE)
const NAME_ERROR = neededWithin(words.name, LONGEST_NAME)
const CATEGORY_ERROR = tooLongOf(words.category, LONGEST_LABEL)
const BRAND_ERROR = tooLongOf(words.brand, LONGEST_LABEL)
const UNIT_ERROR = neededWithin(words.unit, LONGEST_UNIT)
const SUPPLIER_ERROR = tooLongOf(words.supplier, LONGEST_SUPPLIER)
const SUPPLIER_CODE_ERROR = tooLongOf(words.supplierProductCode, LONGEST_LABEL)
const BARCODE_ERROR = tooLongOf(words.barcode, LONGEST_LABEL)

/** The controls of the form, by the names of the request */
const CONTROLS: readonly string[] = [
  'productCode',
  'name',
  'description',
  'category',
  'brand',
  'purchasePrice',
  'retailPrice',
  'salonPrice',
  'unit',
  'minimumStock',
  'reorderPoint',
  'maximumStock',
  'supplier',
  'supplierProductCode',
  'leadTimeDays',
  'imageUrl',
  'barcode',
  'isForSale',
  'isForTreatment',
  'requiresLotTracking',
  'expiryMonths',
  'storageConditions',
  'safetyDataSheet',
  'isActive',
]

/**
 * A level of the stock, as a person types it: digits of full width count,
 * and so do the commas between them. Nothing is no level; what the API
 * does not take (a negative number, more than two decimals, more than
 * 99,999,999.99) is `undefined`.
 */
export const levelOf = (text: string): number | null | undefined => {
  const digits = text.normalize('NFKC').replaceAll(',', '').trim()
  if (digits === '') {
    return null
  }

  return /^\d{1,8}(\.\d{1,2})?$/.test(digits) ? Number(digits) : undefined
}

/** A web address that may be left empty: `undefined` when it is none the API takes. */
const optionalWebAddressOf = (text: string): string | null | undefined => {
  const address = textOrNull(text)

  return webAddressError(address) === undefined ? address : undefined
}

/**
 * The levels of the stock lie in order: the minimum, the point a product
 * is ordered at, and the most that is kept. What is not given is not
 * compared. Each break is said at the higher of its two levels.
 */
const orderErrors = (
  minimum: number,
  reorder: number | null,
  maximum: number | null,
): [string, LocalizedText][] => [
  ...errorAt(
    'reorderPoint',
    reorder !== null && reorder < minimum
      ? ERRORS.reorderBelowMinimum
      : undefined,
  ),
  ...errorAt(
    'maximumStock',
    maximum === null
      ? undefined
      : reorder !== null && maximum < reorder
        ? ERRORS.maximumBelowReorder
        : maximum < minimum
          ? ERRORS.maximumBelowMinimum
          : undefined,
  ),
]

/** The whole product the form holds, or what is wrong with it. */
const readWhole = (
  values: FormData,
): FormRead<ModelsProductCreateRequest, Errors> => {
  const productCode = textOf(values, 'productCode').trim()
  const name = textOf(values, 'name').trim()
  const category = textOrNull(textOf(values, 'category'))
  const brand = textOrNull(textOf(values, 'brand'))
  const purchasePrice = yenOf(textOf(values, 'purchasePrice'))
  const retailPrice = yenOf(textOf(values, 'retailPrice'))
  const salonPrice = yenOf(textOf(values, 'salonPrice'))
  const unit = textOf(values, 'unit').trim()
  const minimumStock = levelOf(textOf(values, 'minimumStock'))
  const reorderPoint = levelOf(textOf(values, 'reorderPoint'))
  const maximumStock = levelOf(textOf(values, 'maximumStock'))
  const supplier = textOrNull(textOf(values, 'supplier'))
  const supplierProductCode = textOrNull(textOf(values, 'supplierProductCode'))
  const leadTimeDays = numberOf(textOf(values, 'leadTimeDays'), 0)
  const imageUrl = optionalWebAddressOf(textOf(values, 'imageUrl'))
  const barcode = textOrNull(textOf(values, 'barcode'))
  const expiryMonths = numberOf(textOf(values, 'expiryMonths'), 0)
  const safetyDataSheet = optionalWebAddressOf(
    textOf(values, 'safetyDataSheet'),
  )
  const errors: Errors = Object.fromEntries([
    ...errorAt(
      'productCode',
      neededError(productCode, LONGEST_CODE, CODE_ERROR),
    ),
    ...errorAt('name', neededError(name, LONGEST_NAME, NAME_ERROR)),
    ...errorAt(
      'category',
      tooLongError(category, LONGEST_LABEL, CATEGORY_ERROR),
    ),
    ...errorAt('brand', tooLongError(brand, LONGEST_LABEL, BRAND_ERROR)),
    ...errorAt('unit', neededError(unit, LONGEST_UNIT, UNIT_ERROR)),
    ...errorAt(
      'purchasePrice',
      purchasePrice === undefined ? ERRORS.purchasePrice : undefined,
    ),
    ...errorAt(
      'retailPrice',
      retailPrice === undefined ? ERRORS.retailPrice : undefined,
    ),
    ...errorAt(
      'salonPrice',
      salonPrice === undefined ? ERRORS.salonPrice : undefined,
    ),
    ...errorAt(
      'minimumStock',
      minimumStock === null || minimumStock === undefined
        ? ERRORS.minimumStock
        : undefined,
    ),
    ...errorAt(
      'reorderPoint',
      reorderPoint === undefined ? ERRORS.reorderPoint : undefined,
    ),
    ...errorAt(
      'maximumStock',
      maximumStock === undefined ? ERRORS.maximumStock : undefined,
    ),
    // The levels are compared when each of them is one
    ...(minimumStock === null ||
    minimumStock === undefined ||
    reorderPoint === undefined ||
    maximumStock === undefined
      ? []
      : orderErrors(minimumStock, reorderPoint, maximumStock)),
    ...errorAt(
      'supplier',
      tooLongError(supplier, LONGEST_SUPPLIER, SUPPLIER_ERROR),
    ),
    ...errorAt(
      'supplierProductCode',
      tooLongError(supplierProductCode, LONGEST_LABEL, SUPPLIER_CODE_ERROR),
    ),
    ...errorAt(
      'leadTimeDays',
      leadTimeDays === undefined ? ERRORS.leadTimeDays : undefined,
    ),
    ...errorAt('barcode', tooLongError(barcode, LONGEST_LABEL, BARCODE_ERROR)),
    ...errorAt(
      'expiryMonths',
      expiryMonths === undefined || expiryMonths === 0
        ? ERRORS.expiryMonths
        : undefined,
    ),
    ...errorAt(
      'imageUrl',
      imageUrl === undefined ? WEB_ADDRESS_ERROR : undefined,
    ),
    ...errorAt(
      'safetyDataSheet',
      safetyDataSheet === undefined ? WEB_ADDRESS_ERROR : undefined,
    ),
  ])
  if (
    purchasePrice === undefined ||
    retailPrice === undefined ||
    salonPrice === undefined ||
    minimumStock === null ||
    minimumStock === undefined ||
    reorderPoint === undefined ||
    maximumStock === undefined ||
    leadTimeDays === undefined ||
    expiryMonths === undefined ||
    imageUrl === undefined ||
    safetyDataSheet === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      productCode,
      name,
      description: textOrNull(textOf(values, 'description')),
      category,
      brand,
      purchasePrice,
      retailPrice,
      salonPrice,
      unit,
      minimumStock,
      maximumStock,
      reorderPoint,
      supplier,
      supplierProductCode,
      leadTimeDays,
      imageUrl,
      barcode,
      isForSale: values.has('isForSale'),
      isForTreatment: values.has('isForTreatment'),
      requiresLotTracking: values.has('requiresLotTracking'),
      expiryMonths,
      storageConditions: textOrNull(textOf(values, 'storageConditions')),
      safetyDataSheet,
      isActive: values.has('isActive'),
    },
  }
}

/** A new product, as the form holds it. */
export const readProductEntry = (
  values: FormData,
): FormRead<ModelsProductCreateRequest, Errors> => readWhole(values)

/** What a change of a product asks for: nothing, when nothing was changed. */
type ProductChange =
  | FormRead<ModelsProductUpdateRequest, Errors>
  | { type: 'unchanged' }
/** What the form reads back of each property of a product it was opened with */
const shownOf = (
  product: ModelsProductResponse,
): ModelsProductCreateRequest => ({
  productCode: product.productCode.trim(),
  name: product.name.trim(),
  description: textOrNull(product.description),
  category: textOrNull(product.category),
  brand: textOrNull(product.brand),
  purchasePrice: product.purchasePrice,
  retailPrice: product.retailPrice,
  salonPrice: product.salonPrice,
  unit: product.unit.trim(),
  minimumStock: product.minimumStock,
  maximumStock: product.maximumStock,
  reorderPoint: product.reorderPoint,
  supplier: textOrNull(product.supplier),
  supplierProductCode: textOrNull(product.supplierProductCode),
  leadTimeDays: product.leadTimeDays,
  imageUrl: textOrNull(product.imageUrl),
  barcode: textOrNull(product.barcode),
  isForSale: product.isForSale,
  isForTreatment: product.isForTreatment,
  requiresLotTracking: product.requiresLotTracking,
  expiryMonths: product.expiryMonths,
  storageConditions: textOrNull(product.storageConditions),
  safetyDataSheet: textOrNull(product.safetyDataSheet),
  isActive: product.isActive,
})

/**
 * What was changed in the form: the values that are others than those of
 * the product it was opened with, each compared as the form reads it.
 */
export const readProductChange = (
  values: FormData,
  shown: ModelsProductResponse,
): ProductChange => {
  const read = readWhole(values)
  if (read.type === 'invalid') {
    return read
  }
  const sent = read.value
  const before = shownOf(shown)
  const changes: ModelsProductUpdateRequest = {
    ...(sent.productCode === before.productCode
      ? {}
      : { productCode: sent.productCode }),
    ...(sent.name === before.name ? {} : { name: sent.name }),
    ...(sent.description === before.description
      ? {}
      : { description: sent.description }),
    ...(sent.category === before.category ? {} : { category: sent.category }),
    ...(sent.brand === before.brand ? {} : { brand: sent.brand }),
    ...(sent.purchasePrice === before.purchasePrice
      ? {}
      : { purchasePrice: sent.purchasePrice }),
    ...(sent.retailPrice === before.retailPrice
      ? {}
      : { retailPrice: sent.retailPrice }),
    ...(sent.salonPrice === before.salonPrice
      ? {}
      : { salonPrice: sent.salonPrice }),
    ...(sent.unit === before.unit ? {} : { unit: sent.unit }),
    ...(sent.minimumStock === before.minimumStock
      ? {}
      : { minimumStock: sent.minimumStock }),
    ...(sent.maximumStock === before.maximumStock
      ? {}
      : { maximumStock: sent.maximumStock }),
    ...(sent.reorderPoint === before.reorderPoint
      ? {}
      : { reorderPoint: sent.reorderPoint }),
    ...(sent.supplier === before.supplier ? {} : { supplier: sent.supplier }),
    ...(sent.supplierProductCode === before.supplierProductCode
      ? {}
      : { supplierProductCode: sent.supplierProductCode }),
    ...(sent.leadTimeDays === before.leadTimeDays
      ? {}
      : { leadTimeDays: sent.leadTimeDays }),
    ...(sent.imageUrl === before.imageUrl ? {} : { imageUrl: sent.imageUrl }),
    ...(sent.barcode === before.barcode ? {} : { barcode: sent.barcode }),
    ...(sent.isForSale === before.isForSale
      ? {}
      : { isForSale: sent.isForSale }),
    ...(sent.isForTreatment === before.isForTreatment
      ? {}
      : { isForTreatment: sent.isForTreatment }),
    ...(sent.requiresLotTracking === before.requiresLotTracking
      ? {}
      : { requiresLotTracking: sent.requiresLotTracking }),
    ...(sent.expiryMonths === before.expiryMonths
      ? {}
      : { expiryMonths: sent.expiryMonths }),
    ...(sent.storageConditions === before.storageConditions
      ? {}
      : { storageConditions: sent.storageConditions }),
    ...(sent.safetyDataSheet === before.safetyDataSheet
      ? {}
      : { safetyDataSheet: sent.safetyDataSheet }),
    ...(sent.isActive === before.isActive ? {} : { isActive: sent.isActive }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** What is said at a control the API refused a value of. */
const refusalAt = (field: string, rule: string): LocalizedText =>
  match(field)
    .with('productCode', () => CODE_ERROR)
    .with('name', () => NAME_ERROR)
    .with('category', () => CATEGORY_ERROR)
    .with('brand', () => BRAND_ERROR)
    .with('unit', () => UNIT_ERROR)
    .with('purchasePrice', () => ERRORS.purchasePrice)
    .with('retailPrice', () => ERRORS.retailPrice)
    .with('salonPrice', () => ERRORS.salonPrice)
    // A level the API compared with the levels it keeps: another was changed meanwhile
    .with('minimumStock', () =>
      rule === 'custom' ? ERRORS.minimumAgainstKept : ERRORS.minimumStock,
    )
    .with('reorderPoint', () =>
      rule === 'custom' ? ERRORS.reorderAgainstKept : ERRORS.reorderPoint,
    )
    .with('maximumStock', () =>
      rule === 'custom' ? ERRORS.maximumAgainstKept : ERRORS.maximumStock,
    )
    .with('supplier', () => SUPPLIER_ERROR)
    .with('supplierProductCode', () => SUPPLIER_CODE_ERROR)
    .with('leadTimeDays', () => ERRORS.leadTimeDays)
    .with('barcode', () => BARCODE_ERROR)
    .with('expiryMonths', () => ERRORS.expiryMonths)
    .with('imageUrl', 'safetyDataSheet', () => WEB_ADDRESS_ERROR)
    .otherwise(() => REFUSED_VALUE_MESSAGE)

/** What the form says after the API did not take it. */
export const afterProductWrite = (
  outcome:
    | Extract<ProductWrite, { type: 'invalid' | 'codeTaken' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.filter(({ field }) => CONTROLS.includes(field))

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          said.map(({ field, rule }) => [field, refusalAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'codeTaken' }, () => ({
      message: undefined,
      errors: { productCode: ERRORS.codeTaken },
    }))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(form.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(form.failed))
    .exhaustive()

/**
 * What is said after a product was to be removed. One the salon keeps
 * stock of stays: the salon stops carrying it instead.
 */
export const afterProductRemoval = (
  outcome: ProductRemoval,
  name: string,
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
      message: form.forbidden,
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
