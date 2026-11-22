import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsServiceCategoryCreateRequest,
  ModelsServiceCategoryResponse,
  ModelsServiceCategoryUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  neededError,
  neededWithin,
  SERVICE_CATEGORIES,
  WEB_ADDRESS_ERROR,
  webAddressError,
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
import * as z from 'zod'
import { numberOf } from '../treatments/treatment-form'
import type { TreatmentRemovalSays } from '../treatments/treatment-format'
import type { CategoryRemoval, CategoryWrite } from './menu-api'
import { FORBIDDEN_MESSAGE } from './service-form'

/*
 * The form of a category of the menu: what it sends, and what it says
 * about the answers.
 */

/** The longest name of a category the API takes */
export const LONGEST_NAME = 100

const NAME_ERROR = neededWithin('カテゴリーの名前', LONGEST_NAME)
const KIND_ERROR = '種類を選んでください。'
const ORDER_ERROR = '表示順は、0 以上の整数で入力してください。'
const COLOR_ERROR =
  '色は、#C8A2C8 のように、# と 16 進数 6 桁で入力してください。'

/** What is said at the parent when it was removed meanwhile */
const PARENT_GONE =
  'この親カテゴリーは、その間に削除されていました。親を選び直してください。'

/** What is said at the parent when it is below the category now */
const PARENT_BELOW =
  'このカテゴリーの下にあるカテゴリーは、親にできません。その間に、親が変わっていました。選び直してください。'

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/)

/** The controls of the form, by the names of the request */
const CONTROLS: readonly string[] = [
  'name',
  'description',
  'parentId',
  'category',
  'displayOrder',
  'iconUrl',
  'color',
  'isActive',
]

/** The whole category the form holds, or what is wrong with it. */
const readWhole = (
  values: FormData,
): FormRead<ModelsServiceCategoryCreateRequest> => {
  const optional = (name: string): string | null =>
    textOrNull(textOf(values, name))
  const name = textOf(values, 'name').trim()
  const kind = SERVICE_CATEGORIES.find(
    (one) => one === textOf(values, 'category'),
  )
  const displayOrder = numberOf(textOf(values, 'displayOrder'), 0)
  const iconUrl = optional('iconUrl')
  const color = optional('color')
  const errors = {
    ...Object.fromEntries(
      errorAt('name', neededError(name, LONGEST_NAME, NAME_ERROR)),
    ),
    ...(kind === undefined ? { category: KIND_ERROR } : {}),
    ...(displayOrder === null || displayOrder === undefined
      ? { displayOrder: ORDER_ERROR }
      : {}),
    ...Object.fromEntries(errorAt('iconUrl', webAddressError(iconUrl))),
    ...(color === null || colorSchema.safeParse(color).success
      ? {}
      : { color: COLOR_ERROR }),
  }
  if (
    kind === undefined ||
    displayOrder === null ||
    displayOrder === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      name,
      description: optional('description'),
      parentId: optional('parentId'),
      category: kind,
      displayOrder,
      iconUrl,
      color: color === null ? null : color.toUpperCase(),
      isActive: values.has('isActive'),
    },
  }
}

/** A new category, as the form holds it. */
export const readCategoryEntry = (
  values: FormData,
): FormRead<ModelsServiceCategoryCreateRequest> => readWhole(values)

/** What a change of a category asks for: nothing, when nothing was changed. */
type CategoryChange =
  | FormRead<ModelsServiceCategoryUpdateRequest>
  | { type: 'unchanged' }
/**
 * What was changed in the form: the values that are others than those of
 * the category it was opened with, each compared as the form reads it.
 */
export const readCategoryChange = (
  values: FormData,
  shown: ModelsServiceCategoryResponse,
): CategoryChange => {
  const read = readWhole(values)
  if (read.type === 'invalid') {
    return read
  }
  const sent = read.value
  const changes: ModelsServiceCategoryUpdateRequest = {
    ...(sent.name === shown.name.trim() ? {} : { name: sent.name }),
    ...(sent.description === textOrNull(shown.description)
      ? {}
      : { description: sent.description }),
    ...(sent.parentId === shown.parentId ? {} : { parentId: sent.parentId }),
    ...(sent.category === shown.category ? {} : { category: sent.category }),
    ...(sent.displayOrder === shown.displayOrder
      ? {}
      : { displayOrder: sent.displayOrder }),
    ...(sent.iconUrl === textOrNull(shown.iconUrl)
      ? {}
      : { iconUrl: sent.iconUrl }),
    ...(sent.color === (shown.color?.toUpperCase() ?? null)
      ? {}
      : { color: sent.color }),
    ...(sent.isActive === shown.isActive ? {} : { isActive: sent.isActive }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** What is said at a control the API refused a value of. */
const refusalAt = (field: string, rule: string): string =>
  match(field)
    .with('name', () => NAME_ERROR)
    .with('displayOrder', () => ORDER_ERROR)
    .with('iconUrl', () => WEB_ADDRESS_ERROR)
    .with('color', () => COLOR_ERROR)
    .with('parentId', () => (rule === 'circular' ? PARENT_BELOW : PARENT_GONE))
    .otherwise(() => REFUSED_VALUE_MESSAGE)

/** Whether a refusal is of the parent: the categories are read again, to choose from what there is now. */
export const refusesParent = (
  outcome: Extract<CategoryWrite, { type: 'invalid' }>,
): boolean => outcome.values.some(({ field }) => field === 'parentId')

/** What the form says after the API did not take it. */
export const afterCategoryWrite = (
  outcome:
    | Extract<CategoryWrite, { type: 'invalid' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.filter(({ field }) => CONTROLS.includes(field))

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          said.map(({ field, rule }) => [field, refusalAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'forbidden' }, () => aboutTheAttempt(FORBIDDEN_MESSAGE))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () =>
      aboutTheAttempt(
        'カテゴリーを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    )
    .exhaustive()

/**
 * What is said after a category was to be removed. Its children and its
 * services stay, and nothing else keeps a category from being removed.
 */
export const afterCategoryRemoval = (
  outcome: CategoryRemoval,
  name: string,
): TreatmentRemovalSays =>
  match(outcome)
    .returnType<TreatmentRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: `カテゴリー「${name}」を、メニューから削除しました。`,
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
        'カテゴリーを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
