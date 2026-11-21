import {
  Actions,
  Alert,
  BulletList,
  Button,
  FileField,
  type FormErrors,
  type FormProps,
  LoadingIndicator,
  Table,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useId } from 'react'
import {
  type CustomerFileRead,
  type FileProblem,
  MOST_REGISTERED,
  problemTextOf,
} from '../../customer-file'
import { tierNameOf } from '../../customer-format'
import { customerKanaOf, customerNameOf } from '../../customers-api'
import styles from './customer-import-form.module.css'

/** The file that was chosen: being read, or read */
export type ChosenFile =
  | { type: 'reading' }
  | { type: 'read'; read: CustomerFileRead }

/** The control of the file */
export const FILE = 'file'

export type CustomerImportFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The file that was chosen; `undefined` before one is */
  chosen: ChosenFile | undefined
  /** What the API refused of the customers of the file, by row */
  refused: readonly FileProblem[]
  /** A file was chosen, or the choice was taken back */
  onChoose: (file: File | undefined) => void
}

const NO_ERRORS: FormErrors = {}

/**
 * A file of customers to register: chosen, read in the browser, and either
 * shown as the customers it holds, which the button registers, or as what
 * is wrong with it, row by row, so that a corrected file can be chosen.
 *
 * The control and what is wrong stand in the column of a form; the table
 * of the customers takes the width of the page, which its columns need,
 * and the button that registers them comes after it, so that they are
 * read before it is pressed. The button belongs to the form by its `form`.
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
  const formId = useId()
  const form = useErrorFocus(errors)
  const read = chosen?.type === 'read' ? chosen.read : undefined
  const problems = read?.type === 'invalid' ? read.problems : refused
  const customers = read?.type === 'read' ? read.customers : []

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    // As the form of the package does: one attempt at a time
    if (!pending) {
      onSubmit(new FormData(event.currentTarget))
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
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
        <FileField
          label='CSV ファイル'
          name={FILE}
          accept='.csv,text/csv'
          required
          description={`UTF-8 か Shift_JIS の、カンマで区切ったファイル。1 行目に列名を、2 行目から 1 行に 1 人ずつ、${MOST_REGISTERED} 人まで書きます。`}
          error={errors[FILE]}
          onChange={(event) =>
            onChoose(event.currentTarget.files?.item(0) ?? undefined)
          }
        />
        {chosen?.type === 'reading' && (
          <LoadingIndicator label='ファイルを読んでいます' />
        )}
        {problems.length > 0 && (
          <Alert tone='danger' title='ファイルの誤り'>
            <div className={styles['problems']}>
              <p>
                直したファイルを選び直してください。どのお客様も、まだ登録していません。
              </p>
              <BulletList>
                {problems.map((problem) => {
                  const text = problemTextOf(problem)
                  return <li key={text}>{text}</li>
                })}
              </BulletList>
            </div>
          </Alert>
        )}
      </form>
      {customers.length > 0 && (
        <Table
          caption='登録するお客様'
          columns={[
            { key: 'row', header: '行', align: 'end', cell: ({ row }) => row },
            {
              key: 'name',
              header: 'お名前',
              cell: ({ request }) => customerNameOf(request),
            },
            {
              key: 'kana',
              header: 'フリガナ',
              cell: ({ request }) => customerKanaOf(request),
            },
            {
              key: 'email',
              header: 'メールアドレス',
              cell: ({ request }) => request.email,
            },
            {
              key: 'phoneNumber',
              header: '電話番号',
              cell: ({ request }) => request.phoneNumber,
            },
            {
              key: 'membershipTier',
              header: '会員ランク',
              cell: ({ request }) => tierNameOf(request.membershipTier),
            },
          ]}
          rowHeader='name'
          rows={customers}
          rowKey={({ row }) => String(row)}
          emptyMessage='登録するお客様はいません'
        />
      )}
      <Actions layout='row'>
        <Button type='submit' form={formId} variant='primary' pending={pending}>
          {customers.length === 0
            ? '登録する'
            : `${customers.length} 人を登録する`}
        </Button>
        {actions}
      </Actions>
    </div>
  )
}
