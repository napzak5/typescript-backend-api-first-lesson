import {
  EmptyState,
  LoadingIndicator,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { match } from 'ts-pattern'
import { cursorAfter, firstCursor, listingOf, moreOf } from '../pages'
import { unreadMessageOf } from '../reading'
import { CustomerChoices } from './components/customer-choices/customer-choices'
import type { ReferrerChoiceProps } from './components/customer-form/customer-form'
import { ReferrerDialog } from './components/referrer-dialog/referrer-dialog'
import { referrerOf } from './customer-form'
import { CUSTOMER_LISTS, findCustomers } from './customers-api'

/** The key of the customers a keyword finds: the search of a booking reads the same pages */
const searchKeyOf = (keyword: string): string[] => [
  ...CUSTOMER_LISTS,
  'search',
  keyword,
]

type FoundProps = {
  keyword: string
  excluded: string | undefined
  onChoose: ReferrerChoiceProps['onChoose']
}

/** The customers of the ledger that have the keyword, each chosen by their name. */
const Found = ({ keyword, excluded, onChoose }: FoundProps) => {
  const found = useInfiniteQuery({
    queryKey: searchKeyOf(keyword),
    queryFn: ({ pageParam }) => findCustomers(keyword, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Customers are registered at every salon of the platform
    staleTime: 0,
  })

  return match(
    found.data === undefined ? undefined : listingOf(found.data.pages),
  )
    .with(undefined, () => <LoadingIndicator label='お客様を探しています' />)
    .with({ type: 'unread' }, ({ reason }) => (
      <UnreadNotice
        message={unreadMessageOf('お客様', reason)}
        onRetry={() => void found.refetch()}
        retrying={found.isFetching}
      />
    ))
    .with({ type: 'listed', items: [] }, () => (
      <EmptyState
        title='キーワードに合うお客様が見つかりませんでした'
        description='キーワードを変えて、もう一度お探しください。'
      />
    ))
    .with({ type: 'listed' }, ({ items, total, rest }) => (
      <CustomerChoices
        customers={items}
        total={total}
        more={moreOf(rest, {
          nextPage: found.isFetchingNextPage,
          again: found.isRefetching,
        })}
        onMore={() =>
          void (rest === 'unread' ? found.refetch() : found.fetchNextPage())
        }
        choose={{
          type: 'button',
          onChoose: (customer) => onChoose(referrerOf(customer)),
          excluded,
        }}
      />
    ))
    .exhaustive()
}

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
        <Found keyword={keyword} excluded={excluded} onChoose={onChoose} />
      )}
    </ReferrerDialog>
  )
}
