import {
  Actions,
  Alert,
  BulletList,
  Button,
  FileField,
  type FormErrors,
  type FormProps,
  LoadingIndicator,
  NO_ERRORS,
  Table,
  useErrorFocus,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { type FormEvent, useId } from 'react'
import { customerKanaOf, customerNameOf } from '../../api/customers-api'
import {
  type CustomerFileRead,
  type FileProblem,
  MOST_REGISTERED,
  problemTextOf,
} from '../../utils/customer-file'
import { tierNameOf } from '../../utils/customer-format'
import styles from './customer-import-form.module.css'

const { form: words } = adminCustomerMessages.file

/** The file that was chosen: being read, or read */
export type ChosenFile =
  | { type: 'reading' }
  | { type: 'read'; read: CustomerFileRead }

/** The control of the file */
export const FILE = 'file'

export type CustomerImportFormProps = Pick<FormProps, 'actions'> & {
  /** The registration is on its way */
  pending?: boolean | undefined
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /**
   * The errors of the controls, under their names. A new object is a new
   * attempt: the focus goes to the first control with an error
   */
  errors?: FormErrors<LocalizedText> | undefined
  /** The file that was chosen; `undefined` before one is */
  chosen: ChosenFile | undefined
  /** What the API refused of the customers of the file, by row */
  refused: readonly FileProblem[]
  /** A file was chosen, or the choice was taken back */
  onChoose: (file: File | undefined) => void
  /**
   * The form was sent: with the file as it was read, or `undefined` when
   * none is chosen. It is not sent while the file is read, nor while the
   * registration is on its way
   */
  onSubmit: (read: CustomerFileRead | undefined) => void
}

/**
 * A file of customers to register: chosen, read in the browser, and either
 * shown as the customers it holds, which the button registers, or as what
 * is wrong with it, row by row, so that a corrected file can be chosen.
 *
 * The control and what is wrong stand in the column of a form; the table
 * of the customers takes the width of the page, which its columns need,
 * and the button that registers them comes after it, so that they are
 * read before it is pressed. The button belongs to the form by its `form`.
 * That is why it is no `Form` of the package, whose button ends the column
 * of the form; it sends and moves the focus as one does.
 */
export const CustomerImportForm = ({
  chosen,
  refused,
  onChoose,
  message,
  errors = NO_ERRORS,
  pending = false,
  actions,
  onSubmit,
}: CustomerImportFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const formId = useId()
  const form = useErrorFocus(errors)
  const read = chosen?.type === 'read' ? chosen.read : undefined
  const problems = read?.type === 'invalid' ? read.problems : refused
  const customers = read?.type === 'read' ? read.customers : []

  // As the form of the package does, one attempt at a time; and none before the file is read
  const busy = pending || chosen?.type === 'reading'

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!busy) {
      onSubmit(read)
    }
  }

  return (
    <div className={styles['import']}>
      <form
        className={styles['form']}
        id={formId}
        noValidate
        onSubmit={submit}
        ref={form}
      >
        {said.message !== undefined && (
          <Alert tone='danger'>{said.message}</Alert>
        )}
        <FileField
          label={say(words.file)}
          name={FILE}
          accept='.csv,text/csv'
          required
          description={say(words.fileDescription(MOST_REGISTERED))}
          error={said.errors[FILE]}
          onChange={(event) =>
            onChoose(event.currentTarget.files?.item(0) ?? undefined)
          }
        />
        {chosen?.type === 'reading' && (
          <LoadingIndicator label={say(words.reading)} />
        )}
        {problems.length > 0 && (
          <Alert tone='danger' title={say(words.problemsTitle)}>
            <div className={styles['problems']}>
              <p>{say(words.problemsAbout)}</p>
              <BulletList>
                {problems.map((problem) => {
                  const text = say(problemTextOf(problem))
                  return <li key={text}>{text}</li>
                })}
              </BulletList>
            </div>
          </Alert>
        )}
      </form>
      {customers.length > 0 && (
        <Table
          caption={say(words.customers)}
          columns={[
            {
              key: 'row',
              header: say(words.row),
              align: 'end',
              cell: ({ row }) => row,
            },
            {
              key: 'name',
              header: say(words.name),
              cell: ({ request }) => customerNameOf(request),
            },
            {
              key: 'kana',
              header: say(words.kana),
              cell: ({ request }) => customerKanaOf(request),
            },
            {
              key: 'email',
              header: say(words.email),
              cell: ({ request }) => request.email,
            },
            {
              key: 'phoneNumber',
              header: say(words.phoneNumber),
              cell: ({ request }) => request.phoneNumber,
            },
            {
              key: 'membershipTier',
              header: say(words.membershipTier),
              cell: ({ request }) => say(tierNameOf(request.membershipTier)),
            },
          ]}
          rowHeader='name'
          rows={customers}
          rowKey={({ row }) => String(row)}
          emptyMessage={say(words.noCustomers)}
        />
      )}
      <Actions layout='row'>
        <Button type='submit' form={formId} variant='primary' pending={busy}>
          {say(words.register(customers.length))}
        </Button>
        {actions}
      </Actions>
    </div>
  )
}
