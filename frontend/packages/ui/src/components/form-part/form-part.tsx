import { type ComponentPropsWithoutRef, type ReactNode, useId } from 'react'
import { Note } from '../note/note'
import styles from './form-part.module.css'

export type FormPartProps = Omit<
  ComponentPropsWithoutRef<'fieldset'>,
  'className' | 'children' | 'name'
> & {
  /** What the controls are about: 「連絡先」. The legend of the fieldset */
  label: string
  /** What is said of all of its controls, before them */
  description?: ReactNode
  /** The controls, one below the other */
  children: ReactNode
}

/**
 * A part of a form: its controls under a name, as a `fieldset` and its
 * `legend`, so that a screen reader says the name with each control, and
 * the description as that of the group. It stands further from what is
 * before it than its controls stand from each other; that room is its own,
 * so it takes no `className`. What else a fieldset takes (`disabled`,
 * `onChange`) goes to it.
 */
export const FormPart = ({
  label,
  description,
  children,
  ...part
}: FormPartProps) => {
  const descriptionId = useId()
  const described = description !== undefined

  return (
    <fieldset
      {...part}
      className={styles['part']}
      aria-describedby={described ? descriptionId : undefined}
    >
      <legend className={styles['label']}>{label}</legend>
      <div className={styles['controls']}>
        {described && (
          <Note size='small' id={descriptionId}>
            {description}
          </Note>
        )}
        {children}
      </div>
    </fieldset>
  )
}
