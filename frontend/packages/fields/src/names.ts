import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { fieldMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import { lengthOf, tooLong } from './lengths'

/** The longest last name, and the longest first name, that the API takes */
const MAX_NAME_LENGTH = 100

/** What a form says of a last name that is missing */
export const LAST_NAME_MISSING: LocalizedText = fieldMessages.lastNameMissing

/** What a form says of a first name that is missing */
export const FIRST_NAME_MISSING: LocalizedText = fieldMessages.firstNameMissing

/** What a form says of a name that is longer than the API takes */
export const NAME_TOO_LONG: LocalizedText = tooLong(MAX_NAME_LENGTH)

const nameError = (
  name: string,
  missing: LocalizedText,
): LocalizedText | undefined =>
  match(lengthOf(name))
    .with(0, () => missing)
    .when(
      (length) => length > MAX_NAME_LENGTH,
      () => NAME_TOO_LONG,
    )
    .otherwise(() => undefined)

/** What is wrong with the last name of a person: none when nothing is. */
export const lastNameError = (name: string): LocalizedText | undefined =>
  nameError(name, LAST_NAME_MISSING)

/** What is wrong with the first name of a person: none when nothing is. */
export const firstNameError = (name: string): LocalizedText | undefined =>
  nameError(name, FIRST_NAME_MISSING)
