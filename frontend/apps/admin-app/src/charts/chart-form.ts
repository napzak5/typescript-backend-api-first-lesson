import {
  CHECK_THE_VALUES_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsMedicalChartCreateRequest,
  type ModelsMedicalChartResponse,
  type ModelsMedicalChartUpdateRequest,
  type ModelsPreviousTreatment,
  ModelsTreatmentType,
} from '@beauty-salon-frontend/api-client'
import {
  EARLIEST_DAY,
  eachTooLongOf,
  isDay,
  lengthOf,
  tooLongError,
  tooLongOf,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type ChoiceOption,
  errorAt,
  type FormRead,
  type FormSays,
  same,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { tagsIn } from '../customers/customer-ledger'
import type { ChartWrite } from './charts-api'

/*
 * The form of a chart: what it reads, what it says is wrong, and what is
 * said after it was sent. The treatments the customer had before are
 * rows of controls named by the number the row has now, counted from 0
 * (`previousTreatments.1.date`), as the API names what is wrong with one.
 */

const TREATMENT_NAMES: Record<ModelsTreatmentType, string> = {
  cut: 'カット',
  color: 'カラー',
  perm: 'パーマ',
  treatment: 'トリートメント',
  head_spa: 'ヘッドスパ',
  styling: 'スタイリング',
  extension: 'エクステンション',
  nail: 'ネイル',
  eyelash: 'まつげ',
  other: 'その他',
}

const TREATMENTS: readonly ModelsTreatmentType[] =
  Object.values(ModelsTreatmentType)

/** What a treatment is called: 「ヘッドスパ」. */
export const treatmentNameOf = (treatment: ModelsTreatmentType): string =>
  TREATMENT_NAMES[treatment]

/** The treatments a row offers, in the order of the contract. */
export const TREATMENT_OPTIONS: readonly ChoiceOption[] = TREATMENTS.map(
  (treatment) => ({ value: treatment, label: TREATMENT_NAMES[treatment] }),
)

/** The name of a control of the row of the number `index`, counted from 0; what is wrong with it is kept under the same name */
export const rowControlOf = (
  index: number,
  name: keyof ModelsPreviousTreatment,
): string => `previousTreatments.${index}.${name}`

/** The most treatments a chart holds, and the most names of products in a list */
export const MOST_TREATMENTS = 50
const MOST_PRODUCTS = 50

/** A text written as a day, whether or not the day is one the API takes */
const DAY = /^\d{4}-\d{2}-\d{2}$/
const LONGEST_SALON_NAME = 255
const LONGEST_PRODUCT_NAME = 100

const TREATMENT_MISSING = '施術を選んでください。'
const DATE_MISSING = '施術日を入力してください。'
const DATE_TOO_EARLY = '施術日は、1900年1月1日以降にしてください。'
const DATE_TOO_LATE = '施術日は、今日までにしてください。'
const SALON_NAME_TOO_LONG = tooLongOf('サロンの名前', LONGEST_SALON_NAME)
const PRODUCT_NAME_TOO_LONG = eachTooLongOf('商材の名前', LONGEST_PRODUCT_NAME)
const TOO_MANY_PRODUCTS = `商材は、${MOST_PRODUCTS} 件までで入力してください。`
const treatmentFrom = (value: string): ModelsTreatmentType | undefined =>
  TREATMENTS.find((treatment) => treatment === value)

/** A row of a treatment as it was filled in */
type FilledRow = {
  treatment: string
  date: string
  salonName: string
  notes: string
}

/** The rows of treatments the form was sent with, from the row of the number `index` on. */
const rowsIn = (values: FormData, index: number): FilledRow[] =>
  values.has(rowControlOf(index, 'treatment'))
    ? [
        {
          treatment: textOf(values, rowControlOf(index, 'treatment')),
          date: textOf(values, rowControlOf(index, 'date')),
          salonName: textOf(values, rowControlOf(index, 'salonName')),
          notes: textOf(values, rowControlOf(index, 'notes')),
        },
        ...rowsIn(values, index + 1),
      ]
    : []

/** What is wrong with the day of a treatment, if anything. */
const dateErrorOf = (date: string, today: string): string | undefined => {
  if (DAY.test(date) && date < EARLIEST_DAY) {
    return DATE_TOO_EARLY
  }
  if (!isDay(date)) {
    return DATE_MISSING
  }

  return date > today ? DATE_TOO_LATE : undefined
}
type RowRead =
  | { type: 'valid'; row: ModelsPreviousTreatment }
  | { type: 'invalid'; errors: [string, string][] }

const readRow = (index: number, filled: FilledRow, today: string): RowRead => {
  const treatment = treatmentFrom(filled.treatment)
  const date = filled.date.trim()
  const salonName = textOrNull(filled.salonName)
  const errors = [
    ...errorAt(
      rowControlOf(index, 'treatment'),
      treatment === undefined ? TREATMENT_MISSING : undefined,
    ),
    ...errorAt(rowControlOf(index, 'date'), dateErrorOf(date, today)),
    ...errorAt(
      rowControlOf(index, 'salonName'),
      tooLongError(salonName, LONGEST_SALON_NAME, SALON_NAME_TOO_LONG),
    ),
  ]
  if (treatment === undefined || errors.length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    row: { treatment, date, salonName, notes: textOrNull(filled.notes) },
  }
}

/** What is wrong with a list of names of products, if anything. */
const productsErrorOf = (names: readonly string[]): string | undefined => {
  if (names.some((name) => lengthOf(name) > LONGEST_PRODUCT_NAME)) {
    return PRODUCT_NAME_TOO_LONG
  }

  return names.length > MOST_PRODUCTS ? TOO_MANY_PRODUCTS : undefined
}

/** A chart as a form gives it: everything but its customer. */
type ChartWhole = Omit<ModelsMedicalChartCreateRequest, 'customerId'>

/**
 * Everything the form holds. A day after today at the salon is refused,
 * as the API refuses it; the names of products are written as tags are,
 * each once.
 */
const readWhole = (values: FormData, today: string): FormRead<ChartWhole> => {
  const rows = rowsIn(values, 0).map((filled, index) =>
    readRow(index, filled, today),
  )
  const preferredProducts = tagsIn(textOf(values, 'preferredProducts'))
  const avoidProducts = tagsIn(textOf(values, 'avoidProducts'))
  const preferredError = productsErrorOf(preferredProducts)
  const avoidError = productsErrorOf(avoidProducts)
  const errors: Record<string, string> = {
    ...Object.fromEntries(
      rows.flatMap((row) => (row.type === 'invalid' ? row.errors : [])),
    ),
    ...(preferredError === undefined
      ? {}
      : { preferredProducts: preferredError }),
    ...(avoidError === undefined ? {} : { avoidProducts: avoidError }),
  }
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      previousTreatments: rows.flatMap((row) =>
        row.type === 'valid' ? [row.row] : [],
      ),
      medicalConditions: textOrNull(textOf(values, 'medicalConditions')),
      preferredProducts,
      avoidProducts,
      notes: textOrNull(textOf(values, 'notes')),
    },
  }
}

/** The chart a form makes for a customer. */
export const readChartEntry = (
  values: FormData,
  customerId: string,
  today: string,
): FormRead<ModelsMedicalChartCreateRequest> => {
  const read = readWhole(values, today)

  return read.type === 'invalid'
    ? read
    : { type: 'valid', value: { customerId, ...read.value } }
}
/** The treatments of a chart as the form reads them back. */
const shownTreatmentsOf = (
  chart: ModelsMedicalChartResponse,
): ModelsPreviousTreatment[] =>
  chart.previousTreatments.map(({ treatment, date, salonName, notes }) => ({
    treatment,
    date,
    salonName: textOrNull(salonName),
    notes: textOrNull(notes),
  }))

/** What a change of a chart asks for: nothing, when nothing was changed. */
export type ChartChange =
  | FormRead<ModelsMedicalChartUpdateRequest>
  | { type: 'unchanged' }

/**
 * What was changed in the form: the properties whose values are others
 * than those of the chart it was opened with. A list that was changed is
 * sent whole, as the API puts it in place of the list it holds.
 */
export const readChartChange = (
  values: FormData,
  shown: ModelsMedicalChartResponse,
  today: string,
): ChartChange => {
  const read = readWhole(values, today)
  if (read.type === 'invalid') {
    return read
  }
  const sent = read.value
  const changes: ModelsMedicalChartUpdateRequest = {
    ...(same(sent.previousTreatments, shownTreatmentsOf(shown))
      ? {}
      : { previousTreatments: sent.previousTreatments }),
    ...(sent.medicalConditions === textOrNull(shown.medicalConditions)
      ? {}
      : { medicalConditions: sent.medicalConditions }),
    ...(same(sent.preferredProducts, shown.preferredProducts)
      ? {}
      : { preferredProducts: sent.preferredProducts }),
    ...(same(sent.avoidProducts, shown.avoidProducts)
      ? {}
      : { avoidProducts: sent.avoidProducts }),
    ...(sent.notes === textOrNull(shown.notes) ? {} : { notes: sent.notes }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

const ROW_FIELD = /^previousTreatments\.(\d+)\.(treatment|date|salonName)$/
const PRODUCT_FIELD = /^(preferredProducts|avoidProducts)(\.\d+)?$/

/** Where the form says what the API refused, and in what words; `undefined` for what it has no control of. */
const saidOf = ({
  field,
  rule,
}: RefusedValue): [string, string] | undefined => {
  const row = ROW_FIELD.exec(field)
  if (row !== null) {
    return [
      field,
      match(row[2])
        .returnType<string>()
        .with('date', () =>
          rule === 'too_big'
            ? DATE_TOO_LATE
            : rule === 'too_small'
              ? DATE_TOO_EARLY
              : DATE_MISSING,
        )
        .with('salonName', () => SALON_NAME_TOO_LONG)
        .otherwise(() => TREATMENT_MISSING),
    ]
  }
  const products = PRODUCT_FIELD.exec(field)
  if (products?.[1] !== undefined) {
    // A name is too long under its place in the list, the list itself is too long under its name
    return [
      products[1],
      products[2] === undefined ? TOO_MANY_PRODUCTS : PRODUCT_NAME_TOO_LONG,
    ]
  }

  return undefined
}

/** Which write a form makes: the words of its failure differ. */
export type ChartWriteKind = 'entry' | 'change'

const FAILED_WRITES: Record<ChartWriteKind, string> = {
  entry:
    'カルテを作れませんでした。通信の状態を確かめて、もう一度お試しください。',
  change:
    'カルテを直せませんでした。通信の状態を確かめて、もう一度お試しください。',
}

/** What the form says after the API refused it, or after nothing came of it. */
export const afterChartWrite = (
  outcome: Extract<
    ChartWrite,
    { type: 'invalid' | 'forbidden' | 'tooManyRequests' | 'failed' }
  >,
  write: ChartWriteKind,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const at = saidOf(value)

        return at === undefined ? [] : [at]
      })

      return {
        message:
          said.length < values.length ? CHECK_THE_VALUES_MESSAGE : undefined,
        // The first thing the API says about a control is the one to act on
        errors: Object.fromEntries(said.toReversed()),
      }
    })
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt('このアカウントでは、カルテを書けません。'),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(FAILED_WRITES[write]))
    .exhaustive()

/** What is said when the chart was made or changed: 「山田 花子 様のカルテを作りました。」. */
export const chartWrittenOf = (name: string, write: ChartWriteKind): string =>
  write === 'entry'
    ? `${name} 様のカルテを作りました。`
    : `${name} 様のカルテを直しました。`

/** What is said when another account made the chart meanwhile */
export const CHART_EXISTS =
  'その間に、ほかのアカウントがこのお客様のカルテを作っていました。書いた内容は、そのカルテを直して書き足してください。'
