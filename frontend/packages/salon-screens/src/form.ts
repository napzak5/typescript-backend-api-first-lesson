/** What a form gives: a request, or what is wrong with each field. */
export type Read<Request> =
  | { type: 'valid'; request: Request }
  | { type: 'invalid'; errors: Record<string, string> }

/** The text of a control of a form; nothing for one that is not there. */
export const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value : ''
}
