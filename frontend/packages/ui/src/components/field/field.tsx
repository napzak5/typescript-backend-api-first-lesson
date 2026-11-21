import { type ReactNode, useId } from 'react'
import { classNames } from '../../class-names'
import { Note } from '../note/note'
import styles from './field.module.css'

type FieldMessageProps = {
  /** Help for the value: what to enter, or in which form */
  description?: string | undefined
  /** What is wrong with the value. While it is set, the control is marked invalid */
  error?: string | undefined
}

/** What a control is given so that its label and its messages belong to it. */
type FieldControlProps = {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
}

type FieldProps = FieldMessageProps & {
  label: string
  /** Shows the mark 必須. The control itself carries `required` */
  required?: boolean | undefined
  /** The `id` of the control, when the caller has to choose it */
  id?: string | undefined
  className?: string | undefined
  children: (control: FieldControlProps) => ReactNode
}

/**
 * The attributes that tie a control, or a group of controls, to the messages
 * that `FieldMessages` renders for the same `id`.
 */
export const messageAttributes = (
  id: string,
  { description, error }: FieldMessageProps,
): Omit<FieldControlProps, 'id'> => {
  const ids = [
    description !== undefined && `${id}-description`,
    error !== undefined && `${id}-error`,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    'aria-describedby': ids === '' ? undefined : ids,
    'aria-invalid': error === undefined ? undefined : true,
  }
}

/**
 * Says to the eye that a value is required. Assistive technology hears it
 * from the `required` attribute of the control, so the mark is hidden from
 * it, and it stands beside the label, not inside: the text of the label is
 * the name of the control and nothing else.
 */
export const RequiredMark = () => (
  <span className={styles['required']} aria-hidden='true'>
    必須
  </span>
)

export const FieldMessages = ({
  id,
  description,
  error,
}: FieldMessageProps & { id: string }) => (
  <>
    {description !== undefined && (
      <Note size='small' id={`${id}-description`}>
        {description}
      </Note>
    )}
    {error !== undefined && (
      <p className={styles['error']} id={`${id}-error`}>
        {error}
      </p>
    )}
  </>
)

/**
 * A label, a control and what is said about its value. The control is
 * rendered by the caller, with the attributes it is handed. `TextField`,
 * `TextArea` and `Select` are this with their control filled in.
 */
export const Field = ({
  label,
  description,
  error,
  required = false,
  id,
  className,
  children,
}: FieldProps) => {
  const generatedId = useId()
  const controlId = id ?? generatedId

  return (
    <div className={classNames(styles['field'], className)}>
      <div className={styles['labelRow']}>
        <label className={styles['label']} htmlFor={controlId}>
          {label}
        </label>
        {required && <RequiredMark />}
      </div>
      {children({
        id: controlId,
        ...messageAttributes(controlId, { description, error }),
      })}
      <FieldMessages id={controlId} description={description} error={error} />
    </div>
  )
}
