import type { FormErrors } from '@beauty-salon-frontend/ui'

/** What a form was sent with: a value to send on, or what is wrong with it. */
export type Read<Value> =
  | { type: 'valid'; value: Value }
  | { type: 'invalid'; errors: FormErrors }

/** What a form says about the last attempt: about the whole of it, and at its controls. */
export type FormSays = {
  message: string | undefined
  errors: FormErrors
}

/** A value the API refused, with the rule it broke. */
export type RefusedValue = { field: string; rule: string }
