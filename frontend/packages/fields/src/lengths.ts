/** What a form says of a text that is longer than the API takes. */
export const tooLong = (most: number): string =>
  `${most} 文字以内で入力してください。`

/**
 * What a form says of the texts that may be left empty, under the names of
 * their controls: one that is longer than its length is too long. `text`
 * reads a control, as `null` when it was left empty.
 */
export const lengthErrors = (
  lengths: Readonly<Record<string, number>>,
  text: (name: string) => string | null,
): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(lengths).map(
      ([name, most]): [string, string | undefined] => [
        name,
        (text(name) ?? '').length > most ? tooLong(most) : undefined,
      ],
    ),
  )
