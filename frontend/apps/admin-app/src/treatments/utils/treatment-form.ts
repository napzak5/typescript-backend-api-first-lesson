import {
  CHECK_THE_VALUES_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsProductResponse,
  ModelsTreatmentMaterial,
  ModelsTreatmentRecordCreateRequest,
  ModelsTreatmentRecordResponse,
  ModelsTreatmentRecordUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  eachTooLongOf,
  isDay,
  lengthOf,
  tooLongOf,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  errorAt,
  type FormRead,
  type FormSays,
  same,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { tagsIn } from '../../customers/utils/customer-ledger'
import type { TreatmentWrite } from '../api/treatments-api'

/*
 * The form of a treatment record: what it reads, what it says is wrong,
 * and what is said after it was sent. The controls are named as the API
 * names the properties; a material is a row of controls named by the
 * number the row has now, counted from 0 (`materials.1.quantity`), as the
 * API names what is wrong with one.
 */

/** The name of a control of the row of the material of the number `index`, counted from 0 */
export const materialControlOf = (
  index: number,
  name: keyof ModelsTreatmentMaterial,
): string => `materials.${index}.${name}`

/** The most services, techniques and services recommended a record holds */
const MOST_IN_A_LIST = 20
/** The most materials a record holds: the form offers no more rows */
export const MOST_MATERIALS = 50
/** The longest treatment, in minutes: a day */
const LONGEST_TREATMENT = 1440
const LONGEST_TECHNIQUE = 100
const LONGEST_UNIT = 20
const LONGEST_LOT_NUMBER = 100
/** The most of a material, as the API keeps it */
const MOST_QUANTITY = 99_999_999.99

const STAFF_MISSING = '担当を選んでください。'
const SERVICES_MISSING = '提供したサービスを選んでください。'
const TOO_MANY_SERVICES = `提供したサービスは、${MOST_IN_A_LIST} 件までにしてください。`
const TECHNIQUE_TOO_LONG = eachTooLongOf('技法の名前', LONGEST_TECHNIQUE)
const TOO_MANY_TECHNIQUES = `技法は、${MOST_IN_A_LIST} 件までで入力してください。`
const TIME_ERROR = `施術時間は、0 から ${LONGEST_TREATMENT} までの分の整数で入力してください。`
const DATE_ERROR = '次に勧める日を、日付で入力してください。'
const TOO_MANY_NEXT_SERVICES = `次に勧めるサービスは、${MOST_IN_A_LIST} 件までにしてください。`
const SATISFACTION_ERROR = '満足度を選び直してください。'
const PRODUCT_MISSING = '商品を選んでください。'
const PRODUCT_GONE =
  'この商品は、その間に削除されました。ほかの商品を選ぶか、この商材を外してください。'
const QUANTITY_ERROR =
  '量は、0 より大きい数で、小数第 2 位まで入力してください。'
const UNIT_MISSING = '単位を入力してください。'
const UNIT_TOO_LONG = tooLongOf('単位', LONGEST_UNIT)
const LOT_MISSING =
  'この商品は、ロットで管理しています。ロット番号を入力してください。'
const LOT_TOO_LONG = tooLongOf('ロット番号', LONGEST_LOT_NUMBER)
const LOT_NOT_TAKEN =
  'この商品は、ロットで管理していません。ロット番号を消してください。'
const LOT_CHANGED =
  'その間に、この商品のロットの管理が変わりました。画面を開き直して、書き直してください。'
const STAFF_GONE =
  'このスタッフは、その間に削除されたか、ほかのサロンに移りました。ほかのスタッフを選んでください。'
const SERVICE_GONE =
  'その間に削除されたサービスがあります。選び直してください。'
const CUSTOMER_GONE =
  'このお客様は、その間に台帳から削除されました。施術記録は書けません。'

/** What the day of the next visit is said to be when it is before the booking */
const nextDateTooEarlyOf = (bookingDay: string): string =>
  `次に勧める日は、予約の日（${bookingDay}）から後の日にしてください。`
/**
 * A number as a person types it: digits of full width count. Nothing is no
 * number; what is not written as one is `undefined`.
 */
export const numberOf = (
  text: string,
  decimals: number,
): number | null | undefined => {
  const digits = text.normalize('NFKC').trim()
  if (digits === '') {
    return null
  }
  const pattern =
    decimals === 0
      ? /^\d{1,9}$/
      : new RegExp(`^\\d{1,9}(\\.\\d{1,${decimals}})?$`)

  return pattern.test(digits) ? Number(digits) : undefined
}

/** A material as it was filled in; `lotNumber` is `null` where the row has no control for it. */
type FilledMaterial = {
  productId: string
  quantity: string
  unit: string
  lotNumber: string | null
  notes: string
}

/** The materials the form was sent with, from the row of the number `index` on. */
const materialsIn = (values: FormData, index: number): FilledMaterial[] => {
  const lot = values.get(materialControlOf(index, 'lotNumber'))

  return values.has(materialControlOf(index, 'productId'))
    ? [
        {
          productId: textOf(values, materialControlOf(index, 'productId')),
          quantity: textOf(values, materialControlOf(index, 'quantity')),
          unit: textOf(values, materialControlOf(index, 'unit')),
          lotNumber: typeof lot === 'string' ? lot : null,
          notes: textOf(values, materialControlOf(index, 'notes')),
        },
        ...materialsIn(values, index + 1),
      ]
    : []
}

/**
 * What is wrong with the lot number of a material, if anything: a product
 * kept by lots needs one, and another takes none. Of a product the salon
 * no longer has, the number is kept as it was written.
 */
const lotErrorOf = (
  product: ModelsProductResponse | undefined,
  lotNumber: string | null,
): string | undefined => {
  if (lotNumber !== null && lengthOf(lotNumber) > LONGEST_LOT_NUMBER) {
    return LOT_TOO_LONG
  }
  if (product === undefined) {
    return undefined
  }
  if (product.requiresLotTracking) {
    return lotNumber === null ? LOT_MISSING : undefined
  }

  return lotNumber === null ? undefined : LOT_NOT_TAKEN
}

type MaterialRead =
  | { type: 'valid'; material: ModelsTreatmentMaterial }
  | { type: 'invalid'; errors: [string, string][] }

const readMaterial = (
  index: number,
  filled: FilledMaterial,
  products: readonly ModelsProductResponse[],
): MaterialRead => {
  const productId = filled.productId.trim()
  const product = products.find(({ id }) => id === productId)
  const quantity = numberOf(filled.quantity, 2)
  const unit = filled.unit.trim()
  const lotNumber = textOrNull(filled.lotNumber)
  const errors = [
    ...errorAt(
      materialControlOf(index, 'productId'),
      productId === '' ? PRODUCT_MISSING : undefined,
    ),
    ...errorAt(
      materialControlOf(index, 'quantity'),
      quantity === null ||
        quantity === undefined ||
        quantity <= 0 ||
        quantity > MOST_QUANTITY
        ? QUANTITY_ERROR
        : undefined,
    ),
    ...errorAt(
      materialControlOf(index, 'unit'),
      unit === ''
        ? UNIT_MISSING
        : lengthOf(unit) > LONGEST_UNIT
          ? UNIT_TOO_LONG
          : undefined,
    ),
    ...errorAt(
      materialControlOf(index, 'lotNumber'),
      lotErrorOf(product, lotNumber),
    ),
  ]
  if (quantity === null || quantity === undefined || errors.length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    material: {
      productId,
      quantity,
      unit,
      lotNumber,
      notes: textOrNull(filled.notes),
    },
  }
}

/** The IDs chosen under a name, each once. */
const chosenIn = (values: FormData, name: string): string[] => [
  ...new Set(
    values
      .getAll(name)
      .flatMap((value) => (typeof value === 'string' ? [value] : [])),
  ),
]

/** What is wrong with the techniques, if anything. */
const techniquesErrorOf = (
  techniques: readonly string[],
): string | undefined => {
  if (techniques.some((name) => lengthOf(name) > LONGEST_TECHNIQUE)) {
    return TECHNIQUE_TOO_LONG
  }

  return techniques.length > MOST_IN_A_LIST ? TOO_MANY_TECHNIQUES : undefined
}

/** What a satisfaction was chosen as: nothing is not recorded */
const satisfactionOf = (text: string): number | null | undefined => {
  if (text === '') {
    return null
  }
  const satisfaction = Number(text)

  return Number.isInteger(satisfaction) &&
    satisfaction >= 1 &&
    satisfaction <= 5
    ? satisfaction
    : undefined
}

/** What every record of the form holds: everything but its booking, its customer and its staff member. */
type TreatmentWhole = Omit<
  ModelsTreatmentRecordCreateRequest,
  'bookingId' | 'customerId' | 'staffId'
>

/** What the form reads its values against. */
export type TreatmentContext = {
  /** The products the materials may be of: those the salon has */
  products: readonly ModelsProductResponse[]
  /** The day of the booking at the salon: the next visit is not recommended before it */
  bookingDay: string
}

/** What is wrong with the day of the next visit, if anything. */
const dateErrorOf = (date: string, bookingDay: string): string | undefined => {
  if (date === '') {
    return undefined
  }
  if (!isDay(date)) {
    return DATE_ERROR
  }

  return date < bookingDay ? nextDateTooEarlyOf(bookingDay) : undefined
}

/** Everything the form holds but the staff member. */
const readWhole = (
  values: FormData,
  { products, bookingDay }: TreatmentContext,
): FormRead<TreatmentWhole> => {
  const services = chosenIn(values, 'services')
  const techniques = tagsIn(textOf(values, 'techniques'))
  const processingTime = numberOf(textOf(values, 'processingTime'), 0)
  const nextRecommendedDate = textOf(values, 'nextRecommendedDate').trim()
  const nextRecommendedServices = chosenIn(values, 'nextRecommendedServices')
  const customerSatisfaction = satisfactionOf(
    textOf(values, 'customerSatisfaction'),
  )
  const filled = materialsIn(values, 0)
  const materials = filled.map((material, index) =>
    readMaterial(index, material, products),
  )
  const errors: Record<string, string> = Object.fromEntries([
    ...errorAt(
      'services',
      services.length === 0
        ? SERVICES_MISSING
        : services.length > MOST_IN_A_LIST
          ? TOO_MANY_SERVICES
          : undefined,
    ),
    ...errorAt('techniques', techniquesErrorOf(techniques)),
    ...errorAt(
      'processingTime',
      processingTime === undefined ||
        (processingTime !== null && processingTime > LONGEST_TREATMENT)
        ? TIME_ERROR
        : undefined,
    ),
    ...errorAt(
      'nextRecommendedDate',
      dateErrorOf(nextRecommendedDate, bookingDay),
    ),
    ...errorAt(
      'nextRecommendedServices',
      nextRecommendedServices.length > MOST_IN_A_LIST
        ? TOO_MANY_NEXT_SERVICES
        : undefined,
    ),
    ...errorAt(
      'customerSatisfaction',
      customerSatisfaction === undefined ? SATISFACTION_ERROR : undefined,
    ),
    ...materials.flatMap((material) =>
      material.type === 'invalid' ? material.errors : [],
    ),
  ])
  if (
    processingTime === undefined ||
    customerSatisfaction === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      services,
      techniques,
      consultationNotes: textOrNull(textOf(values, 'consultationNotes')),
      scalpCondition: textOrNull(textOf(values, 'scalpCondition')),
      hairCondition: textOrNull(textOf(values, 'hairCondition')),
      colorFormula: textOrNull(textOf(values, 'colorFormula')),
      processingTime,
      resultNotes: textOrNull(textOf(values, 'resultNotes')),
      nextRecommendedDate:
        nextRecommendedDate === '' ? null : nextRecommendedDate,
      nextRecommendedServices,
      homeCareSuggestions: textOrNull(textOf(values, 'homeCareSuggestions')),
      customerSatisfaction,
      staffEvaluation: textOrNull(textOf(values, 'staffEvaluation')),
      materials: materials.flatMap((material) =>
        material.type === 'valid' ? [material.material] : [],
      ),
    },
  }
}

/** The record a form writes of the treatment of a booking: its customer is that of the booking. */
export const readTreatmentEntry = (
  values: FormData,
  booking: Pick<ModelsBookingResponse, 'id' | 'customerId'>,
  context: TreatmentContext,
): FormRead<ModelsTreatmentRecordCreateRequest> => {
  const staffId = textOf(values, 'staffId').trim()
  const read = readWhole(values, context)
  const staffErrors = errorAt(
    'staffId',
    staffId === '' ? STAFF_MISSING : undefined,
  )
  if (read.type === 'invalid' || staffErrors.length > 0) {
    return {
      type: 'invalid',
      errors: {
        ...Object.fromEntries(staffErrors),
        ...(read.type === 'invalid' ? read.errors : {}),
      },
    }
  }

  return {
    type: 'valid',
    value: {
      bookingId: booking.id,
      customerId: booking.customerId,
      staffId,
      ...read.value,
    },
  }
}
/**
 * Whether two lists of services hold the same ones: the form lists them in
 * the order of the menu, which need not be the order the record keeps.
 */
const sameServices = (
  one: readonly string[],
  other: readonly string[],
): boolean => {
  const kept = new Set(other)

  return one.length === kept.size && one.every((id) => kept.has(id))
}

/** The materials of a record as the form reads them back. */
const shownMaterialsOf = (
  record: ModelsTreatmentRecordResponse,
): ModelsTreatmentMaterial[] =>
  record.materials.map(({ productId, quantity, unit, lotNumber, notes }) => ({
    productId,
    quantity,
    unit: unit.trim(),
    lotNumber: textOrNull(lotNumber),
    notes: textOrNull(notes),
  }))

/** What a change of a record asks for: nothing, when nothing was changed. */
export type TreatmentChange =
  | FormRead<ModelsTreatmentRecordUpdateRequest>
  | { type: 'unchanged' }

/** Whether a text of the form is that of the record: what the record holds is read as the form reads it. */
const sameText = (before: string | null, now: string | null): boolean =>
  textOrNull(before) === now

/**
 * What was changed in the form: the properties whose values are others
 * than those of the record it was opened with. A list that was changed is
 * sent whole, as the API puts it in place of the list it holds; so are the
 * materials. The staff member of a record is not changed.
 */
export const readTreatmentChange = (
  values: FormData,
  shown: ModelsTreatmentRecordResponse,
  context: TreatmentContext,
): TreatmentChange => {
  const read = readWhole(values, context)
  if (read.type === 'invalid') {
    return read
  }
  const sent = read.value
  const changes: ModelsTreatmentRecordUpdateRequest = {
    ...(sameServices(sent.services, shown.services)
      ? {}
      : { services: sent.services }),
    ...(same(sent.techniques, shown.techniques)
      ? {}
      : { techniques: sent.techniques }),
    ...(sameText(shown.consultationNotes, sent.consultationNotes)
      ? {}
      : { consultationNotes: sent.consultationNotes }),
    ...(sameText(shown.scalpCondition, sent.scalpCondition)
      ? {}
      : { scalpCondition: sent.scalpCondition }),
    ...(sameText(shown.hairCondition, sent.hairCondition)
      ? {}
      : { hairCondition: sent.hairCondition }),
    ...(sameText(shown.colorFormula, sent.colorFormula)
      ? {}
      : { colorFormula: sent.colorFormula }),
    ...(shown.processingTime === sent.processingTime
      ? {}
      : { processingTime: sent.processingTime }),
    ...(sameText(shown.resultNotes, sent.resultNotes)
      ? {}
      : { resultNotes: sent.resultNotes }),
    ...(shown.nextRecommendedDate === sent.nextRecommendedDate
      ? {}
      : { nextRecommendedDate: sent.nextRecommendedDate }),
    ...(sameServices(
      sent.nextRecommendedServices,
      shown.nextRecommendedServices,
    )
      ? {}
      : { nextRecommendedServices: sent.nextRecommendedServices }),
    ...(sameText(shown.homeCareSuggestions, sent.homeCareSuggestions)
      ? {}
      : { homeCareSuggestions: sent.homeCareSuggestions }),
    ...(shown.customerSatisfaction === sent.customerSatisfaction
      ? {}
      : { customerSatisfaction: sent.customerSatisfaction }),
    ...(sameText(shown.staffEvaluation, sent.staffEvaluation)
      ? {}
      : { staffEvaluation: sent.staffEvaluation }),
    ...(same(sent.materials, shownMaterialsOf(shown))
      ? {}
      : { materials: sent.materials }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

const MATERIAL_FIELD = /^materials\.(\d+)\.(productId|quantity|unit|lotNumber)$/
const LIST_FIELD = /^(services|techniques|nextRecommendedServices)(\.\d+)?$/

/**
 * What the API says is wrong with a control of a material, in the words of
 * the form. A lot number the form held to its product is refused when the
 * salon changed meanwhile whether the product is kept by lots.
 */
const materialSaidOf = (name: string, rule: string): string =>
  match(name)
    .returnType<string>()
    .with('productId', () =>
      rule === 'not_found' ? PRODUCT_GONE : PRODUCT_MISSING,
    )
    .with('quantity', () => QUANTITY_ERROR)
    .with('unit', () => (rule === 'too_big' ? UNIT_TOO_LONG : UNIT_MISSING))
    .otherwise(() => (rule === 'too_big' ? LOT_TOO_LONG : LOT_CHANGED))

/** What the API says is wrong with a list, in the words of the form. */
const listSaidOf = (
  name: string,
  item: string | undefined,
  rule: string,
): string =>
  match(name)
    .returnType<string>()
    .with('techniques', () =>
      item === undefined ? TOO_MANY_TECHNIQUES : TECHNIQUE_TOO_LONG,
    )
    .with('nextRecommendedServices', () =>
      item === undefined ? TOO_MANY_NEXT_SERVICES : SERVICE_GONE,
    )
    .otherwise(() =>
      item !== undefined || rule === 'not_found'
        ? SERVICE_GONE
        : rule === 'too_small'
          ? SERVICES_MISSING
          : TOO_MANY_SERVICES,
    )

/**
 * Where the form says what the API refused, and in what words; `undefined`
 * for what it has no control of.
 */
const saidOf = (
  { field, rule }: RefusedValue,
  bookingDay: string,
): [string, string] | undefined => {
  const material = MATERIAL_FIELD.exec(field)
  if (material?.[2] !== undefined) {
    return [field, materialSaidOf(material[2], rule)]
  }
  const list = LIST_FIELD.exec(field)
  if (list?.[1] !== undefined) {
    // An entry is wrong under its place in the list, the list itself under its name
    return [list[1], listSaidOf(list[1], list[2], rule)]
  }

  return match(field)
    .returnType<[string, string] | undefined>()
    .with('staffId', () => [field, STAFF_GONE])
    .with('processingTime', () => [field, TIME_ERROR])
    .with('nextRecommendedDate', () => [
      field,
      rule === 'too_small' ? nextDateTooEarlyOf(bookingDay) : DATE_ERROR,
    ])
    .with('customerSatisfaction', () => [field, SATISFACTION_ERROR])
    .otherwise(() => undefined)
}

/** Which write a form makes: the words of its failure differ. */
export type TreatmentWriteKind = 'entry' | 'change'

const FAILED_WRITES: Record<TreatmentWriteKind, string> = {
  entry:
    '施術記録を書けませんでした。通信の状態を確かめて、もう一度お試しください。',
  change:
    '施術記録を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
}

/** What the form says after the API refused it, or after nothing came of it. */
export const afterTreatmentWrite = (
  outcome: Extract<
    TreatmentWrite,
    { type: 'invalid' | 'forbidden' | 'tooManyRequests' | 'failed' }
  >,
  write: TreatmentWriteKind,
  bookingDay: string,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const at = saidOf(value, bookingDay)

        return at === undefined ? [] : [at]
      })

      return {
        // The customer of a record is that of its booking, and no control
        message: values.some(({ field }) => field === 'customerId')
          ? CUSTOMER_GONE
          : said.length < values.length
            ? CHECK_THE_VALUES_MESSAGE
            : undefined,
        // The first thing the API says about a control is the one to act on
        errors: Object.fromEntries(said.toReversed()),
      }
    })
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt('このアカウントでは、施術記録を書けません。'),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(FAILED_WRITES[write]))
    .exhaustive()

/**
 * What is said when the record was written or changed: 「田中 由紀 様の
 * 施術記録を書きました。」. The customer is named as `customerCalled` names them.
 */
export const treatmentWrittenOf = (
  name: string,
  write: TreatmentWriteKind,
): string =>
  write === 'entry'
    ? `${name}の施術記録を書きました。`
    : `${name}の施術記録を直しました。`

/** What is said when another account wrote the record of the booking meanwhile */
export const TREATMENT_EXISTS =
  'その間に、ほかのアカウントがこの予約の施術記録を書いていました。書いた内容は、その施術記録を直して書き足してください。'

/** What is said when the booking was cancelled meanwhile, or is not begun */
export const TREATMENT_NOT_BEGUN =
  'この予約は、施術中でも完了でもありません。施術を始めた予約に、施術記録を書けます。'
