import type {
  ModelsReviewSortType,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Alert,
  ButtonLink,
  Card,
  EmptyState,
  LoadingIndicator,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { ReviewList } from './components/review-list/review-list'
import { ReviewSummary } from './components/review-summary/review-summary'
import { SalonAbout } from './components/salon-about/salon-about'
import { SalonHours } from './components/salon-hours/salon-hours'
import { ServiceMenu } from './components/service-menu/service-menu'
import { StaffProfiles } from './components/staff-profiles/staff-profiles'
import { cursorAfter, firstCursor, listingOf, moreOf } from './pages'
import { dateAt } from './salon-format'
import { menuOf } from './salon-menu'
import {
  readMenu,
  readReviewSummary,
  readReviews,
  readSalon,
  readStaff,
} from './salons-api'
import { UnreadNotice } from './unread-notice'

/** The title of the screen that could not read the salon, and so not its name */
const TITLE = 'サロンの詳細'

const NOT_READ = P.union('notFound', 'tooManyRequests', 'failed')

type OfSalonProps = {
  salon: ModelsSalonResponse
}

/**
 * A part of the screen reads what it shows itself: a menu that cannot be
 * read does not take the hours and the reviews with it.
 */
const MenuSection = ({ salon }: OfSalonProps) => {
  const read = useQuery({
    queryKey: ['salons', salon.id, 'menu'],
    queryFn: () => readMenu(salon.id),
  })

  return (
    <Card title='メニュー'>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='メニューを読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ categories, services }) => {
          const groups = menuOf(categories, services)

          return groups.length === 0 ? (
            <EmptyState title='掲載中のメニューはありません' />
          ) : (
            <ServiceMenu groups={groups} currency={salon.currency} />
          )
        })
        .with({ type: NOT_READ }, (reason) => (
          <UnreadNotice
            what='メニュー'
            reason={reason}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

const StaffSection = ({ salon }: OfSalonProps) => {
  const read = useQuery({
    queryKey: ['salons', salon.id, 'staff'],
    queryFn: () => readStaff(salon.id),
  })

  return (
    <Card title='スタッフ'>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='スタッフを読み込んでいます' />
        ))
        .with({ type: 'found', staff: [] }, () => (
          <EmptyState title='掲載中のスタッフはいません' />
        ))
        .with({ type: 'found' }, ({ staff }) => <StaffProfiles staff={staff} />)
        .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
          <UnreadNotice
            what='スタッフ'
            reason={reason}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

const ReviewsSection = ({ salon }: OfSalonProps) => {
  const [sortBy, setSortBy] = useState<ModelsReviewSortType>('recent')
  const summary = useQuery({
    queryKey: ['salons', salon.id, 'review-summary'],
    queryFn: () => readReviewSummary(salon.id),
  })
  const reviews = useInfiniteQuery({
    queryKey: ['salons', salon.id, 'reviews', sortBy],
    queryFn: ({ pageParam }) => readReviews(salon.id, sortBy, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // The reviews stay while they are read in another order: the control
    // that chose the order stays with them, and keeps the focus
    placeholderData: keepPreviousData,
  })

  return (
    <Card title='レビュー'>
      {match(summary.data)
        .with(undefined, () => (
          <LoadingIndicator label='評価を読み込んでいます' />
        ))
        .with({ type: 'found' }, (found) => (
          <ReviewSummary summary={found.summary} />
        ))
        .with({ type: NOT_READ }, (reason) => (
          <UnreadNotice
            what='評価'
            reason={reason}
            onRetry={() => void summary.refetch()}
            retrying={summary.isFetching}
          />
        ))
        .exhaustive()}
      {match(
        reviews.data === undefined ? undefined : listingOf(reviews.data.pages),
      )
        .with(undefined, () => (
          <LoadingIndicator label='レビューを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            what='レビュー'
            reason={reason}
            onRetry={() => void reviews.refetch()}
            retrying={reviews.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState title='レビューは、まだありません' />
        ))
        .with({ type: 'listed' }, ({ items, rest }) => (
          <ReviewList
            reviews={items}
            timezone={salon.timezone}
            sortBy={sortBy}
            onSortChange={setSortBy}
            more={moreOf(rest, {
              nextPage: reviews.isFetchingNextPage,
              again: reviews.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread'
                ? reviews.refetch()
                : reviews.fetchNextPage())
            }
          />
        ))
        .exhaustive()}
    </Card>
  )
}

const SalonPage = ({ salon }: OfSalonProps) => (
  <>
    <PageHeader
      title={salon.name}
      description={salon.nameKana ?? undefined}
      actions={
        <ButtonLink href='/' variant='secondary'>
          サロンを探す
        </ButtonLink>
      }
    />
    {!salon.isActive && (
      <Alert tone='warning'>
        このサロンは、現在、予約を受け付けていません。
      </Alert>
    )}
    <Card title='サロンについて'>
      <SalonAbout salon={salon} />
    </Card>
    <Card title='営業時間'>
      <SalonHours
        businessHours={salon.businessHours}
        openingHours={salon.openingHours}
        timezone={salon.timezone}
        today={dateAt(new Date(), salon.timezone)}
      />
    </Card>
    <MenuSection salon={salon} />
    <StaffSection salon={salon} />
    <ReviewsSection salon={salon} />
  </>
)

/**
 * The page of a salon: what it says about itself, when it is open, what it
 * offers, who works there and how it was rated. It opens for whoever has
 * its address, also when the salon takes no bookings.
 */
export const SalonScreen = () => {
  const { salonId = '' } = useParams()
  const read = useQuery({
    queryKey: ['salons', salonId, 'salon'],
    queryFn: () => readSalon(salonId),
  })

  return (
    match(read.data)
      // No heading while the salon is read: the heading is its name, and the
      // focus moves to it when it is there to be read out
      .with(undefined, () => (
        <LoadingIndicator label='サロンを読み込んでいます' />
      ))
      .with({ type: 'found' }, ({ salon }) => <SalonPage salon={salon} />)
      .with({ type: 'notFound' }, () => (
        <>
          <PageHeader
            title='サロンが見つかりません'
            description='アドレスが正しいか、お確かめください。掲載を終えたサロンかもしれません。'
          />
          <p>
            <ButtonLink href='/'>サロンを探す</ButtonLink>
          </p>
        </>
      ))
      .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
        <>
          <PageHeader title={TITLE} />
          <UnreadNotice
            what='サロン'
            reason={reason}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        </>
      ))
      .exhaustive()
  )
}
