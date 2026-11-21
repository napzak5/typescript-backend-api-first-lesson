import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import styles from './form-part.module.css'

export type FormPartProps = Omit<
  ComponentPropsWithoutRef<'fieldset'>,
  'className' | 'children' | 'name'
> & {
  /** What the controls are about: 「連絡先」. The name of the fieldset */
  name: string
  /** What is said of all of its controls, before them */
  note?: ReactNode
  /** The controls, one below the other */
  children: ReactNode
}

/**
 * A part of a form: its controls under a name, as a `fieldset` and its
 * `legend`, so that a screen reader says the name with each control. It
 * stands further from what is before it than its controls stand from each
 * other. What else a fieldset takes (`disabled`, `onChange`) goes to it.
 */
export const FormPart = ({ name, note, children, ...part }: FormPartProps) => (
  <fieldset {...part} className={styles['part']}>
    <legend className={styles['name']}>{name}</legend>
    <div className={styles['controls']}>
      {note !== undefined && <p className={styles['note']}>{note}</p>}
      {children}
    </div>
  </fieldset>
)
