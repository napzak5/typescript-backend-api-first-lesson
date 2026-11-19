import { type ChangeEventHandler, useId } from 'react'
import { classNames } from '../../class-names'
import choiceStyles from '../field/choice.module.css'
import { FieldMessages, messageAttributes } from '../field/field'
import fieldStyles from '../field/field.module.css'
import styles from './checkbox-group.module.css'

export type CheckboxOption = {
  value: string
  label: string
  disabled?: boolean | undefined
}

/** One option below the other, or as many beside each other as fit. */
export type CheckboxGroupLayout = 'stack' | 'columns'

export type CheckboxGroupProps = {
  /** What is being chosen: the name of the group */
  label: string
  /** The name every chosen value is sent under */
  name: string
  options: readonly CheckboxOption[]
  /** The chosen values, when the caller keeps them. Give `onChange` with them */
  value?: readonly string[] | undefined
  /** The values chosen at first, when the browser keeps them */
  defaultValue?: readonly string[] | undefined
  onChange?: ChangeEventHandler<HTMLInputElement> | undefined
  /** Help for the choice */
  description?: string | undefined
  /** What is wrong with the choice */
  error?: string | undefined
  disabled?: boolean | undefined
  /**
   * `columns` for many short options (the kinds of a service): they stand
   * beside each other, in columns of one width
   */
  layout?: CheckboxGroupLayout | undefined
  className?: string | undefined
}

const NONE: readonly string[] = []

const layoutClass: Record<CheckboxGroupLayout, string | undefined> = {
  stack: undefined,
  columns: styles['columns'],
}

/**
 * Any number of a few choices, all of them in sight: none, some or all.
 * The chosen values are sent under one name (`formData.getAll(name)`). The
 * group is a `fieldset` and its label the `legend`; the description belongs
 * to the group, and an error is said of the group and marks each of its
 * boxes, so the first of them can take the focus. For one thing that is so
 * or not so, use `Checkbox`.
 */
export const CheckboxGroup = ({
  label,
  name,
  options,
  value,
  defaultValue = NONE,
  onChange,
  description,
  error,
  disabled = false,
  layout = 'stack',
  className,
}: CheckboxGroupProps) => {
  const id = useId()
  const messages = messageAttributes(id, { description, error })

  return (
    <fieldset
      className={className}
      disabled={disabled}
      aria-describedby={messages['aria-describedby']}
    >
      <legend className={classNames(fieldStyles['label'], styles['legend'])}>
        {label}
      </legend>
      <div className={fieldStyles['field']}>
        <div className={classNames(styles['options'], layoutClass[layout])}>
          {options.map((option) => (
            <label key={option.value} className={choiceStyles['choice']}>
              <input
                {...(value === undefined
                  ? { defaultChecked: defaultValue.includes(option.value) }
                  : { checked: value.includes(option.value) })}
                className={choiceStyles['mark']}
                type='checkbox'
                name={name}
                value={option.value}
                disabled={option.disabled}
                aria-invalid={messages['aria-invalid']}
                onChange={onChange}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <FieldMessages id={id} description={description} error={error} />
      </div>
    </fieldset>
  )
}
