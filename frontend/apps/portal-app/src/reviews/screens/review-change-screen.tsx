import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsReviewUpdateRequest } from '@beauty-salon-frontend/api-client'
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
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  portalFrameMessages,
  portalProfileMessages,
  portalReviewMessages,
} from '@beauty-salon-shared/i18n/messages/portal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { dayOf } from '../../salons/utils/salon-format'
import { SignInHelp } from '../../session/screens/sign-in-help'
import { CUSTOMERS } from '../../session/utils/roles'
import {
  changeReview,
  type OwnReview,
  type ReviewToChangeRead,
  readOwnReviewToChange,
  reviewToChangeKey,
} from '../api/reviews-api'
import { ReviewForm } from '../components/review-form/review-form'
import { afterReviewWrite } from '../utils/review-cache'
import {
  afterReviewChange,
  enteredOf,
  readReviewChange,
} from '../utils/review-flow'
import { timezoneOf } from '../utils/review-format'

const { change: words, write, names, noSalon } = portalReviewMessages

/** Where what the customer wrote is listed, and where the form leads */
const OWN_REVIEWS = '/mypage/reviews'

const Back = () => {
  const say = useSay()

  return (
    <ButtonLink href={OWN_REVIEWS} variant='quiet'>
      {say(words.back)}
    </ButtonLink>
  )
}

const NOT_FOUND: ReviewToChangeRead = { type: 'notFound' }

type ChangeProps = {
  own: OwnReview
  /** The review was gone when the change was sent */
  onGone: () => void
}

/**
 * What the review is of, and below it the form. What the form is sent
 * with is compared with the review it opened with, and what differs is
 * sent, nothing else. Which visit a review is of, and whom it rates, is
 * not changed: the form says so where it would ask.
 */
const Change = ({ own, onGone }: ChangeProps) => {
  const { review, salon, staffName } = own
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const change = useMutation({
    mutationFn: (request: ModelsReviewUpdateRequest) =>
      changeReview(review.id, request),
    onSuccess: (outcome) => {
      if (outcome.type === 'changed') {
        afterReviewWrite(queryClient, outcome.review, outcome.review)
        notify({ tone: 'success', message: words.changed })
        void navigate(OWN_REVIEWS)
        return
      }
      if (outcome.type === 'gone') {
        queryClient.setQueryData(reviewToChangeKey(review.id), NOT_FOUND)
        afterReviewWrite(queryClient, review, null)
        onGone()
        return
      }
      setSays(afterReviewChange(outcome))
    },
  })

  const submit = (values: FormData): void => {
    match(readReviewChange(values, review))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSays({ message: undefined, errors }),
      )
      // Nothing was changed, so there is nothing to ask the API for: the
      // customer is told so where the reviews are listed
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(OWN_REVIEWS)
      })
      .with({ type: 'valid' }, ({ value }) => change.mutate(value))
      .exhaustive()
  }

  return (
    <>
      <Card title={say(words.reviewed)}>
        <DescriptionList
          items={[
            {
              term: say(write.salon),
              description:
                salon === null ? (
                  say(noSalon)
                ) : (
                  <Link href={`/salons/${salon.id}`}>{salon.name}</Link>
                ),
            },
            {
              term: say(words.postedOn),
              description: say(
                dayOf(
                  review.createdAt,
                  timezoneOf(
                    own,
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                  ),
                ),
              ),
            },
          ]}
        />
      </Card>
      <ReviewForm
        entered={enteredOf(review)}
        staff={
          review.staffId === null
            ? { type: 'nobody' }
            : { type: 'fixed', name: staffName }
        }
        submitLabel={say(portalFrameMessages.saveChanges)}
        message={says.message}
        errors={says.errors}
        pending={change.isPending}
        actions={<Back />}
        onSubmit={submit}
      />
    </>
  )
}

const ReviewToChange = () => {
  const say = useSay()
  const { reviewId = '' } = useParams()
  const read = useQuery({
    queryKey: reviewToChangeKey(reviewId),
    queryFn: () => readOwnReviewToChange(reviewId),
    // A form opens with the review as it is now, and then nothing is read
    // behind it: what somebody is writing is not taken away by an answer
    // nobody asked for
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const focusHeading = useScreenHeadingFocus()
  /** The review was gone when the customer sent a change */
  const [gone, setGone] = useState(false)

  // The form went with the button that sent it: the focus goes to the
  // heading of the screen, in the commit that shows what took its place
  useLayoutEffect(() => {
    if (gone) {
      focusHeading()
    }
  }, [gone, focusHeading])

  return (
    <>
      <PageHeader title={say(words.title)} />
      {/* What the form was opened with a while ago is not what it opens with */}
      {match(read.isFetchedAfterMount ? read.data : undefined)
        .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
        .with({ type: 'found' }, (own) => (
          <Change own={own} onGone={() => setGone(true)} />
        ))
        .with({ type: 'notFound' }, () => (
          <>
            {gone && <Alert tone='warning'>{say(words.gone)}</Alert>}
            <EmptyState
              title={say(words.notFound)}
              description={say(words.notFoundDescription)}
              actions={
                <ButtonLink href={OWN_REVIEWS}>
                  {say(portalProfileMessages.myPage.toReviews)}
                </ButtonLink>
              }
            />
          </>
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.review, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}

/**
 * The form in which the customer who is signed in changes what they wrote
 * about a visit: the ratings, the words and the pictures.
 */
export const ReviewChangeScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(words.signInNotice)}
      signInHelp={<SignInHelp />}
    >
      <ReviewToChange />
    </RequireSession>
  )
}
