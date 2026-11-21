import type { ComponentProps } from 'react'
import { classNames } from '../../class-names'
import controlStyles from '../field/control.module.css'
import { Field } from '../field/field'
import styles from './text-area.module.css'

export type TextAreaProps = Omit<ComponentProps<'textarea'>, 'children'> & {
  label: string
  /** Help for the value: what to enter, or in which form */
  description?: string | undefined
  /** What is wrong with the value */
  error?: string | undefined
}

/**
 * Several lines of input with their label. Everything a `textarea` takes is
 * passed on to it; `className` goes to the whole field.
 */
export const TextArea = ({
  label,
  description,
  error,
  rows = 3,
  id,
  required,
  className,
  ...textArea
}: TextAreaProps) => (
  <Field
    label={label}
    description={description}
    error={error}
    required={required}
    id={id}
    className={className}
  >
    {(control) => (
      <textarea
        {...textArea}
        {...control}
        className={classNames(controlStyles['control'], styles['textArea'])}
        rows={rows}
        required={required}
      />
    )}
  </Field>
)
