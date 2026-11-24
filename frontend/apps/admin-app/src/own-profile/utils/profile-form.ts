import {
  CHECK_THE_VALUES_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type { ModelsStaffProfileUpdateRequest } from '@beauty-salon-frontend/api-client'
import { WEB_ADDRESS_ERROR } from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProfileMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import {
  controlOf,
  INTRODUCTION_CONTROLS,
  type Introduced,
  introductionChangesOf,
  readIntroduction,
} from '../../staff/utils/introduction'
import type { ProfileSave } from '../api/profile-api'

/*
 * The form of the profile of the account: what it sends, and what it says
 * about the answers.
 */

const { form } = adminProfileMessages

/** What a change of the profile asks for: nothing, when nothing was changed. */
type ProfileChange =
  | FormRead<ModelsStaffProfileUpdateRequest, FormErrors<LocalizedText>>
  | { type: 'unchanged' }

/**
 * What was changed in the form: the values that are others than those of
 * the profile it was opened with, and nothing else. What the salon changed
 * in the ledger meanwhile stays, unless the same value was changed here.
 */
export const readProfileChange = (
  values: FormData,
  shown: Introduced,
): ProfileChange => {
  const read = readIntroduction(values)
  if (read.type === 'invalid') {
    return read
  }
  const changes = introductionChangesOf(read.value, shown)

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** What the form says after the API did not take it. */
export const afterProfileSave = (
  outcome: Exclude<ProfileSave, { type: 'saved' } | { type: 'unavailable' }>,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values
        .map(({ field }) => controlOf(field))
        .filter((control) => INTRODUCTION_CONTROLS.includes(control))

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          said.map((control) => [
            control,
            control === 'imageUrl' ? WEB_ADDRESS_ERROR : REFUSED_VALUE_MESSAGE,
          ]),
        ),
      }
    })
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(form.failed))
    .exhaustive()
