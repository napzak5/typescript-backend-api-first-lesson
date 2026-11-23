import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { fieldMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import * as z from 'zod/mini'
import { lengthOf, tooLong } from './lengths'

/** The longest address of mail the API takes */
const MAX_EMAIL_LENGTH = 255

const emailSchema = z.email()

/** What a form says of an address of mail that is none */
export const EMAIL_MALFORMED: LocalizedText = fieldMessages.emailMalformed

/** What is wrong with an address of mail: none when nothing is. */
export const emailError = (email: string): LocalizedText | undefined =>
  match(email)
    .with('', () => fieldMessages.emailMissing)
    .when(
      (text) => lengthOf(text) > MAX_EMAIL_LENGTH,
      () => tooLong(MAX_EMAIL_LENGTH),
    )
    .when(
      (text) => !emailSchema.safeParse(text).success,
      () => EMAIL_MALFORMED,
    )
    .otherwise(() => undefined)
