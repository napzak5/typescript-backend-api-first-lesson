import { useId } from 'react'
import { classNames } from '../../utils/class-names'
import type { ChoiceLayout, ChoiceOption } from '../field/choice'
import choiceStyles from '../field/choice.module.css'
import { FieldMessages, messageAttributes } from '../field/field'
import fieldStyles from '../field/field.module.css'
import styles from './checkbox-group.module.css'

export type CheckboxGroupProps = {
  /** What is being chosen: the name of the group */
  label: string
  /** The name every chosen value is sent under */
  name: string
  options: readonly ChoiceOption[]
  /** The values chosen at first: the browser keeps the choice */
  defaultValue?: readonly string[] | undefined
  /** Help for the choice */
  description?: string | undefined
  /** What is wrong with the choice */
  error?: string | undefined
  /**
   * `columns` for many short options (the names of services): they stand
   * beside each other, in columns of one width
   */
  layout?: ChoiceLayout | undefined
}

const NONE: readonly string[] = []

const layoutClass: Record<ChoiceLayout, string | undefined> = {
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
 *
 * It is a `fieldset`, where `RadioGroup` is a `radiogroup`: a group of check
 * boxes has no role of its own, and no way to say that one box of it has to
 * be chosen, so it has no `required` either.
 */
export const CheckboxGroup = ({
  label,
  name,
  options,
  defaultValue = NONE,
  description,
  error,
  layout = 'stack',
}: CheckboxGroupProps) => {
  const id = useId()
  const messages = messageAttributes(id, { description, error })

  return (
    <fieldset aria-describedby={messages['aria-describedby']}>
      <legend className={classNames(fieldStyles['label'], styles['legend'])}>
        {label}
      </legend>
      <div className={fieldStyles['field']}>
        <div className={classNames(styles['options'], layoutClass[layout])}>
          {options.map((option) => (
            <label key={option.value} className={choiceStyles['choice']}>
              <input
                defaultChecked={defaultValue.includes(option.value)}
                className={choiceStyles['mark']}
                type='checkbox'
                name={name}
                value={option.value}
                aria-invalid={messages['aria-invalid']}
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
