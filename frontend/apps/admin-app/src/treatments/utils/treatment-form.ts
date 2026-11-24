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
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  errorAt,
  type FormErrors,
  type FormRead,
  type FormSays,
  same,
  textOf,
  textOrNull,
  textsOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { tagsIn } from '../../customers/utils/customer-ledger'
import type { TreatmentWrite } from '../api/treatments-api'

const { form: FORM } = adminTreatmentMessages
const { errors: ERRORS } = FORM

/** What is wrong with the values of the form, under the names of its controls */
type Errors = FormErrors<LocalizedText>

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
export const MOST_IN_A_LIST = 20
/** The most materials a record holds: the form offers no more rows */
export const MOST_MATERIALS = 50
/** The longest treatment, in minutes: a day */
export const LONGEST_TREATMENT = 1440
const LONGEST_TECHNIQUE = 100
const LONGEST_UNIT = 20
const LONGEST_LOT_NUMBER = 100
/** The most of a material, as the API keeps it */
const MOST_QUANTITY = 99_999_999.99

const TOO_MANY_SERVICES = ERRORS.tooManyServices(MOST_IN_A_LIST)
const TECHNIQUE_TOO_LONG = eachTooLongOf(FORM.techniqueName, LONGEST_TECHNIQUE)
const TOO_MANY_TECHNIQUES = ERRORS.tooManyTechniques(MOST_IN_A_LIST)
const TIME_ERROR = ERRORS.processingTime(LONGEST_TREATMENT)
const TOO_MANY_NEXT_SERVICES = ERRORS.tooManyNextServices(MOST_IN_A_LIST)
const UNIT_TOO_LONG = tooLongOf(FORM.unit, LONGEST_UNIT)
const LOT_TOO_LONG = tooLongOf(FORM.lotNumber, LONGEST_LOT_NUMBER)

/** What the day of the next visit is said to be when it is before the booking: the day as the screens write it */
const nextDateTooEarlyOf = (bookingDay: string): LocalizedText =>
  ERRORS.nextRecommendedDateTooEarly(dayNameOf(bookingDay))
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
): LocalizedText | undefined => {
  if (lotNumber !== null && lengthOf(lotNumber) > LONGEST_LOT_NUMBER) {
    return LOT_TOO_LONG
  }
  if (product === undefined) {
    return undefined
  }
  if (product.requiresLotTracking) {
    return lotNumber === null ? ERRORS.lotNumber : undefined
  }

  return lotNumber === null ? undefined : ERRORS.lotNumberNotTaken
}

type MaterialRead =
  | { type: 'valid'; material: ModelsTreatmentMaterial }
  | { type: 'invalid'; errors: [string, LocalizedText][] }

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
      productId === '' ? ERRORS.product : undefined,
    ),
    ...errorAt(
      materialControlOf(index, 'quantity'),
      quantity === null ||
        quantity === undefined ||
        quantity <= 0 ||
        quantity > MOST_QUANTITY
        ? ERRORS.quantity
        : undefined,
    ),
    ...errorAt(
      materialControlOf(index, 'unit'),
      unit === ''
        ? ERRORS.unit
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
  ...new Set(textsOf(values, name)),
]

/** What is wrong with the techniques, if anything. */
const techniquesErrorOf = (
  techniques: readonly string[],
): LocalizedText | undefined => {
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
const dateErrorOf = (
  date: string,
  bookingDay: string,
): LocalizedText | undefined => {
  if (date === '') {
    return undefined
  }
  if (!isDay(date)) {
    return ERRORS.nextRecommendedDate
  }

  return date < bookingDay ? nextDateTooEarlyOf(bookingDay) : undefined
}

/** Everything the form holds but the staff member. */
const readWhole = (
  values: FormData,
  { products, bookingDay }: TreatmentContext,
): FormRead<TreatmentWhole, Errors> => {
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
  const errors: Record<string, LocalizedText> = Object.fromEntries([
    ...errorAt(
      'services',
      services.length === 0
        ? ERRORS.services
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
      customerSatisfaction === undefined ? ERRORS.satisfaction : undefined,
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
): FormRead<ModelsTreatmentRecordCreateRequest, Errors> => {
  const staffId = textOf(values, 'staffId').trim()
  const read = readWhole(values, context)
  const staffErrors = errorAt(
    'staffId',
    staffId === '' ? ERRORS.staff : undefined,
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
  | FormRead<ModelsTreatmentRecordUpdateRequest, Errors>
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
const materialSaidOf = (name: string, rule: string): LocalizedText =>
  match(name)
    .returnType<LocalizedText>()
    .with('productId', () =>
      rule === 'not_found' ? ERRORS.productGone : ERRORS.product,
    )
    .with('quantity', () => ERRORS.quantity)
    .with('unit', () => (rule === 'too_big' ? UNIT_TOO_LONG : ERRORS.unit))
    .otherwise(() => (rule === 'too_big' ? LOT_TOO_LONG : ERRORS.lotsChanged))

/** What the API says is wrong with a list, in the words of the form. */
const listSaidOf = (
  name: string,
  item: string | undefined,
  rule: string,
): LocalizedText =>
  match(name)
    .returnType<LocalizedText>()
    .with('techniques', () =>
      item === undefined ? TOO_MANY_TECHNIQUES : TECHNIQUE_TOO_LONG,
    )
    .with('nextRecommendedServices', () =>
      item === undefined ? TOO_MANY_NEXT_SERVICES : ERRORS.serviceGone,
    )
    .otherwise(() =>
      item !== undefined || rule === 'not_found'
        ? ERRORS.serviceGone
        : rule === 'too_small'
          ? ERRORS.services
          : TOO_MANY_SERVICES,
    )

/**
 * Where the form says what the API refused, and in what words; `undefined`
 * for what it has no control of.
 */
const saidOf = (
  { field, rule }: RefusedValue,
  bookingDay: string,
): [string, LocalizedText] | undefined => {
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
    .returnType<[string, LocalizedText] | undefined>()
    .with('staffId', () => [field, ERRORS.staffGone])
    .with('processingTime', () => [field, TIME_ERROR])
    .with('nextRecommendedDate', () => [
      field,
      rule === 'too_small'
        ? nextDateTooEarlyOf(bookingDay)
        : ERRORS.nextRecommendedDate,
    ])
    .with('customerSatisfaction', () => [field, ERRORS.satisfaction])
    .otherwise(() => undefined)
}

/** Which write a form makes: the words of its failure differ. */
export type TreatmentWriteKind = 'entry' | 'change'

/** What the form says after the API refused it, or after nothing came of it. */
export const afterTreatmentWrite = (
  outcome: Extract<
    TreatmentWrite,
    { type: 'invalid' | 'forbidden' | 'tooManyRequests' | 'failed' }
  >,
  write: TreatmentWriteKind,
  bookingDay: string,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const at = saidOf(value, bookingDay)

        return at === undefined ? [] : [at]
      })

      return {
        // The customer of a record is that of its booking, and no control
        message: values.some(({ field }) => field === 'customerId')
          ? ERRORS.customerGone
          : said.length < values.length
            ? CHECK_THE_VALUES_MESSAGE
            : undefined,
        // The first thing the API says about a control is the one to act on
        errors: Object.fromEntries(said.toReversed()),
      }
    })
    .with({ type: 'forbidden' }, () => aboutTheAttempt(FORM.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(FORM.failed[write]))
    .exhaustive()

/**
 * What is said when the record was written or changed: 「田中 由紀 様の
 * 施術記録を書きました。」. The customer is named as a sentence names them
 * (`customerInASentence`).
 */
export const treatmentWrittenOf = (
  customer: LocalizedText,
  write: TreatmentWriteKind,
): LocalizedText => FORM.written[write](customer)
