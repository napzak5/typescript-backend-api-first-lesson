import {
  Alert,
  Button,
  Dialog,
  type FormErrors,
  RadioGroup,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useId, useLayoutEffect, useRef } from 'react'
import { MOST_CHOSEN, TAG, TAG_WAY } from '../../customer-bulk'
import styles from './chosen-customers.module.css'

/** The dialog that is open: none, the one that changes a tag, or the one that removes */
export type ChosenDialog = 'none' | 'tag' | 'removal'

export type ChosenCustomersProps = {
  /** The chosen customers, in the order they were chosen, by name: 「山田 花子」 */
  customers: readonly { id: string; name: string }[]
  /** The account may remove customers from the ledger */
  mayRemove: boolean
  open: ChosenDialog
  /** A button that opens a dialog was pressed: set `open` to it */
  onOpen: (dialog: Exclude<ChosenDialog, 'none'>) => void
  /** The dialog has closed, or its button that changes nothing was pressed: set `open` to `none` */
  onClose: () => void
  /** Nobody is to be chosen any more */
  onClear: () => void
  /** What went wrong with the attempt of the open dialog; it is said there */
  message?: string | undefined
  /** What is wrong with a value of the dialog of the tag, under the name of its control */
  errors?: FormErrors | undefined
  /** The write of the open dialog is on its way */
  pending?: boolean | undefined
  /** The form of the dialog of the tag was sent: `way` and `tag` */
  onRetag: (values: FormData) => void
  /** The removal was confirmed */
  onRemove: () => void
}

const NO_ERRORS: FormErrors = {}

/**
 * What can be done to the customers chosen in the ledger, all at once: a
 * tag given or taken away, and, for an account that may, a removal from
 * the ledger. Each asks in a dialog first. More customers than the API
 * takes at once are not written: the buttons wait until fewer are chosen.
 * Before anybody is chosen, it says what choosing is for, in its place:
 * the table below does not move when the first customer is chosen.
 *
 * When the last of the chosen goes with what was pressed here (the choice
 * given up, the customers removed), the buttons go too, and the focus
 * moves to the heading of the part, not to the start of the page.
 */
export const ChosenCustomers = ({
  customers,
  mayRemove,
  open,
  onOpen,
  onClose,
  onClear,
  message,
  errors = NO_ERRORS,
  pending = false,
  onRetag,
  onRemove,
}: ChosenCustomersProps) => {
  const headingId = useId()
  const formId = useId()
  const form = useErrorFocus(errors)
  const count = customers.length
  const tooMany = count > MOST_CHOSEN
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const hadChosen = useRef(count > 0)

  useLayoutEffect(() => {
    const focused = document.activeElement
    const lost =
      focused === null ||
      focused === document.body ||
      sectionRef.current?.contains(focused) === true
    // A customer let go of in the table keeps the focus there
    if (hadChosen.current && count === 0 && lost) {
      headingRef.current?.focus()
    }
    hadChosen.current = count > 0
  }, [count])

  const retag = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onRetag(new FormData(event.currentTarget))
  }

  return (
    <section
      className={styles['chosen']}
      aria-labelledby={headingId}
      ref={sectionRef}
    >
      <h2
        className={styles['count']}
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
      >
        {count === 0 ? '選んだお客様はいません' : `${count} 人を選んでいます`}
      </h2>
      {count === 0 && (
        <p>
          {mayRemove
            ? '表でお客様を選ぶと、まとめてタグを付けたり外したり、台帳から削除したりできます。'
            : '表でお客様を選ぶと、まとめてタグを付けたり外したりできます。'}
        </p>
      )}
      {tooMany && (
        <Alert tone='warning'>
          {`一度に操作できるのは ${MOST_CHOSEN} 人までです。選ぶお客様を減らしてください。`}
        </Alert>
      )}
      {count > 0 && (
        <div className={styles['actions']}>
          <Button disabled={tooMany} onClick={() => onOpen('tag')}>
            タグを付ける・外す
          </Button>
          {mayRemove && (
            <Button
              variant='danger'
              disabled={tooMany}
              onClick={() => onOpen('removal')}
            >
              台帳から削除する
            </Button>
          )}
          <Button variant='quiet' onClick={onClear}>
            選ぶのをやめる
          </Button>
        </div>
      )}
      <Dialog
        open={count > 0 && open === 'tag'}
        onClose={onClose}
        title={`選んだ ${count} 人のタグ`}
        description='タグを付けるか外すかを選び、タグを 1 つ入力します。お客様のほかのタグは、そのまま残ります。'
        actions={
          <>
            <Button onClick={onClose}>戻る</Button>
            <Button
              type='submit'
              form={formId}
              variant='primary'
              pending={pending}
            >
              反映する
            </Button>
          </>
        }
      >
        <form
          className={styles['form']}
          id={formId}
          noValidate
          onSubmit={retag}
          ref={form}
        >
          {open === 'tag' && message !== undefined && (
            <Alert tone='danger'>{message}</Alert>
          )}
          <RadioGroup
            label='タグを'
            name={TAG_WAY}
            defaultValue='add'
            required
            options={[
              { value: 'add', label: '付ける' },
              { value: 'remove', label: '外す' },
            ]}
          />
          <TextField
            label='タグ'
            name={TAG}
            required
            autoComplete='off'
            description='例: 秋のキャンペーン'
            error={errors[TAG]}
          />
        </form>
      </Dialog>
      <Dialog
        open={count > 0 && open === 'removal'}
        onClose={onClose}
        title={`${count} 人のお客様を台帳から削除しますか？`}
        description='顧客台帳と予約で、これらのお客様を選べなくなります。予約と売上の記録は残ります。'
        actions={
          <>
            <Button onClick={onClose}>戻る</Button>
            <Button variant='danger' pending={pending} onClick={onRemove}>
              削除する
            </Button>
          </>
        }
      >
        <div className={styles['removal']}>
          {open === 'removal' && message !== undefined && (
            <Alert tone='danger'>{message}</Alert>
          )}
          <ul className={styles['names']} aria-label='削除するお客様'>
            {customers.map(({ id, name }) => (
              <li key={id}>{name} 様</li>
            ))}
          </ul>
        </div>
      </Dialog>
    </section>
  )
}
