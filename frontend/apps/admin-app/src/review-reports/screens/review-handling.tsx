import {
  cursorAfter,
  firstCursor,
  listingOf,
  NOT_FOUND,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsReviewReportResponse,
  ModelsReviewResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  EmptyState,
  LoadingIndicator,
  moreOf,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { match } from 'ts-pattern'
import { reviewsHrefOf } from '../../navigation'
import {
  type ReviewRead,
  removeReview,
  reviewKeyOf,
  reviewsKeyOf,
} from '../../reviews/api/reviews-api'
import { reviewNameOf } from '../../reviews/utils/review-format'
import {
  dismissReport,
  readReportPage,
  reviewReportsKeyOf,
} from '../api/review-reports-api'
import { ReportTable } from '../components/report-table/report-table'
import { ReviewRemoval } from '../components/review-removal/review-removal'
import { ReviewReports } from '../components/review-reports/review-reports'
import {
  afterDismissal,
  afterReviewRemoval,
  handlesReports,
} from '../utils/review-reports'

const { loading, names, ofReview } = adminReviewReportMessages

/** Whether the signed-in account handles the reports of reviews: an administrator. */
export const useHandlesReports = (): boolean => {
  const session = useSession()
  return session.type === 'signedIn' && handlesReports(session.user.role)
}

type HandlingProps = {
  salon: ModelsSalonResponse
  review: ModelsReviewResponse
}

/**
 * The reports of a review, for an administrator, read whenever the screen
 * opens: customers and salons report a review at any time. After a
 * dismissal, or a refusal of one, the reports, the review that counts
 * those that wait, and the lists that show that count are read anew, and
 * the focus goes to the heading of the reports, where the button that was
 * pressed was.
 */
export const ReportsOfReview = ({ salon, review }: HandlingProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [asking, setAsking] = useState<ModelsReviewReportResponse>()
  const [message, setMessage] = useState<LocalizedText>()
  const [refusal, setRefusal] = useState<LocalizedText>()
  const heading = useRef<HTMLHeadingElement>(null)
  /** Whether the focus goes to the heading once the reports are read anew */
  const toHeading = useRef(false)
  const read = useInfiniteQuery({
    queryKey: [...reviewReportsKeyOf(salon.id), 'review', review.id],
    queryFn: ({ pageParam }) =>
      readReportPage(salon.id, { reviewId: review.id }, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    staleTime: 0,
  })

  useLayoutEffect(() => {
    if (toHeading.current && read.dataUpdatedAt > 0) {
      toHeading.current = false
      heading.current?.focus()
    }
  }, [read.dataUpdatedAt])

  /** What a dismissal changes is read anew; the lists of the salon are dropped, and read when they are shown */
  const readAnew = (): void => {
    queryClient.removeQueries({
      queryKey: [...reviewReportsKeyOf(salon.id), 'list'],
    })
    queryClient.removeQueries({ queryKey: reviewsKeyOf(salon.id) })
    void queryClient.invalidateQueries({ queryKey: reviewKeyOf(review.id) })
    void queryClient.invalidateQueries({
      queryKey: [...reviewReportsKeyOf(salon.id), 'review', review.id],
    })
  }

  const dismissal = useMutation({
    mutationFn: (reportId: string) => dismissReport(reportId),
    onSuccess: (outcome) =>
      match(afterDismissal(outcome))
        .with({ type: 'done' }, ({ message: done }) => {
          setAsking(undefined)
          toHeading.current = true
          readAnew()
          notify({ tone: 'success', message: done })
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setAsking(undefined)
          setRefusal(refused)
          toHeading.current = true
          readAnew()
        })
        // The review read anew says that it is gone
        .with({ type: 'gone' }, () => {
          setAsking(undefined)
          readAnew()
        })
        .exhaustive(),
  })

  return (
    <ReviewReports
      headingRef={heading}
      refusal={refusal}
      asking={asking}
      timezone={salon.timezone}
      pending={dismissal.isPending}
      message={message}
      onClose={() => setAsking(undefined)}
      onDismiss={(report) => {
        setMessage(undefined)
        dismissal.mutate(report.id)
      }}
    >
      {match(read.data === undefined ? undefined : listingOf(read.data.pages))
        .with(undefined, () => <LoadingIndicator label={say(loading)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.reports, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState kind='part' title={say(ofReview.none)} />
        ))
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <ReportTable
            caption={say(ofReview.caption)}
            reports={items}
            timezone={salon.timezone}
            onDismiss={(report) => {
              setMessage(undefined)
              setRefusal(undefined)
              setAsking(report)
            }}
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
    </ReviewReports>
  )
}

/**
 * The removal of a review, for an administrator. The review removed is
 * put as not found, the lists of the reviews and of the reports of the
 * salon are dropped, and the screen goes to the reviews of the salon.
 */
export const RemovalOfReview = ({ salon, review }: HandlingProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState<LocalizedText>()
  const [refusal, setRefusal] = useState<LocalizedText>()
  const key = reviewKeyOf(review.id)

  const forget = (): void => {
    queryClient.removeQueries({ queryKey: reviewsKeyOf(salon.id) })
    queryClient.removeQueries({ queryKey: reviewReportsKeyOf(salon.id) })
  }

  const removal = useMutation({
    mutationFn: () => removeReview(review.id),
    onSuccess: (outcome) =>
      match(afterReviewRemoval(outcome))
        .with({ type: 'done' }, ({ message: done }) => {
          const gone: ReviewRead = NOT_FOUND
          forget()
          queryClient.setQueryData(key, gone)
          notify({ tone: 'success', message: done })
          void navigate(reviewsHrefOf(salon.id))
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setAsking(false)
          setRefusal(refused)
        })
        // The review read anew says that it is gone
        .with({ type: 'gone' }, () => {
          setAsking(false)
          forget()
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .exhaustive(),
  })

  return (
    <ReviewRemoval
      name={reviewNameOf(review)}
      refusal={refusal}
      asking={asking}
      pending={removal.isPending}
      message={message}
      onAsk={() => {
        setMessage(undefined)
        setRefusal(undefined)
        setAsking(true)
      }}
      onClose={() => setAsking(false)}
      onRemove={() => {
        setMessage(undefined)
        removal.mutate()
      }}
    />
  )
}
