import type { ComponentProps } from 'react'
import controlStyles from '../field/control.module.css'
import { Field } from '../field/field'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean | undefined
}

export type SelectProps = Omit<
  ComponentProps<'select'>,
  'children' | 'multiple'
> & {
  label: string
  options: readonly SelectOption[]
  /**
   * The text of a first option without a value, shown while nothing is
   * chosen. With `required`, the form is not sent until something is.
   */
  placeholder?: string | undefined
  /** Help for the value */
  description?: string | undefined
  /** What is wrong with the value */
  error?: string | undefined
}

/**
 * One choice out of a list, as the `select` of the browser. Everything a
 * `select` takes is passed on to it; `className` goes to the whole field.
 * For a few choices that should all be seen, use `RadioGroup`.
 */
export const Select = ({
  label,
  options,
  placeholder,
  description,
  error,
  id,
  required,
  className,
  ...select
}: SelectProps) => (
  <Field
    label={label}
    description={description}
    error={error}
    required={required}
    id={id}
    className={className}
  >
    {(control) => (
      <select
        {...select}
        {...control}
        className={controlStyles['control']}
        required={required}
      >
        {placeholder !== undefined && <option value=''>{placeholder}</option>}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    )}
  </Field>
)
