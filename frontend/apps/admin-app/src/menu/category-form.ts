import type {
  ModelsServiceCategoryCreateRequest,
  ModelsServiceCategoryResponse,
  ModelsServiceCategoryUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { match } from 'ts-pattern'
import * as z from 'zod'
import { type Read, textOf } from '../bookings/booking-actions'
import {
  type FormSays,
  nullIfBlank,
  TOO_MANY_REQUESTS,
} from '../bookings/booking-entry'
import { CATEGORIES } from '../customers/customer-format'
import { numberOf } from '../treatments/treatment-form'
import type { TreatmentRemovalSays } from '../treatments/treatment-format'
import type { CategoryRemoval, CategoryWrite } from './menu-api'

/*
 * The form of a category of the menu: what it sends, and what it says
 * about the answers.
 */

const LONGEST_NAME = 100
const LONGEST_URL = 500

const NAME_ERROR = `カテゴリーの名前を、${LONGEST_NAME} 文字までで入力してください。`
const KIND_ERROR = '種類を選んでください。'
const ORDER_ERROR = '表示順は、0 以上の整数で入力してください。'
const ICON_ERROR = `ドメイン名で書いた http:// か https:// の URL を、${LONGEST_URL} 文字までで入力してください。`
const COLOR_ERROR =
  '色は、#C8A2C8 のように、# と 16 進数 6 桁で入力してください。'

/** What is said at the parent when it was removed meanwhile */
const PARENT_GONE =
  'この親カテゴリーは、その間に削除されていました。親を選び直してください。'

/** What is said at the parent when it is below the category now */
const PARENT_BELOW =
  'このカテゴリーの下にあるカテゴリーは、親にできません。その間に、親が変わっていました。選び直してください。'

const iconSchema = z.httpUrl().check(z.maxLength(LONGEST_URL))
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
): Read<ModelsServiceCategoryCreateRequest> => {
  const optional = (name: string): string | null =>
    nullIfBlank(textOf(values, name))
  const name = textOf(values, 'name').trim()
  const kind = CATEGORIES.find((one) => one === textOf(values, 'category'))
  const displayOrder = numberOf(textOf(values, 'displayOrder'), 0)
  const iconUrl = optional('iconUrl')
  const color = optional('color')
  const errors = {
    ...(name === '' || name.length > LONGEST_NAME ? { name: NAME_ERROR } : {}),
    ...(kind === undefined ? { category: KIND_ERROR } : {}),
    ...(displayOrder === null || displayOrder === undefined
      ? { displayOrder: ORDER_ERROR }
      : {}),
    ...(iconUrl === null || iconSchema.safeParse(iconUrl).success
      ? {}
      : { iconUrl: ICON_ERROR }),
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
    request: {
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
): Read<ModelsServiceCategoryCreateRequest> => readWhole(values)

/** What a change of a category asks for: nothing, when nothing was changed. */
type CategoryChange =
  | Read<ModelsServiceCategoryUpdateRequest>
  | { type: 'unchanged' }

/** A text as the form reads it back: without the spaces around it, nothing as `null`. */
const shownText = (text: string | null): string | null =>
  nullIfBlank(text ?? '')

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
  const sent = read.request
  const changes: ModelsServiceCategoryUpdateRequest = {
    ...(sent.name === shown.name.trim() ? {} : { name: sent.name }),
    ...(sent.description === shownText(shown.description)
      ? {}
      : { description: sent.description }),
    ...(sent.parentId === shown.parentId ? {} : { parentId: sent.parentId }),
    ...(sent.category === shown.category ? {} : { category: sent.category }),
    ...(sent.displayOrder === shown.displayOrder
      ? {}
      : { displayOrder: sent.displayOrder }),
    ...(sent.iconUrl === shownText(shown.iconUrl)
      ? {}
      : { iconUrl: sent.iconUrl }),
    ...(sent.color === (shown.color?.toUpperCase() ?? null)
      ? {}
      : { color: sent.color }),
    ...(sent.isActive === shown.isActive ? {} : { isActive: sent.isActive }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', request: changes }
}

/** What is said when the account may not change the menu of the salon */
const FORBIDDEN_MESSAGE =
  'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'

/** What is said at a control the API refused a value of. */
const errorAt = (field: string, rule: string): string =>
  match(field)
    .with('name', () => NAME_ERROR)
    .with('displayOrder', () => ORDER_ERROR)
    .with('iconUrl', () => ICON_ERROR)
    .with('color', () => COLOR_ERROR)
    .with('parentId', () => (rule === 'circular' ? PARENT_BELOW : PARENT_GONE))
    .otherwise(
      () => 'この値は受け付けられませんでした。入力を確かめてください。',
    )

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
        message:
          said.length === 0
            ? '入力した内容を確かめて、もう一度お試しください。'
            : undefined,
        errors: Object.fromEntries(
          said.map(({ field, rule }) => [field, errorAt(field, rule)]),
        ),
      }
    })
    .with({ type: 'forbidden' }, () => ({
      message: FORBIDDEN_MESSAGE,
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        'カテゴリーを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
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
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'カテゴリーを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
