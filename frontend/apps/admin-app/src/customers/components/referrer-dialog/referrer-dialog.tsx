import {
  keywordOf,
  LONGEST_KEYWORD,
} from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  Dialog,
  FilterForm,
  TextField,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'

const { referrer: words, form } = adminCustomerMessages

export type ReferrerDialogProps = {
  open: boolean
  /** Called once when the dialog has closed: by the Escape key or by 「やめる」 */
  onClose: () => void
  /** The keyword that was searched for; `undefined` before a search */
  keyword: string | undefined
  /** Searches the ledger; `undefined` for a keyword that is none, which finds nobody */
  onSearch: (keyword: string | undefined) => void
  /** What the search found, below it: nothing before a search */
  children?: ReactNode
}

/**
 * The choice of the customer who referred another: the ledger searched by
 * a keyword, as a booking searches it, and the customers found below. The
 * dialog stands outside the form of the customer, so its own form is
 * nobody's child: pressing Enter in the keyword searches and sends nothing
 * else.
 */
export const ReferrerDialog = ({
  open,
  onClose,
  keyword,
  onSearch,
  children,
}: ReferrerDialogProps) => {
  const say = useSay()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={say(words.choose)}
      description={say(words.dialogDescription)}
      size='wide'
      actions={<Button onClick={onClose}>{say(form.cancel)}</Button>}
    >
      <FilterForm
        label={say(words.search)}
        onSubmit={(values) => onSearch(keywordOf(values))}
      >
        <TextField
          label={say(words.keyword)}
          name='keyword'
          type='search'
          autoComplete='off'
          maxLength={LONGEST_KEYWORD}
          defaultValue={keyword}
          description={say(words.keywordDescription)}
        />
      </FilterForm>
      {children}
    </Dialog>
  )
}
