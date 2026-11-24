import {
  CHECK_THE_VALUES_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsServiceBulkUpdateRequest,
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
  ModelsServiceUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormSays,
  type NamedChoice,
  textOf,
  textsOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { LEVELS } from '../../staff/utils/staff-format'
import type { ServicesChange } from '../api/menu-api'
import {
  AVAILABILITIES,
  categoriesById,
  categoryLineOf,
  menuSectionsOf,
  SERVICE_STATUSES,
} from './menu-format'
import { CATEGORY_GONE } from './service-form'

/*
 * The form that gives several services of the menu the same values: which
 * services, and which of their values. A control left at 「変えない」 sends
 * nothing, so each service keeps what it has there.
 */

/** The most services the API changes at once */
export const MOST_SERVICES = 100

/** The value of the choice that takes something away: no category, every member of the staff */
export const NONE = 'none'

const { bulk: WORDS } = adminMenuMessages

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
): NamedChoice[] => {
  const byId = categoriesById(categories)

  return menuSectionsOf(categories, services).flatMap(
    ({ category, services: inIt }) =>
      inIt.map((service) => ({
        value: service.id,
        label: adminMenuMessages.services.choiceOf(
          service.name,
          categoryLineOf(category, byId),
        ),
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
  | { type: 'valid'; value: ModelsServiceBulkUpdateRequest }
  | { type: 'invalid'; says: FormSays<LocalizedText> }

/**
 * The services that were chosen, and the values that were: a category or
 * none, on or off, a state, the days, and a level of the staff or none.
 */
export const readServicesChange = (values: FormData): ServicesChangeRead => {
  const serviceIds = textsOf(values, 'serviceIds')
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
  const errors: FormErrors<LocalizedText> =
    serviceIds.length === 0
      ? { serviceIds: WORDS.errors.services }
      : serviceIds.length > MOST_SERVICES
        ? { serviceIds: WORDS.errors.tooManyServices(MOST_SERVICES) }
        : {}
  const nothing = Object.keys(updates).length === 0
  if (nothing || Object.keys(errors).length > 0) {
    return {
      type: 'invalid',
      says: {
        message: nothing ? WORDS.errors.nothingToChange : undefined,
        errors,
      },
    }
  }

  return { type: 'valid', value: { serviceIds, updates } }
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
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, (refused) =>
      refusesCategory(refused)
        ? {
            message: refused.values.every(
              ({ field }) => field === 'updates.categoryId',
            )
              ? undefined
              : CHECK_THE_VALUES_MESSAGE,
            errors: { categoryId: CATEGORY_GONE },
          }
        : aboutTheAttempt(CHECK_THE_VALUES_MESSAGE),
    )
    .with({ type: 'servicesGone' }, () =>
      aboutTheAttempt(WORDS.errors.servicesGone),
    )
    .with({ type: 'forbidden' }, () =>
      aboutTheAttempt(adminMenuMessages.forbidden),
    )
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(WORDS.failed))
    .exhaustive()

/** What is said once the services were changed. */
export const changedMessageOf = (updated: readonly string[]): LocalizedText =>
  WORDS.changed(updated.length)
