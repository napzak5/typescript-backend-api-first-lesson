import type {
  ModelsServiceBulkUpdateRequest,
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
  ModelsServiceUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { textOf } from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import { type FormSays, TOO_MANY_REQUESTS } from '../bookings/booking-entry'
import type { Option } from '../customers/customer-format'
import { LEVELS } from '../staff/staff-format'
import type { ServicesChange } from './menu-api'
import {
  AVAILABILITIES,
  categoriesById,
  categoryPathOf,
  menuSectionsOf,
  SERVICE_STATUSES,
} from './menu-format'
import { CATEGORY_GONE, CHECK_AGAIN, FORBIDDEN_MESSAGE } from './service-form'

/*
 * The form that gives several services of the menu the same values: which
 * services, and which of their values. A control left at 「変えない」 sends
 * nothing, so each service keeps what it has there.
 */

/** The most services the API changes at once */
export const MOST_SERVICES = 100

/** The value of the choice that takes something away: no category, every member of the staff */
export const NONE = 'none'

const SERVICES_ERROR = '変えるサービスを、1 件以上選んでください。'
const TOO_MANY_SERVICES = `一度に変えられるサービスは、${MOST_SERVICES} 件までです。`
const NOTHING_TO_CHANGE =
  '変える項目を、1 つ以上選んでください。「変えない」のままでは、何も変わりません。'
const SERVICES_GONE =
  '選んだサービスのどれかが、その間にメニューから削除されていました。どのサービスも変えていません。いまのメニューから、選び直してください。'
const FAILED =
  'サービスを変えられませんでした。通信の状態を確かめて、もう一度お試しください。'

/** The choices of a value that is on or off */
export const SWITCH_ON = 'on'
export const SWITCH_OFF = 'off'

/**
 * The services the form offers, in the order of the menu (by category,
 * those of none last): each by its name, with the category it is in.
 */
export const serviceChoicesOf = (
  categories: readonly ModelsServiceCategoryResponse[],
  services: readonly ModelsServiceResponse[],
): Option[] => {
  const byId = categoriesById(categories)

  return menuSectionsOf(categories, services).flatMap(
    ({ category, services: inIt }) =>
      inIt.map((service) => ({
        value: service.id,
        label: `${service.name}（${category === null ? '未分類' : categoryPathOf(category, byId)}）`,
      })),
  )
}

/** Whether a value that is on or off was chosen, and which; `undefined` when it is kept. */
const switchOf = (text: string): boolean | undefined =>
  match(text)
    .with(SWITCH_ON, () => true)
    .with(SWITCH_OFF, () => false)
    .otherwise(() => undefined)

/** A value the form sends only when one of `values` was chosen. */
const chosen = <Value extends string>(
  values: readonly Value[],
  text: string,
): Value | undefined => values.find((value) => value === text)

/** What a change of several services asks for, or what is wrong with the form. */
export type ServicesChangeRead =
  | { type: 'valid'; request: ModelsServiceBulkUpdateRequest }
  | { type: 'invalid'; says: FormSays }

/**
 * The services that were chosen, and the values that were: a category or
 * none, on or off, a state, the days, and a level of the staff or none.
 */
export const readServicesChange = (values: FormData): ServicesChangeRead => {
  const serviceIds = values
    .getAll('serviceIds')
    .flatMap((value) => (typeof value === 'string' ? [value] : []))
  const category = textOf(values, 'categoryId')
  const isActive = switchOf(textOf(values, 'isActive'))
  const serviceStatus = chosen(
    SERVICE_STATUSES,
    textOf(values, 'serviceStatus'),
  )
  const availability = chosen(AVAILABILITIES, textOf(values, 'availability'))
  const allowOnlineBooking = switchOf(textOf(values, 'allowOnlineBooking'))
  const level = textOf(values, 'requiredStaffLevel')
  const requiredStaffLevel = chosen(LEVELS, level)
  const updates: ModelsServiceUpdateRequest = {
    ...(category === ''
      ? {}
      : { categoryId: category === NONE ? null : category }),
    ...(isActive === undefined ? {} : { isActive }),
    ...(serviceStatus === undefined ? {} : { serviceStatus }),
    ...(availability === undefined ? {} : { availability }),
    ...(allowOnlineBooking === undefined ? {} : { allowOnlineBooking }),
    ...(level === NONE
      ? { requiredStaffLevel: null }
      : requiredStaffLevel === undefined
        ? {}
        : { requiredStaffLevel }),
  }
  const errors: Record<string, string> =
    serviceIds.length === 0
      ? { serviceIds: SERVICES_ERROR }
      : serviceIds.length > MOST_SERVICES
        ? { serviceIds: TOO_MANY_SERVICES }
        : {}
  const nothing = Object.keys(updates).length === 0
  if (nothing || Object.keys(errors).length > 0) {
    return {
      type: 'invalid',
      says: { message: nothing ? NOTHING_TO_CHANGE : undefined, errors },
    }
  }

  return { type: 'valid', request: { serviceIds, updates } }
}

/** What a refusal of the API says: the category that was removed meanwhile at its control, anything else above the form. */
type Refused = Extract<ServicesChange, { type: 'invalid' }>

/**
 * Whether a refusal is of the category that was chosen: the categories
 * are read again, to choose from what there is now.
 */
export const refusesCategory = (outcome: Refused): boolean =>
  outcome.values.some(({ field }) => field === 'updates.categoryId')

/** What the form says after the API did not change the services. */
export const afterServicesChange = (
  outcome:
    | Refused
    | Extract<ServicesChange, { type: 'servicesGone' | 'forbidden' }>
    | { type: 'tooManyRequests' }
    | { type: 'failed' },
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, (refused) =>
      refusesCategory(refused)
        ? {
            message: refused.values.every(
              ({ field }) => field === 'updates.categoryId',
            )
              ? undefined
              : CHECK_AGAIN,
            errors: { categoryId: CATEGORY_GONE },
          }
        : { message: CHECK_AGAIN, errors: {} },
    )
    .with({ type: 'servicesGone' }, () => ({
      message: SERVICES_GONE,
      errors: {},
    }))
    .with({ type: 'forbidden' }, () => ({
      message: FORBIDDEN_MESSAGE,
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({ message: FAILED, errors: {} }))
    .exhaustive()

/** What is said once the services were changed. */
export const changedMessageOf = (updated: readonly string[]): string =>
  `${updated.length} 件のサービスを変えました。`
