import {
  Actions,
  Alert,
  BulletList,
  Button,
  Dialog,
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  RadioGroup,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useId, useLayoutEffect, useRef } from 'react'
import { MOST_CHOSEN, TAG, TAG_WAY } from '../../utils/customer-bulk'
import styles from './chosen-customers.module.css'

const { bulk: words, naming } = adminCustomerMessages

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
  /** What went wrong with the attempt of the open dialog; it is said there, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with a value of the dialog of the tag, under the name of its control */
  errors?: FormErrors<LocalizedText> | undefined
  /** The write of the open dialog is on its way */
  pending?: boolean | undefined
  /** The form of the dialog of the tag was sent: `way` and `tag` */
  onRetag: (values: FormData) => void
  /** The removal was confirmed */
  onRemove: () => void
}

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
  const say = useSay()
  const said = useSaidForm(message, errors)
  const headingId = useId()
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
        {say(count === 0 ? words.chosen.none : words.chosen.count(count))}
      </h2>
      {count === 0 && (
        <p>
          {say(mayRemove ? words.chosen.aboutWithRemoval : words.chosen.about)}
        </p>
      )}
      {tooMany && (
        <Alert tone='warning'>{say(words.chosen.tooMany(MOST_CHOSEN))}</Alert>
      )}
      {count > 0 && (
        <Actions>
          <Button disabled={tooMany} onClick={() => onOpen('tag')}>
            {say(words.chosen.retag)}
          </Button>
          {mayRemove && (
            <Button
              variant='danger'
              disabled={tooMany}
              onClick={() => onOpen('removal')}
            >
              {say(words.chosen.remove)}
            </Button>
          )}
          <Button variant='quiet' onClick={onClear}>
            {say(words.chosen.clear)}
          </Button>
        </Actions>
      )}
      <FormDialog
        open={count > 0 && open === 'tag'}
        onClose={onClose}
        title={say(words.tag.title(count))}
        description={say(words.tag.description)}
        submitLabel={say(words.tag.apply)}
        message={open === 'tag' ? said.message : undefined}
        errors={errors}
        pending={pending}
        onSubmit={onRetag}
      >
        <RadioGroup
          label={say(words.tag.way)}
          name={TAG_WAY}
          defaultValue='add'
          required
          options={[
            { value: 'add', label: say(words.tag.add) },
            { value: 'remove', label: say(words.tag.remove) },
          ]}
        />
        <TextField
          label={say(words.tag.tag)}
          name={TAG}
          required
          autoComplete='off'
          description={say(words.tag.example)}
          error={said.errors[TAG]}
        />
      </FormDialog>
      <Dialog
        open={count > 0 && open === 'removal'}
        onClose={onClose}
        title={say(words.removal.title(count))}
        description={say(words.removal.description)}
        actions={
          <>
            <Button onClick={onClose}>{say(words.removal.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onRemove}>
              {say(words.removal.confirm)}
            </Button>
          </>
        }
      >
        <div className={styles['removal']}>
          {open === 'removal' && said.message !== undefined && (
            <Alert tone='danger'>{said.message}</Alert>
          )}
          <BulletList aria-label={say(words.removal.list)}>
            {customers.map(({ id, name }) => (
              <li key={id}>{say(naming.honored(name))}</li>
            ))}
          </BulletList>
        </div>
      </Dialog>
    </section>
  )
}
