import { type RefObject, useLayoutEffect, useRef } from 'react'

/** What is wrong with a value, under the name of its control. */
export type FormErrors = Record<string, string | undefined>

/**
 * The first control that has an error. A group of radio buttons says its
 * error itself and cannot take the focus: the button that is chosen does,
 * or the first while none is, which is where the Tab key enters the group.
 */
const firstInvalidIn = (form: HTMLFormElement | null): HTMLElement | null => {
  const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]')

  return invalid?.getAttribute('role') === 'radiogroup'
    ? (invalid.querySelector<HTMLElement>('input:checked') ??
        invalid.querySelector<HTMLElement>('input'))
    : (invalid ?? null)
}

/**
 * Returns the ref of a form whose first control with an error takes the
 * focus after an attempt. A new `errors` object is the answer to another
 * attempt, also when it says the same.
 *
 * The focus is moved in the commit that shows the errors, before the
 * browser paints them. `Form` does this itself; the hook is for a form
 * whose button stands somewhere else, as in a dialog.
 */
export const useErrorFocus = (
  errors: FormErrors,
): RefObject<HTMLFormElement | null> => {
  const form = useRef<HTMLFormElement>(null)

  useLayoutEffect(() => {
    if (Object.values(errors).some((error) => error !== undefined)) {
      firstInvalidIn(form.current)?.focus()
    }
  }, [errors])

  return form
}
