import {
  keywordOf,
  LONGEST_KEYWORD,
} from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  Dialog,
  FilterForm,
  TextField,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'

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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title='紹介元を選ぶ'
      description='このお客様を紹介したお客様を、台帳から探して選びます。'
      size='wide'
      actions={<Button onClick={onClose}>やめる</Button>}
    >
      <FilterForm
        label='紹介元を探す'
        onSubmit={(values) => onSearch(keywordOf(values))}
      >
        <TextField
          label='キーワード'
          name='keyword'
          type='search'
          autoComplete='off'
          maxLength={LONGEST_KEYWORD}
          defaultValue={keyword}
          description='お名前（カナでも）、メールアドレス、電話番号の一部。'
        />
      </FilterForm>
      {children}
    </Dialog>
  )
}
