import type { ComponentProps } from 'react'
import { Field } from '../field/field'
import styles from './file-field.module.css'

export type FileFieldProps = Omit<
  ComponentProps<'input'>,
  'type' | 'children' | 'value' | 'defaultValue'
> & {
  label: string
  /** Help for the file: which kind, in which form */
  description?: string | undefined
  /** What is wrong with the file */
  error?: string | undefined
}

/**
 * A file to choose, with its label: the button that opens the files of the
 * device, and the name of the chosen one beside it. Everything an `input`
 * takes is passed on to it (`name`, `accept`, `multiple`, `onChange`,
 * `required`, …); `className` goes to the whole field.
 */
export const FileField = ({
  label,
  description,
  error,
  id,
  required,
  className,
  ...input
}: FileFieldProps) => (
  <Field
    label={label}
    description={description}
    error={error}
    required={required}
    id={id}
    className={className}
  >
    {(control) => (
      <input
        {...input}
        {...control}
        className={styles['file']}
        type='file'
        required={required}
      />
    )}
  </Field>
)
