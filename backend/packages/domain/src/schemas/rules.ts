import { z } from 'zod'

/**
 * Rules that the request schemas of more than one domain share.
 */

/** A nullable text is either null or says something: '' is not "unset". */
export const nonBlankText = z.string().regex(/\S/, 'Must not be blank')

/** An address that is stored and compared in lower case. */
export const lowerCaseEmail = z
  .email()
  .max(255)
  .transform((value) => value.toLowerCase())

const MIN_PHONE_DIGITS = 10

/** A phone number as people write it: digits with the usual separators. */
export const phoneNumber = z
  .string()
  .max(20)
  .regex(/^[\d\s\-+()]+$/, 'Must be a phone number')
  .refine(
    (value) => value.replace(/\D/g, '').length >= MIN_PHONE_DIGITS,
    `Must contain at least ${MIN_PHONE_DIGITS} digits`,
  )

/** The largest value of an `integer` column. */
export const MAX_INTEGER = 2_147_483_647

/**
 * For a list in which no entry may come twice: an entry that an earlier one
 * equals is reported under its own index.
 */
export const noRepeatedEntries = (
  context: z.core.ParsePayload<readonly string[]>,
): void => {
  const seen = new Set<string>()
  context.value.forEach((entry, index) => {
    if (seen.has(entry)) {
      context.issues.push({
        code: 'custom',
        path: [index],
        message: 'Must not repeat an earlier entry',
        input: entry,
      })
    }
    seen.add(entry)
  })
}

/**
 * For the schema of an update, in which every property may be absent: a
 * request that names none changes nothing and is refused. An unknown
 * property is reported as such, not as an empty request.
 */
export const atLeastOneProperty = (
  context: z.core.ParsePayload<object>,
): void => {
  if (context.issues.length === 0 && Object.keys(context.value).length === 0) {
    context.issues.push({
      code: 'custom',
      path: [],
      message: 'At least one property must be specified',
      input: context.value,
    })
  }
}
