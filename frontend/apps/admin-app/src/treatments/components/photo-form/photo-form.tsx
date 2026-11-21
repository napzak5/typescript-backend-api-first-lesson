import {
  Button,
  Checkbox,
  FieldRow,
  Form,
  type FormErrors,
  Note,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { PHOTO_TYPE_OPTIONS, photoControlOf } from '../../treatment-photos'
import styles from './photo-form.module.css'

export type PhotoFormProps = {
  /** How many photos the record can still take: the form offers no more rows */
  room: number
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /**
   * What is wrong with the values, under the names of the controls: a
   * photo's under `photos.<n>.<name>`. A new object is the answer to
   * another attempt
   */
  errors?: FormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/** Where the focus goes after a row was added or taken away */
type Focus = { type: 'row'; key: number } | { type: 'add' } | undefined

const NO_ERRORS: FormErrors = {}

/**
 * The photos to add to a treatment record, a group of controls each: when
 * it was taken, the address it is kept at (and that of a smaller one), the
 * angle, what it shows, and how the customer lets it be used. The API
 * keeps the address of a photo, not its file: the photo is put where the
 * salon keeps its photos first.
 *
 * The form opens with one photo. A photo is added at the end and its first
 * control takes the focus; one that is taken away gives the focus to the
 * button that adds one. An error names a row by its number, and taking a
 * row away renumbers the rows after it: the errors of the rows are shown
 * until a row is taken away, and again after the next attempt.
 */
export const PhotoForm = ({
  room,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: PhotoFormProps) => {
  const [rows, setRows] = useState<number[]>([0])
  const [nextKey, setNextKey] = useState(1)
  const [focus, setFocus] = useState<Focus>()
  const [outdated, setOutdated] = useState<FormErrors | undefined>(undefined)
  const said = errors === outdated ? NO_ERRORS : errors
  const groups = useRef(new Map<number, HTMLFieldSetElement>())
  const add = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (focus?.type === 'row') {
      groups.current.get(focus.key)?.querySelector('select')?.focus()
    }
    if (focus?.type === 'add') {
      add.current?.focus()
    }
  }, [focus])

  const addRow = (): void => {
    setRows([...rows, nextKey])
    setNextKey(nextKey + 1)
    setFocus({ type: 'row', key: nextKey })
  }

  const removeRow = (key: number): void => {
    setRows(rows.filter((row) => row !== key))
    setOutdated(errors)
    setFocus({ type: 'add' })
  }

  return (
    <Form
      submitLabel='写真を足す'
      message={message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <Note size='small'>
        写真は、サロンが写真を置いている場所（写真の保存サービスなど）に置いてから、その
        URL を書きます。施術記録は、写真のファイルを預かりません。
      </Note>
      {rows.map((key, index) => (
        <fieldset
          key={key}
          className={styles['row']}
          ref={(group) => {
            if (group === null) {
              groups.current.delete(key)
            } else {
              groups.current.set(key, group)
            }
          }}
        >
          <legend
            className={styles['rowName']}
          >{`${index + 1} 枚目の写真`}</legend>
          <div className={styles['controls']}>
            <FieldRow>
              <Select
                label='区分'
                name={photoControlOf(index, 'photoType')}
                options={PHOTO_TYPE_OPTIONS}
                placeholder='選んでください'
                required
                defaultValue=''
                error={said[photoControlOf(index, 'photoType')]}
              />
              <TextField
                label='撮った向き'
                name={photoControlOf(index, 'angle')}
                autoComplete='off'
                description='正面、側面、後ろなど。50 文字まで。'
                error={said[photoControlOf(index, 'angle')]}
              />
            </FieldRow>
            <TextField
              label='写真の URL'
              name={photoControlOf(index, 'photoUrl')}
              type='url'
              autoComplete='off'
              required
              description='http:// か https:// で始まる、ドメイン名（photos.example.com など）の URL。500 文字まで。'
              error={said[photoControlOf(index, 'photoUrl')]}
            />
            <TextField
              label='縮小した写真の URL'
              name={photoControlOf(index, 'thumbnailUrl')}
              type='url'
              autoComplete='off'
              description='小さくした写真があれば、その URL。施術記録の写真の一覧に出します。'
              error={said[photoControlOf(index, 'thumbnailUrl')]}
            />
            <TextArea
              label='写真の説明'
              name={photoControlOf(index, 'description')}
              rows={2}
            />
            <div className={styles['choices']}>
              <Checkbox
                label='お客様が、写真の撮影と利用に同意している'
                name={photoControlOf(index, 'customerConsent')}
              />
              <Checkbox
                label='サロンの外（サロンのページなど）に見せてよい'
                name={photoControlOf(index, 'isPublic')}
                description='お客様の同意がある写真だけ、サロンの外に見せられます。'
                error={said[photoControlOf(index, 'isPublic')]}
              />
            </div>
            {rows.length > 1 && (
              <Button
                size='small'
                aria-label={`${index + 1} 枚目の写真の欄を外す`}
                onClick={() => removeRow(key)}
              >
                外す
              </Button>
            )}
          </div>
        </fieldset>
      ))}
      {rows.length < room ? (
        <Button ref={add} onClick={addRow}>
          写真の欄を足す
        </Button>
      ) : (
        <Note size='small'>
          {`この施術記録に足せる写真は、あと ${room} 枚です。`}
        </Note>
      )}
    </Form>
  )
}
