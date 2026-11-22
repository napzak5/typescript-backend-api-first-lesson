import { match } from 'ts-pattern'

const MAX_PHONE_LENGTH = 20
const MIN_PHONE_DIGITS = 10

/** What a form says of a phone number that the API does not take */
export const PHONE_MALFORMED =
  '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。'

/** What the API takes for a phone number: digits with the usual separators, ten digits or more. */
const isPhoneNumber = (text: string): boolean =>
  text.length <= MAX_PHONE_LENGTH &&
  /^[\d\s\-+()]+$/.test(text) &&
  text.replace(/\D/g, '').length >= MIN_PHONE_DIGITS

/** What is wrong with a phone number that has to be given: none when nothing is. */
export const phoneError = (phoneNumber: string): string | undefined =>
  match(phoneNumber)
    .with('', () => '電話番号を入力してください。')
    .when(
      (text) => !isPhoneNumber(text),
      () => PHONE_MALFORMED,
    )
    .otherwise(() => undefined)

/** What is wrong with a phone number that may be left empty (`null`): none when nothing is. */
export const alternativePhoneError = (
  phoneNumber: string | null,
): string | undefined =>
  phoneNumber === null || isPhoneNumber(phoneNumber)
    ? undefined
    : PHONE_MALFORMED
