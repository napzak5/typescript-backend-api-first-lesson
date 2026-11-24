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
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import * as z from 'zod'
import { numberOf } from '../../treatments/utils/treatment-form'
import type { TreatmentRemovalSays } from '../../treatments/utils/treatment-format'
import type { CategoryRemoval, CategoryWrite } from '../api/menu-api'

/*
 * The form of a category of the menu: what it sends, and what it says
 * about the answers.
 */

/** The longest name of a category the API takes */
export const LONGEST_NAME = 100

const { categories: CATEGORY_WORDS } = adminMenuMessages
const { errors: WORDS, removal: REMOVAL } = CATEGORY_WORDS

const NAME_ERROR = neededWithin(WORDS.name, LONGEST_NAME)

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
): FormRead<ModelsServiceCategoryCreateRequest, FormErrors<LocalizedText>> => {
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
    ...(kind === undefined ? { category: WORDS.type } : {}),
    ...(displayOrder === null || displayOrder === undefined
      ? { displayOrder: WORDS.displayOrder }
      : {}),
    ...Object.fromEntries(errorAt('iconUrl', webAddressError(iconUrl))),
    ...(color === null || colorSchema.safeParse(color).success
      ? {}
      : { color: WORDS.color }),
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
): FormRead<ModelsServiceCategoryCreateRequest, FormErrors<LocalizedText>> =>
  readWhole(values)

/** What a change of a category asks for: nothing, when nothing was changed. */
type CategoryChange =
  | FormRead<ModelsServiceCategoryUpdateRequest, FormErrors<LocalizedText>>
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
const refusalAt = (field: string, rule: string): LocalizedText =>
  match(field)
    .with('name', () => NAME_ERROR)
    .with('displayOrder', () => WORDS.displayOrder)
    .with('iconUrl', () => WEB_ADDRESS_ERROR)
    .with('color', () => WORDS.color)
    .with('parentId', () =>
      rule === 'circular' ? WORDS.parentBelow : WORDS.parentGone,
    )
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
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt(adminMenuMessages.forbidden),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(CATEGORY_WORDS.saveFailed))
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
      message: REMOVAL.done(name),
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: adminMenuMessages.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: REMOVAL.failed,
    }))
    .exhaustive()
