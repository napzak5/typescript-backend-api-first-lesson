import { type ComponentProps, useId } from 'react'
import { classNames } from '../../class-names'
import choiceStyles from '../field/choice.module.css'
import { FieldMessages, messageAttributes, RequiredMark } from '../field/field'
import fieldStyles from '../field/field.module.css'
import { visuallyHiddenClass } from '../visually-hidden/visually-hidden'

export type CheckboxProps = Omit<
  ComponentProps<'input'>,
  'type' | 'children'
> & {
  label: string
  /** Help for the choice */
  description?: string | undefined
  /** What is wrong with the choice */
  error?: string | undefined
  /**
   * The label is read, not shown: for a checkbox whose meaning the place
   * it stands in shows, as the one that chooses the row of a table
   */
  labelHidden?: boolean | undefined
}

/**
 * One thing that is so or not so, with its label beside it. Everything an
 * `input` takes is passed on to it (`name`, `checked` or `defaultChecked`,
 * `onChange`, `required`, …); `className` goes to the whole field.
 */
export const Checkbox = ({
  label,
  description,
  error,
  labelHidden = false,
  id,
  required,
  className,
  ...input
}: CheckboxProps) => {
  const generatedId = useId()
  const controlId = id ?? generatedId

  return (
    <div className={classNames(fieldStyles['field'], className)}>
      <div className={fieldStyles['labelRow']}>
        <label className={choiceStyles['choice']}>
          <input
            {...input}
            {...messageAttributes(controlId, { description, error })}
            id={controlId}
            className={choiceStyles['mark']}
            type='checkbox'
            required={required}
          />
          <span className={labelHidden ? visuallyHiddenClass : undefined}>
            {label}
          </span>
        </label>
        {required === true && <RequiredMark />}
      </div>
      <FieldMessages id={controlId} description={description} error={error} />
    </div>
  )
}
