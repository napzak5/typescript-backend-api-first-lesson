import { RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  Card,
  DescriptionList,
  EmptyState,
  Link,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { whenLineOf } from '../bookings/booking-format'
import { listHrefOf } from '../bookings/own-bookings'
import { type FormSays, NOTHING_TO_SAY } from '../forms'
import { CUSTOMERS } from '../roles'
import { unreadMessageOf } from '../salons/pages'
import { SignInHelp } from '../sign-in-help'
import { ReviewForm } from './components/review-form/review-form'
import { afterReviewWrite } from './review-cache'
import {
  afterReviewWriting,
  enteredForVisit,
  isOfTheVisit,
  readNewReview,
} from './review-flow'
import {
  readVisitToReview,
  type Visit,
  visitToReviewKey,
  writeReview,
} from './reviews-api'

const TITLE = 'レビューを書く'

/** Where what the customer wrote is listed, and where the form leads */
const OWN_REVIEWS = '/mypage/reviews'

const UNREAD = P.union('tooManyRequests', 'failed')

const TO_THE_VISITS = (
  <ButtonLink href={listHrefOf('past')}>これまでの予約を見る</ButtonLink>
)

type WritingProps = {
  visit: Visit
  /** The API said of the visit itself that it cannot be written about */
  onRefused: () => void
}

/**
 * The visit, and below it the form of its review. Whose visit it is, and
 * at which salon, is what the screen read: the form asks how it was.
 */
const Writing = ({ visit, onRefused }: WritingProps) => {
  const { booking, salon, staff } = visit
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const writing = useMutation({
    mutationFn: writeReview,
    onSuccess: (outcome) => {
      if (outcome.type === 'written') {
        afterReviewWrite(queryClient, outcome.review, outcome.review)
        notify({ tone: 'success', message: 'レビューを投稿しました。' })
        void navigate(OWN_REVIEWS)
        return
      }
      setSays(afterReviewWriting(outcome))
      if (isOfTheVisit(outcome)) {
        onRefused()
      }
    },
  })

  const submit = (values: FormData): void => {
    match(readNewReview(values, visit))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSays({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => writing.mutate(value))
      .exhaustive()
  }

  return (
    <>
      <Card title='レビューする来店'>
        <DescriptionList
          items={[
            {
              term: 'サロン',
              description: (
                <Link href={`/salons/${salon.id}`}>{salon.name}</Link>
              ),
            },
            {
              term: '来店日時',
              description: whenLineOf(booking, salon.timezone),
            },
          ]}
        />
      </Card>
      <ReviewForm
        entered={enteredForVisit(visit)}
        staff={{
          type: 'choice',
          options: staff.map(({ id, displayName }) => ({
            value: id,
            label: displayName,
          })),
        }}
        submitLabel='レビューを投稿する'
        message={says.message}
        errors={says.errors}
        pending={writing.isPending}
        actions={
          <ButtonLink href={`/bookings/${booking.id}`} variant='quiet'>
            予約の内容へ戻る
          </ButtonLink>
        }
        onSubmit={submit}
      />
    </>
  )
}

const VisitToReview = () => {
  const { bookingId = '' } = useParams()
  const read = useQuery({
    queryKey: visitToReviewKey(bookingId),
    queryFn: () => readVisitToReview(bookingId),
    // A form opens with the visit as it is now, and then nothing is read
    // behind it: what somebody is writing is not taken away by an answer
    // nobody asked for
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const focusHeading = useScreenHeadingFocus()
  /** The API refused a review for a reason of the visit, and the visit is read again */
  const [refused, setRefused] = useState(false)
  // What the form was opened with a while ago is not what it opens with
  const visit = read.isFetchedAfterMount ? read.data : undefined
  const refusedAndGone = refused && visit?.type !== 'found'

  // The form went with the button that sent it: the focus goes to the
  // heading of the screen, in the commit that shows what took its place
  useLayoutEffect(() => {
    if (refusedAndGone) {
      focusHeading()
    }
  }, [refusedAndGone, focusHeading])

  return (
    <>
      <PageHeader title={TITLE} />
      {refusedAndGone && (
        <Alert tone='warning'>このレビューは、投稿できませんでした。</Alert>
      )}
      {match(visit)
        .with(undefined, () => (
          <LoadingIndicator label='来店の内容を読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ visit: found }) => (
          <Writing
            visit={found}
            onRefused={() => {
              setRefused(true)
              void read.refetch()
            }}
          />
        ))
        .with({ type: 'notVisited' }, () => (
          <EmptyState
            title='この予約は、まだ来店が済んでいません'
            description='レビューは、来店が済んだ予約について書けます。'
            action={
              <ButtonLink href={`/bookings/${bookingId}`}>
                予約の内容を見る
              </ButtonLink>
            }
          />
        ))
        .with({ type: 'reviewed' }, ({ review }) => (
          <EmptyState
            title='この来店のレビューは、投稿済みです'
            description='レビューは、来店 1 回につき 1 件です。投稿したレビューは、変更できます。'
            action={
              <ButtonLink href={`${OWN_REVIEWS}/${review.id}`}>
                レビューを変更する
              </ButtonLink>
            }
          />
        ))
        .with({ type: 'salonGone' }, () => (
          <EmptyState
            title='このサロンは、掲載を終えています'
            description='掲載を終えたサロンのレビューは、書けません。'
            action={TO_THE_VISITS}
          />
        ))
        .with({ type: 'notFound' }, () => (
          <EmptyState
            title='予約が見つかりません'
            description='アドレスが正しいか、お確かめください。ほかのアカウントで入れた予約のレビューは、書けません。'
            action={TO_THE_VISITS}
          />
        ))
        .with({ type: UNREAD }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('来店の内容', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}

/**
 * The form in which the customer who is signed in says how a visit was. A
 * visit is written about once, after it took place: for a booking that is
 * none, or that has its review, the screen says so and leads on.
 */
export const ReviewWriteScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='レビューを書くには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <VisitToReview />
  </RequireSession>
)
