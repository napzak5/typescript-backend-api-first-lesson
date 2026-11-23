import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { fieldMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import { lengthOf } from './lengths'

const MAX_PHONE_LENGTH = 20
const MIN_PHONE_DIGITS = 10

/** What a form says of a phone number that the API does not take */
export const PHONE_MALFORMED: LocalizedText = fieldMessages.phoneMalformed

/** What the API takes for a phone number: digits with the usual separators, ten digits or more. */
const isPhoneNumber = (text: string): boolean =>
  lengthOf(text) <= MAX_PHONE_LENGTH &&
  /^[\d\s\-+()]+$/.test(text) &&
  text.replace(/\D/g, '').length >= MIN_PHONE_DIGITS

/** What is wrong with a phone number that has to be given: none when nothing is. */
export const phoneError = (phoneNumber: string): LocalizedText | undefined =>
  match(phoneNumber)
    .with('', () => fieldMessages.phoneMissing)
    .when(
      (text) => !isPhoneNumber(text),
      () => PHONE_MALFORMED,
    )
    .otherwise(() => undefined)

/** What is wrong with a phone number that may be left empty (`null`): none when nothing is. */
export const alternativePhoneError = (
  phoneNumber: string | null,
): LocalizedText | undefined =>
  phoneNumber === null || isPhoneNumber(phoneNumber)
    ? undefined
    : PHONE_MALFORMED
