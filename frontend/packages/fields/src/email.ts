import { match } from 'ts-pattern'
import * as z from 'zod/mini'
import { tooLong } from './lengths'

/** The longest address of mail the API takes */
const MAX_EMAIL_LENGTH = 255

const emailSchema = z.email()

/** What a form says of an address of mail that is none */
export const EMAIL_MALFORMED =
  'メールアドレスは、hanako@example.com のような形で入力してください。'

/** What is wrong with an address of mail: none when nothing is. */
export const emailError = (email: string): string | undefined =>
  match(email)
    .with('', () => 'メールアドレスを入力してください。')
    .when(
      (text) => text.length > MAX_EMAIL_LENGTH,
      () => tooLong(MAX_EMAIL_LENGTH),
    )
    .when(
      (text) => !emailSchema.safeParse(text).success,
      () => EMAIL_MALFORMED,
    )
    .otherwise(() => undefined)
