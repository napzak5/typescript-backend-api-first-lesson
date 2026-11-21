import type { ComponentPropsWithoutRef, ReactNode, Ref } from 'react'
import styles from './form-row.module.css'

export type FormRowProps = Omit<
  ComponentPropsWithoutRef<'fieldset'>,
  'className' | 'children' | 'name'
> & {
  /** What the row is: 「1 件目の施術」, 「月曜日」. The legend of the fieldset */
  label: string
  /** The controls of the row, one below the other */
  children: ReactNode
  /** The fieldset, for a form that moves the focus into a row it adds */
  ref?: Ref<HTMLFieldSetElement> | undefined
}

/**
 * One of the rows a form repeats (a treatment, an option, a day), inside a
 * `FormPart`: a frame of its own, with its name on the upper edge, as a
 * `fieldset` and its `legend`, so that a screen reader says which row a
 * control is in. What else a fieldset takes goes to it.
 */
export const FormRow = ({ label, children, ...row }: FormRowProps) => (
  <fieldset {...row} className={styles['row']}>
    <legend className={styles['name']}>{label}</legend>
    <div className={styles['controls']}>{children}</div>
  </fieldset>
)
