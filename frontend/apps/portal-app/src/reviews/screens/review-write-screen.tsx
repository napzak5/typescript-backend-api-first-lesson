import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  Card,
  DescriptionList,
  EmptyState,
  type FormSays,
  Link,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  portalBookingMessages,
  portalReviewMessages,
} from '@beauty-salon-shared/i18n/messages/portal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { whenLineOf } from '../../bookings/utils/booking-format'
import { listHrefOf } from '../../bookings/utils/own-bookings'
import { SignInHelp } from '../../session/screens/sign-in-help'
import { CUSTOMERS } from '../../session/utils/roles'
import {
  readVisitToReview,
  type Visit,
  visitToReviewKey,
  writeReview,
} from '../api/reviews-api'
import { ReviewForm } from '../components/review-form/review-form'
import { afterReviewWrite } from '../utils/review-cache'
import {
  afterReviewWriting,
  enteredForVisit,
  isOfTheVisit,
  readNewReview,
} from '../utils/review-flow'

const { write: words, own, change, names } = portalReviewMessages

/** Where what the customer wrote is listed, and where the form leads */
const OWN_REVIEWS = '/mypage/reviews'

const ToTheVisits = () => {
  const say = useSay()

  return (
    <ButtonLink href={listHrefOf('past')}>{say(own.toPastBookings)}</ButtonLink>
  )
}

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
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const writing = useMutation({
    mutationFn: writeReview,
    onSuccess: (outcome) => {
      if (outcome.type === 'written') {
        afterReviewWrite(queryClient, outcome.review, outcome.review)
        notify({ tone: 'success', message: words.posted })
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
      <Card title={say(words.visit)}>
        <DescriptionList
          items={[
            {
              term: say(words.salon),
              description: (
                <Link href={`/salons/${salon.id}`}>{salon.name}</Link>
              ),
            },
            {
              term: say(words.when),
              description: say(whenLineOf(booking, salon.timezone)),
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
        submitLabel={say(words.submit)}
        message={says.message}
        errors={says.errors}
        pending={writing.isPending}
        actions={
          <ButtonLink href={`/bookings/${booking.id}`} variant='quiet'>
            {say(portalBookingMessages.move.backToBooking)}
          </ButtonLink>
        }
        onSubmit={submit}
      />
    </>
  )
}

const VisitToReview = () => {
  const say = useSay()
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
      <PageHeader title={say(words.title)} />
      {refusedAndGone && <Alert tone='warning'>{say(words.refused)}</Alert>}
      {match(visit)
        .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
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
            title={say(words.notVisited)}
            description={say(words.notVisitedDescription)}
            actions={
              <ButtonLink href={`/bookings/${bookingId}`}>
                {say(words.toBooking)}
              </ButtonLink>
            }
          />
        ))
        .with({ type: 'reviewed' }, ({ review }) => (
          <EmptyState
            title={say(words.reviewed)}
            description={say(words.reviewedDescription)}
            actions={
              <ButtonLink href={`${OWN_REVIEWS}/${review.id}`}>
                {say(change.title)}
              </ButtonLink>
            }
          />
        ))
        .with({ type: 'salonGone' }, () => (
          <EmptyState
            title={say(words.salonGone)}
            description={say(words.salonGoneDescription)}
            actions={<ToTheVisits />}
          />
        ))
        .with({ type: 'notFound' }, () => (
          <EmptyState
            title={say(portalBookingMessages.detail.notFound)}
            description={say(words.notFoundDescription)}
            actions={<ToTheVisits />}
          />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.visit, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
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
export const ReviewWriteScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(words.signInNotice)}
      signInHelp={<SignInHelp />}
    >
      <VisitToReview />
    </RequireSession>
  )
}
