import {
  cursorAfter,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  EmptyState,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { findSalons } from '../api/salons-api'
import { KeywordSearch } from '../components/keyword-search/keyword-search'
import { SalonChoices } from '../components/salon-choices/salon-choices'
import { keywordIn, keywordOf } from '../utils/keyword'
import { KEYWORD, queryOfKeyword } from '../utils/salon-choice'

export type SalonChoiceScreenProps = {
  /** What the salon is chosen for: 「予約台帳を開くサロンを選びます。」 */
  description: string
  /** Where choosing a salon leads */
  salonHref: (salon: ModelsSalonResponse) => string
  /** What else is done here: 「サロンを登録する」 */
  actions?: ReactNode | undefined
}

/** The key every search of the choice is read under: what adds or removes a salon takes them away. */
export const SALON_CHOICES = ['salons', 'choice']

/**
 * Where an administrator chooses the salon to work on: every salon, or
 * those with a keyword. The keyword is in the query of the address, so a
 * reload and the way back from a salon show the same choice. The choice is
 * the start of an application (`/`).
 */
export const SalonChoiceScreen = ({
  description,
  salonHref,
  actions,
}: SalonChoiceScreenProps) => {
  const [query, setQuery] = useSearchParams()
  const keyword = keywordIn(query, KEYWORD)
  const found = useInfiniteQuery({
    queryKey: [...SALON_CHOICES, keyword ?? ''],
    queryFn: ({ pageParam }) => findSalons(keyword, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
  })

  const search = (values: FormData): void => {
    const asked = keywordOf(values)
    if (asked === keyword) {
      // The same search again: whoever sends it wants what there is now
      void found.refetch()
      return
    }
    setQuery(queryOfKeyword(asked))
  }

  return (
    <>
      <PageHeader
        title='サロンを選ぶ'
        description={description}
        actions={actions}
      />
      <KeywordSearch
        label='サロンを探す'
        description='サロンの名前か紹介文にある言葉。空欄のときは、すべてのサロンを並べます。'
        keyword={keyword}
        clearHref='/'
        onSubmit={search}
      />
      {match(found.data === undefined ? undefined : listingOf(found.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label='サロンを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('サロン', reason)}
            onRetry={() => void found.refetch()}
            pending={found.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          keyword === undefined ? (
            <EmptyState title='サロンはまだありません' />
          ) : (
            <EmptyState
              title='キーワードに合うサロンが見つかりませんでした'
              description='キーワードを変えて、もう一度お探しください。'
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <SalonChoices
            // The salons of another search are another list, and no added ones
            key={keyword ?? ''}
            salons={items}
            total={total}
            more={moreOf(rest, {
              nextPage: found.isFetchingNextPage,
              again: found.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? found.refetch() : found.fetchNextPage())
            }
            salonHref={salonHref}
          />
        ))
        .exhaustive()}
    </>
  )
}
