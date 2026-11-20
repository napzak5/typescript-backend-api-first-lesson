import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReferrerChoiceProps } from './components/customer-form/customer-form'
import { ReferrerDialog } from './components/referrer-dialog/referrer-dialog'
import { referrerOf } from './customer-form'
import { FoundCustomers, searchKeyOf } from './found-customers'

export type ReferrerChoiceOfProps = ReferrerChoiceProps & {
  /** The customer the form is about, who cannot refer themselves; `undefined` for a new one */
  excluded: string | undefined
}

/**
 * The choice of a referrer from the ledger, searched by a keyword. The last
 * search stays while the form is open, so a choice that was given up opens
 * again where it was; the same keyword searched again reads anew.
 */
export const ReferrerChoice = ({
  open,
  onClose,
  onChoose,
  excluded,
}: ReferrerChoiceOfProps) => {
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState<string | undefined>(undefined)

  const search = (asked: string | undefined): void => {
    if (asked !== undefined && asked === keyword) {
      void queryClient.invalidateQueries({ queryKey: searchKeyOf(asked) })
      return
    }
    setKeyword(asked)
  }

  return (
    <ReferrerDialog
      open={open}
      onClose={onClose}
      keyword={keyword}
      onSearch={search}
    >
      {keyword !== undefined && (
        <FoundCustomers
          keyword={keyword}
          choose={{
            type: 'button',
            onChoose: (customer) => onChoose(referrerOf(customer)),
            excluded,
          }}
        />
      )}
    </ReferrerDialog>
  )
}
