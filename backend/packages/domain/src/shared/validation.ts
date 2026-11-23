import { Result } from '@beauty-salon-backend/utility'
import {
  type Locale,
  type LocalizedText,
  textOfOneString,
} from '@beauty-salon-shared/i18n'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { z } from 'zod'
import { ja } from 'zod/locales'
import { type DomainError, DomainErrors, type ValidationIssue } from './errors'

/**
 * What Zod says of a broken rule in each language of the product but
 * English, which it says by itself.
 */
const ZOD_IN: Record<Exclude<Locale, 'en'>, z.core.$ZodErrorMap> = {
  ja: ja().localeError,
}

const toField = (path: readonly PropertyKey[]): string =>
  path.map(String).join('.')

/**
 * What an issue says, in every language. The message of a rule that a
 * schema wrote carries every language in one string (`asOneString`). A
 * message of Zod is in English, and `japanese` is what Zod says of the
 * same issue in Japanese. A message that a schema wrote as a plain string
 * reads the same in both checks, and is told as it is in every language:
 * the schemas of the requests write none (`schema-messages.test.ts`).
 */
const messageOf = (
  english: string,
  japanese: string | undefined,
): LocalizedText =>
  textOfOneString(english) ?? { en: english, ja: japanese ?? english }

/**
 * An unknown key is reported once per key, under the key's own path, so that
 * a client sees which property it must drop.
 */
const toValidationIssues = (
  issue: z.core.$ZodIssue,
  japanese: string | undefined,
): ValidationIssue[] =>
  match(issue)
    .with({ code: 'unrecognized_keys' }, ({ keys, path }) =>
      keys.map((key) => ({
        field: toField([...path, key]),
        rule: issue.code,
        message: ruleMessages.unknownProperty,
      })),
    )
    .otherwise(({ code, path, message }) => [
      {
        field: toField(path),
        rule: code,
        message: messageOf(message, japanese),
      },
    ])

/**
 * Parses untrusted input into `T`, reporting every broken rule as a
 * validation error.
 *
 * An input that breaks a rule is checked once more, with Zod speaking
 * Japanese: the same input against the same schema breaks the same rules
 * in the same order, so the issues of the two checks pair by their place.
 */
export const parseWith = <T>(
  schema: z.ZodType<T>,
  input: unknown,
  message: LocalizedText,
): Result<T, DomainError> =>
  match(schema.safeParse(input))
    .with({ success: true }, ({ data }) => Result.success(data))
    .with({ success: false }, ({ error }) => {
      const inJapanese =
        schema.safeParse(input, { error: ZOD_IN.ja }).error?.issues ?? []

      return Result.error(
        DomainErrors.validation(
          message,
          error.issues.flatMap((issue, index) =>
            toValidationIssues(issue, inJapanese[index]?.message),
          ),
        ),
      )
    })
    .exhaustive()

/**
 * Parses what the database holds into `T`. A value that breaks a rule is
 * not the fault of the request: it is a `database` error, of which a
 * client is told nothing. `description` says what does not match, for the
 * log (`Stored product <id> does not match the API model`), and the cause
 * names the properties and the rules they break, in English and without
 * the values.
 */
export const parseStored = <T>(
  schema: z.ZodType<T>,
  stored: unknown,
  description: string,
): Result<T, DomainError> =>
  match(schema.safeParse(stored))
    .with({ success: true }, ({ data }) => Result.success(data))
    .with({ success: false }, ({ error }) =>
      Result.error(
        DomainErrors.database(description, {
          issues: error.issues.map(({ code, path, message }) => ({
            field: toField(path),
            rule: code,
            message: textOfOneString(message)?.en ?? message,
          })),
        }),
      ),
    )
    .exhaustive()
