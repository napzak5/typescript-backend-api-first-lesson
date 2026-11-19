import type { ComponentProps } from 'react'
import controlStyles from '../field/control.module.css'
import { Field } from '../field/field'

/** The kinds of input that are one line of text. */
type TextFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'tel'
  | 'url'
  | 'search'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime-local'

export type TextFieldProps = Omit<
  ComponentProps<'input'>,
  'type' | 'children'
> & {
  label: string
  /** Help for the value: what to enter, or in which form */
  description?: string | undefined
  /** What is wrong with the value */
  error?: string | undefined
  type?: TextFieldType | undefined
}

/**
 * One line of input with its label. Everything an `input` takes is passed on
 * to it (`name`, `value` or `defaultValue`, `onChange`, `autoComplete`,
 * `required`, …); `className` goes to the whole field, for the container to
 * place it.
 */
export const TextField = ({
  label,
  description,
  error,
  type = 'text',
  id,
  required,
  className,
  ...input
}: TextFieldProps) => (
  <Field
    label={label}
    description={description}
    error={error}
    required={required}
    id={id}
    className={className}
  >
    {(control) => (
      <input
        {...input}
        {...control}
        className={controlStyles['control']}
        type={type}
        required={required}
      />
    )}
  </Field>
)
