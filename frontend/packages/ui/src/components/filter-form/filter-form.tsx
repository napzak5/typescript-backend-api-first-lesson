import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  type FormEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useSay } from '../../hooks/language'
import { useWideScreen } from '../../hooks/wide-screen'
import { Actions } from '../actions/actions'
import { Button } from '../button/button'
import { ButtonLink } from '../button-link/button-link'
import { Dialog } from '../dialog/dialog'
import {
  type AnyFormErrors,
  firstInvalidIn,
  hasErrors,
} from '../form/error-focus'
import { NO_ERRORS } from '../form/form-values'
import styles from './filter-form.module.css'

export type FilterFormProps = {
  /**
   * What is looked for: the name of the search, and the title of the sheet
   * of its conditions (「お客様を探す」)
   */
  label: string
  /**
   * What sending it does. A `search` looks for what was typed: 「探す」. A
   * `view` shows the list as the chosen conditions narrow it: 「表示する」.
   * A `count` counts over the chosen days: 「集計する」
   */
  purpose?: FilterPurpose | undefined
  /** The controls in sight on every screen: the keyword, the day of a list */
  children?: ReactNode
  /**
   * The other conditions. On a narrow screen they are in a sheet, which the
   * button 「条件」 opens
   */
  conditions?: ReactNode
  /** How many of `conditions` narrow the list now: the button says 「条件（2）」 */
  conditionCount?: number | undefined
  /**
   * What is wrong with the values that were sent, which the controls show.
   * A new object is the answer to another attempt, and the focus goes to the
   * first control that has an error. Of a form whose texts are messages, the
   * messages as the attempt left them, and not what was said of them: the
   * focus stays where it is when only the language changes
   */
  errors?: AnyFormErrors | undefined
  /** The address of the list without the conditions, while they narrow it */
  clearHref?: string | undefined
  /** Called with the values of the controls, under their names, when it is sent */
  onSubmit: (values: FormData) => void
}

type FilterPurpose = 'search' | 'view' | 'count'

const SUBMIT_LABEL: Record<FilterPurpose, LocalizedText> = {
  search: uiMessages.filterForm.search,
  view: uiMessages.filterForm.view,
  count: uiMessages.filterForm.count,
}

/**
 * The conditions of a list, above it: a `search` landmark around a form.
 * The controls in sight come first, then the other conditions, then the
 * button that sends them and the link that takes them away. The names of
 * the controls are those of the conditions; `useFilterValues` keeps what
 * they show in step with the address.
 *
 * Below 40rem the other conditions are in a sheet on the bottom edge,
 * which the button 「条件」 opens, so that the list starts on the first
 * screen. The sheet is part of the form: closed, it still holds what was
 * chosen, and the button in sight sends that too. Sending the form closes
 * the sheet; when the answer names an error of a control in it, it opens
 * again with the focus on that control.
 */
export const FilterForm = ({
  label,
  purpose = 'search',
  children,
  conditions,
  conditionCount = 0,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: FilterFormProps) => {
  const say = useSay()
  const wide = useWideScreen()
  const inSheet = !wide && conditions !== undefined
  const inSight = inSheet ? undefined : conditions
  const [sheetOpen, setSheetOpen] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const sheet = useRef<HTMLDivElement>(null)

  if (sheetOpen && !inSheet) {
    // The window was made wide: the conditions are in sight
    setSheetOpen(false)
  }

  // After an attempt, the first control with an error takes the focus. In
  // the closed sheet it cannot: the sheet opens, and the effect below moves
  // the focus once it is open
  useLayoutEffect(() => {
    if (!hasErrors(errors)) {
      return
    }
    const invalid = firstInvalidIn(form.current)
    if (invalid?.closest('dialog')?.open === false) {
      setSheetOpen(true)
    } else {
      invalid?.focus()
    }
  }, [errors])

  // The sheet opens in the commit that changes `sheetOpen`, before this runs
  useLayoutEffect(() => {
    if (sheetOpen) {
      firstInvalidIn(sheet.current)?.focus()
    }
  }, [sheetOpen])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setSheetOpen(false)
    onSubmit(new FormData(event.currentTarget))
  }

  const submitButton = (
    <Button type='submit' variant='primary'>
      {say(SUBMIT_LABEL[purpose])}
    </Button>
  )

  return (
    <search aria-label={label}>
      {/* The messages of the controls replace those of the browser */}
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        {(children !== undefined || inSight !== undefined) && (
          <div className={styles['controls']}>
            {children !== undefined && (
              <div className={styles['fields']}>{children}</div>
            )}
            {inSight}
          </div>
        )}
        <Actions>
          {(!inSheet || children !== undefined) && submitButton}
          {inSheet && (
            <Button aria-haspopup='dialog' onClick={() => setSheetOpen(true)}>
              {say(uiMessages.filterForm.conditions(conditionCount))}
            </Button>
          )}
          {clearHref !== undefined && (
            <ButtonLink href={clearHref} variant='quiet'>
              {say(uiMessages.filterForm.clear)}
            </ButtonLink>
          )}
        </Actions>
        {inSheet && (
          <Dialog
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title={label}
            actions={
              <>
                <Button onClick={() => setSheetOpen(false)}>
                  {say(uiMessages.close)}
                </Button>
                {submitButton}
              </>
            }
          >
            <div className={styles['sheet']} ref={sheet}>
              {conditions}
            </div>
          </Dialog>
        )}
      </form>
    </search>
  )
}
