import {
  cursorAfter,
  firstCursor,
  listingOf,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  inJapanese,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  reviewHrefOf,
  reviewReportsHrefOf,
  reviewsHrefOf,
} from '../../navigation'
import { useHandlesReports } from '../../review-reports/screens/review-handling'
import {
  readStaffProfiles,
  staffProfilesKeyOf,
} from '../../salons/api/salons-api'
import {
  readReviewPage,
  readReviewSummary,
  reviewsKeyOf,
} from '../api/reviews-api'
import { ReviewFilter } from '../components/review-filter/review-filter'
import { ReviewSummary } from '../components/review-summary/review-summary'
import { ReviewTable } from '../components/review-table/review-table'
import {
  isNarrowed,
  readReviewConditions,
  reviewConditionsIn,
  reviewListParamsOf,
  reviewQueryOf,
} from '../utils/review-search'

const TITLE = 'レビュー'

/** What the reviews of the salon come to, read whenever the screen opens: customers write them at any time. */
const SummaryPart = ({ salonId }: { salonId: string }) => {
  const read = useQuery({
    queryKey: [...reviewsKeyOf(salonId), 'summary'],
    queryFn: () => readReviewSummary(salonId),
    staleTime: 0,
  })

  return match(read.data)
    .with(undefined, () => (
      <LoadingIndicator label='評価のまとめを読み込んでいます' />
    ))
    .with({ type: 'found' }, ({ summary }) => (
      <ReviewSummary summary={summary} />
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={inJapanese(
          unreadMessageOf(writtenInJapanese('評価のまとめ'), reason),
        )}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .exhaustive()
}

type ReviewListProps = {
  salon: ModelsSalonResponse
  /** The staff of the salon; `undefined` while they are read, or when they could not be */
  staff: readonly ModelsStaffProfileResponse[] | undefined
}

/**
 * The reviews of a salon that meet the conditions of the address, in the
 * order it asks for: the latest first, unless it asks for another.
 */
const ReviewList = ({ salon, staff }: ReviewListProps) => {
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const conditions = reviewConditionsIn(query)
  const asked = reviewQueryOf(conditions).toString()
  const narrowed = isNarrowed(conditions)
  const read = useInfiniteQuery({
    queryKey: [...reviewsKeyOf(salon.id), 'list', asked],
    queryFn: ({ pageParam }) =>
      readReviewPage(salon.id, reviewListParamsOf(conditions), pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Customers write, change and remove reviews at any time, and the
    // reports and answers change them: the list is read whenever it is shown
    staleTime: 0,
  })

  const filter = (values: FormData): void => {
    const chosen = readReviewConditions(values)
    if (chosen.type === 'invalid') {
      setErrors(chosen.errors)
      return
    }
    setErrors(undefined)
    const next = reviewQueryOf(chosen.value)
    if (next.toString() === asked) {
      // The same reviews again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  return (
    <>
      <ReviewFilter
        conditions={conditions}
        staff={staff ?? []}
        errors={errors}
        clearHref={asked === '' ? undefined : reviewsHrefOf(salon.id)}
        onSubmit={filter}
      />
      {match(read.data === undefined ? undefined : listingOf(read.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label='レビューを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={inJapanese(
              unreadMessageOf(writtenInJapanese('レビュー'), reason),
            )}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title='条件に合うレビューはありません'
              description='評価の範囲やスタッフを変えて探してください。'
            />
          ) : (
            <EmptyState
              title='レビューはありません'
              description='お客様は、来店のあとに、ポータルからレビューを書けます。届いたレビューは、ここに並びます。'
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <ReviewTable
            // Other conditions are another list
            key={asked}
            caption={narrowed ? '条件に合うレビュー' : TITLE}
            reviews={items}
            timezone={salon.timezone}
            staff={staff}
            reviewHref={(id) => reviewHrefOf(salon.id, id)}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
          />
        ))
        .exhaustive()}
    </>
  )
}

/**
 * The reviews of a salon: what they come to, and the reviews themselves,
 * which lead to their answers and reports. The members of the staff name
 * those the reviews rate once they are read. An administrator goes from
 * here to the reports of the reviews.
 */
const ReviewsPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const handles = useHandlesReports()
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })

  return (
    <>
      <PageHeader
        title={TITLE}
        description={salon.name}
        actions={
          handles ? (
            <ButtonLink href={reviewReportsHrefOf(salon.id)}>
              通報を見る
            </ButtonLink>
          ) : undefined
        }
      />
      <SummaryPart salonId={salon.id} />
      <ReviewList
        salon={salon}
        staff={match(staff.data)
          .with({ type: 'found' }, ({ items }) => items)
          .otherwise(() => undefined)}
      />
    </>
  )
}

/** The reviews of the salon of the address, for every member of its staff and an administrator. */
export const ReviewsScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <ReviewsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
