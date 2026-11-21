import type { ComponentProps } from 'react'
import { type ControlWidth, controlClassOf, Field } from '../field/field'

/** What a browser may fill a control in with: a name of HTML, or `off` */
type AutoFill = NonNullable<ComponentProps<'input'>['autoComplete']>

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
  'type' | 'children' | 'autoComplete' | 'width'
> & {
  label: string
  /** Help for the value: what to enter, or in which form */
  description?: string | undefined
  /** What is wrong with the value */
  error?: string | undefined
  type?: TextFieldType | undefined
  /** `short` for a value of a few characters that stands alone in a column: a date, a number, a code */
  width?: ControlWidth | undefined
  /**
   * What the browser may fill in: the name HTML gives the value (`email`,
   * `tel`, `family-name`, `bday`), or `off` for a value it knows nothing of
   * (a tag, a note, the day of a booking). Never left to the browser to
   * guess from the name of the control
   */
  autoComplete: AutoFill
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
  width = 'full',
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
        className={controlClassOf(width)}
        type={type}
        required={required}
      />
    )}
  </Field>
)
