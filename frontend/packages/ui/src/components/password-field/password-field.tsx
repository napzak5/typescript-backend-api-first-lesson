import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { type ComponentProps, useState } from 'react'
import { useSay } from '../../hooks/language'
import choiceStyles from '../field/choice.module.css'
import controlStyles from '../field/control.module.css'
import { Field } from '../field/field'
import styles from './password-field.module.css'

export type PasswordFieldProps = Omit<
  ComponentProps<'input'>,
  'type' | 'children' | 'autoComplete'
> & {
  label: string
  /** Help for the value: what the password has to be */
  description?: string | undefined
  /** What is wrong with the value */
  error?: string | undefined
  /**
   * `new-password` for one that is chosen, `current-password` for the one
   * the account has: a password manager offers to keep or to fill it. `off`
   * for one that belongs to no account (that of a shared file)
   */
  autoComplete: 'new-password' | 'current-password' | 'off'
}

/**
 * A password that its owner may look at: the field for a password that is
 * being chosen. There is no second field to repeat it in; a slip of the
 * finger is found by showing what was typed, and pasting is not hindered.
 *
 * Everything an `input` takes is passed on to it (`name`, `autoComplete`,
 * `required`, …); `className` goes to the whole field. The checkbox that
 * shows the password has no name, so a form does not send it.
 */
export const PasswordField = ({
  label,
  description,
  error,
  id,
  required,
  className,
  ...input
}: PasswordFieldProps) => {
  const say = useSay()
  const [shown, setShown] = useState(false)

  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}
      id={id}
      className={className}
    >
      {(control) => (
        <div className={styles['entry']}>
          <input
            {...input}
            {...control}
            className={controlStyles['control']}
            type={shown ? 'text' : 'password'}
            required={required}
            // Shown, it is a text like any other to the browser: it is not
            // to be corrected, capitalised or handed to a spelling service
            autoCapitalize='none'
            autoCorrect='off'
            spellCheck={false}
          />
          <label className={choiceStyles['choice']}>
            <input
              className={choiceStyles['mark']}
              type='checkbox'
              checked={shown}
              onChange={(event) => setShown(event.currentTarget.checked)}
            />
            <span>{say(uiMessages.passwordField.show(label))}</span>
          </label>
        </div>
      )}
    </Field>
  )
}
