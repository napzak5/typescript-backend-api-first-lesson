/*
 * The values a form was sent with, for the tests of the functions that
 * read them: a test names the values and gets what the browser would hand
 * over.
 */

/**
 * The values of a form whose names are different: several values under one
 * name, and their order, are written as entries.
 */
export const formOfEntries = (
  entries: readonly (readonly [string, string | Blob])[],
): FormData => {
  const values = new FormData()
  for (const [name, value] of entries) {
    values.append(name, value)
  }

  return values
}

/**
 * The values of a form that has one value under each name. A value is text,
 * or the file somebody chose.
 */
export const formOf = (values: Record<string, string | Blob>): FormData =>
  formOfEntries(Object.entries(values))
