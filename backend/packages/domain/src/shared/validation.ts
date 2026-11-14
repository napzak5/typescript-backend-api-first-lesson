import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { z } from 'zod'
import { type DomainError, DomainErrors, type ValidationIssue } from './errors'

const toField = (path: readonly PropertyKey[]): string =>
  path.map(String).join('.')

/**
 * An unknown key is reported once per key, under the key's own path, so that
 * a client sees which property it must drop.
 */
const toValidationIssues = (issue: z.core.$ZodIssue): ValidationIssue[] =>
  match(issue)
    .with({ code: 'unrecognized_keys' }, ({ keys, path }) =>
      keys.map((key) => ({
        field: toField([...path, key]),
        rule: issue.code,
        message: 'Unknown property',
      })),
    )
    .otherwise(({ code, path, message }) => [
      { field: toField(path), rule: code, message },
    ])

/**
 * Parses untrusted input into `T`, reporting every broken rule as a
 * validation error.
 */
export const parseWith = <T>(
  schema: z.ZodType<T>,
  input: unknown,
  message: string,
): Result<T, DomainError> =>
  match(schema.safeParse(input))
    .with({ success: true }, ({ data }) => Result.success(data))
    .with({ success: false }, ({ error }) =>
      Result.error(
        DomainErrors.validation(
          message,
          error.issues.flatMap(toValidationIssues),
        ),
      ),
    )
    .exhaustive()
