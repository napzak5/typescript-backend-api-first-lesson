import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsReviewReportRequest,
  ModelsReviewResponse,
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  customerKeyOf,
  customerNameOf,
  readCustomer,
} from '../customers/customers-api'
import {
  bookingHrefOf,
  customerHrefOf,
  reviewResponseHrefOf,
} from '../navigation'
import {
  RemovalOfReview,
  ReportsOfReview,
  useHandlesReports,
} from '../review-reports/review-handling'
import { readStaffProfiles, staffProfilesKeyOf } from '../salons/salons-api'
import { ReviewAnswer } from './components/review-answer/review-answer'
import {
  type ReviewAuthor,
  ReviewRecord,
} from './components/review-record/review-record'
import { ReviewReport } from './components/review-report/review-report'
import {
  afterReporting,
  afterWithdrawing,
  readReport,
  reviewActionNoteOf,
  speaksForTheSalon,
  withdrawsAnswers,
} from './review-actions'
import { reviewNameOf } from './review-format'
import { ReviewNotFound, ToTheReviews } from './review-not-found'
import {
  type ReviewRead,
  readReview,
  reportReview,
  respondToReview,
  reviewKeyOf,
  reviewsKeyOf,
} from './reviews-api'

const TITLE = 'レビュー'

/** Who wrote a review, as the ledger answered */
const useAuthor = (salonId: string, customerId: string): ReviewAuthor => {
  const read = useQuery({
    queryKey: customerKeyOf(customerId),
    queryFn: () => readCustomer(customerId),
  })

  return match(read.data)
    .returnType<ReviewAuthor>()
    .with(undefined, () => ({ type: 'reading' }))
    .with({ type: 'found' }, ({ customer }) => ({
      type: 'found',
      name: customerNameOf(customer),
      href: customerHrefOf(salonId, customer.id),
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: P.union(...UNREAD_TYPES) }, () => ({
      type: 'unread',
    }))
    .exhaustive()
}

/** The dialog that is open: none, the withdrawal of the answer, or the report */
type Asking = 'none' | 'withdrawal' | 'report'

type ReviewDetailsProps = {
  salon: ModelsSalonResponse
  review: ModelsReviewResponse
  /** The staff of the salon, who name the member the review rates; `undefined` while they are read */
  staff: readonly ModelsStaffProfileResponse[] | undefined
}

/**
 * A review, what the salon answered, and what the account may do: the
 * owner and a manager write the answer on a screen of their own and
 * report the review; the owner, a manager and an administrator withdraw
 * the answer. After the withdrawal, the review the API answered with is
 * shown and the focus goes to the heading of the answer. After a report,
 * the review is read anew: it counts the report.
 */
const ReviewDetails = ({ salon, review, staff }: ReviewDetailsProps) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const session = useSession()
  const role = session.type === 'signedIn' ? session.user.role : ''
  const speaks = speaksForTheSalon(role)
  const author = useAuthor(salon.id, review.customerId)
  const [asking, setAsking] = useState<Asking>('none')
  const [message, setMessage] = useState<string>()
  const [reportErrors, setReportErrors] = useState<FormErrors>({})
  const [reportedBefore, setReportedBefore] = useState(false)
  const answerHeading = useRef<HTMLHeadingElement>(null)
  /**
   * The answer as the screen showed it when it was withdrawn: the focus
   * goes to the heading of the answer in the commit that shows it gone
   */
  const withdrawnFrom = useRef<string | null>(undefined)
  const key = reviewKeyOf(review.id)

  useLayoutEffect(() => {
    if (
      withdrawnFrom.current !== undefined &&
      withdrawnFrom.current !== review.ownerResponse
    ) {
      withdrawnFrom.current = undefined
      answerHeading.current?.focus()
    }
  }, [review.ownerResponse])

  /** The lists and the summary that were read are dropped: the review shows otherwise in them */
  const forgetLists = (): void =>
    queryClient.removeQueries({ queryKey: reviewsKeyOf(salon.id) })

  /** The review was removed meanwhile: it is read anew, and the screen says it is gone */
  const gone = (): void => {
    setAsking('none')
    forgetLists()
    void queryClient.invalidateQueries({ queryKey: key })
  }

  const withdrawal = useMutation({
    mutationFn: () => respondToReview(review.id, null),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'responded' }, ({ review: withdrawn }) => {
          const read: ReviewRead = { type: 'found', review: withdrawn }
          withdrawnFrom.current = review.ownerResponse
          setAsking('none')
          queryClient.setQueryData(key, read)
          forgetLists()
          notify({ tone: 'success', message: '返信を取り下げました。' })
        })
        .with({ type: 'notFound' }, gone)
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setMessage(afterWithdrawing(refused)),
        )
        .exhaustive(),
  })

  const report = useMutation({
    mutationFn: (request: ModelsReviewReportRequest) =>
      reportReview(review.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'reported' }, () => {
          setAsking('none')
          forgetLists()
          void queryClient.invalidateQueries({ queryKey: key })
          notify({
            tone: 'success',
            message: '通報しました。運営が内容を確かめます。',
          })
        })
        .with({ type: 'reportedAlready' }, () => setReportedBefore(true))
        .with({ type: 'notFound' }, gone)
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => {
            const said = afterReporting(refused)
            setMessage(said.message)
            setReportErrors(said.errors)
          },
        )
        .exhaustive(),
  })

  /** Opens a dialog: what was said about an attempt before is said no longer */
  const ask = (dialog: Exclude<Asking, 'none'>): void => {
    setMessage(undefined)
    setReportErrors({})
    setReportedBefore(false)
    setAsking(dialog)
  }

  const send = (values: FormData): void =>
    match(readReport(values))
      .with({ type: 'invalid' }, ({ errors }) => {
        setMessage(undefined)
        setReportErrors(errors)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setMessage(undefined)
        setReportErrors({})
        report.mutate(value)
      })
      .exhaustive()

  return (
    <>
      <ReviewRecord
        review={review}
        timezone={salon.timezone}
        author={author}
        staffName={
          review.staffId === null
            ? undefined
            : staff?.find(({ id }) => id === review.staffId)?.displayName
        }
        bookingHref={bookingHrefOf(salon.id, review.bookingId)}
      />
      <ReviewAnswer
        review={review}
        timezone={salon.timezone}
        responseHref={
          speaks ? reviewResponseHrefOf(salon.id, review.id) : undefined
        }
        withdraws={withdrawsAnswers(role)}
        note={reviewActionNoteOf(role)}
        headingRef={answerHeading}
        pending={withdrawal.isPending}
        asking={asking === 'withdrawal'}
        message={asking === 'withdrawal' ? message : undefined}
        onAsk={() => ask('withdrawal')}
        onClose={() => setAsking('none')}
        onWithdraw={() => {
          setMessage(undefined)
          withdrawal.mutate()
        }}
      />
      {speaks && (
        <ReviewReport
          pending={report.isPending}
          asking={asking === 'report'}
          reportedBefore={reportedBefore}
          message={asking === 'report' ? message : undefined}
          errors={reportErrors}
          onAsk={() => ask('report')}
          onClose={() => setAsking('none')}
          onReport={send}
        />
      )}
    </>
  )
}

type ReviewPartProps = {
  salon: ModelsSalonResponse
  reviewId: string
}

/**
 * A review of the salon, read whenever the screen opens: its customer
 * changes it, and others report it, at any time. A review of another
 * salon is not found at the address of this one.
 *
 * The heading stays the one element while the screen reads what it shows
 * below it, so that the focus the heading took when the screen opened
 * stays on it. An administrator also handles the reports of the review
 * there: dismisses them, or removes the review.
 */
const ReviewPart = ({ salon, reviewId }: ReviewPartProps) => {
  const handles = useHandlesReports()
  const read = useQuery({
    queryKey: reviewKeyOf(reviewId),
    queryFn: () => readReview(reviewId),
    staleTime: 0,
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })

  return (
    match(read.data)
      .with(undefined, () => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <LoadingIndicator label='レビューを読み込んでいます' />
        </>
      ))
      .with({ type: 'notFound' }, () => <ReviewNotFound salonId={salon.id} />)
      // A review of another salon. The salon is compared by a predicate: as
      // a pattern, a string that is no literal would rule out every review
      .with(
        {
          type: 'found',
          review: P.when(({ salonId }) => salonId !== salon.id),
        },
        () => <ReviewNotFound salonId={salon.id} />,
      )
      .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <UnreadNotice
            message={unreadMessageOf('レビュー', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        </>
      ))
      .with({ type: 'found' }, ({ review }) => (
        <>
          <PageHeader title={reviewNameOf(review)} description={salon.name} />
          <ReviewDetails
            salon={salon}
            review={review}
            staff={match(staff.data)
              .with({ type: 'found' }, ({ items }) => items)
              .otherwise(() => undefined)}
          />
          {handles && (
            <>
              <ReportsOfReview salon={salon} review={review} />
              <RemovalOfReview salon={salon} review={review} />
            </>
          )}
          <ToTheReviews salonId={salon.id} />
        </>
      ))
      .exhaustive()
  )
}

/** A review of the salon of the address, for every member of its staff and an administrator. */
export const ReviewScreen = () => {
  const { salonId = '', reviewId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <ReviewPart key={reviewId} salon={salon} reviewId={reviewId} />
      )}
    </WithSalon>
  )
}
