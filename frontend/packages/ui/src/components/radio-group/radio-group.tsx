import { type ChangeEventHandler, useId } from 'react'
import { classNames } from '../../class-names'
import choiceStyles from '../field/choice.module.css'
import { FieldMessages, messageAttributes, RequiredMark } from '../field/field'
import fieldStyles from '../field/field.module.css'
import styles from './radio-group.module.css'

export type RadioOption = {
  value: string
  label: string
  disabled?: boolean | undefined
}

export type RadioGroupProps = {
  /** What is being chosen: the name of the group */
  label: string
  /** The name the chosen value is sent under */
  name: string
  options: readonly RadioOption[]
  /** The chosen value, when the caller keeps it. Give `onChange` with it */
  value?: string | undefined
  /** The value chosen at first, when the browser keeps it */
  defaultValue?: string | undefined
  onChange?: ChangeEventHandler<HTMLInputElement> | undefined
  /** Help for the choice */
  description?: string | undefined
  /** What is wrong with the choice */
  error?: string | undefined
  required?: boolean | undefined
  disabled?: boolean | undefined
  className?: string | undefined
}

/**
 * One choice out of a few, all of them in sight. The arrow keys move the
 * choice, as the browser does for radio buttons of one name. The label, the
 * description and the error belong to the group, not to one of its buttons.
 * For a long list, use `Select`.
 */
export const RadioGroup = ({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  description,
  error,
  required = false,
  disabled = false,
  className,
}: RadioGroupProps) => {
  const id = useId()
  const labelId = `${id}-label`

  return (
    <div
      {...messageAttributes(id, { description, error })}
      className={classNames(fieldStyles['field'], className)}
      role='radiogroup'
      aria-labelledby={labelId}
      aria-required={required || undefined}
    >
      <div className={fieldStyles['labelRow']}>
        <span className={fieldStyles['label']} id={labelId}>
          {label}
        </span>
        {required && <RequiredMark />}
      </div>
      <div className={styles['options']}>
        {options.map((option) => (
          <label key={option.value} className={choiceStyles['choice']}>
            <input
              {...(value === undefined
                ? { defaultChecked: option.value === defaultValue }
                : { checked: option.value === value })}
              className={choiceStyles['mark']}
              type='radio'
              name={name}
              value={option.value}
              required={required}
              disabled={disabled || option.disabled === true}
              onChange={onChange}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <FieldMessages id={id} description={description} error={error} />
    </div>
  )
}
