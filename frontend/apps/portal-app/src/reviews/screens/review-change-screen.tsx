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
  inJapanese,
  Link,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useScreenHeadingFocus,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
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
import { NO_SALON, timezoneOf } from '../utils/review-format'

const TITLE = 'レビューを変更する'

/** Where what the customer wrote is listed, and where the form leads */
const OWN_REVIEWS = '/mypage/reviews'

const BACK = (
  <ButtonLink href={OWN_REVIEWS} variant='quiet'>
    自分のレビューへ戻る
  </ButtonLink>
)

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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const change = useMutation({
    mutationFn: (request: ModelsReviewUpdateRequest) =>
      changeReview(review.id, request),
    onSuccess: (outcome) => {
      if (outcome.type === 'changed') {
        afterReviewWrite(queryClient, outcome.review, outcome.review)
        notify({ tone: 'success', message: 'レビューを変更しました。' })
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
      <Card title='変更するレビュー'>
        <DescriptionList
          items={[
            {
              term: 'サロン',
              description:
                salon === null ? (
                  NO_SALON
                ) : (
                  <Link href={`/salons/${salon.id}`}>{salon.name}</Link>
                ),
            },
            {
              term: '投稿日',
              description: inJapanese(
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
        submitLabel='変更を保存する'
        message={says.message}
        errors={says.errors}
        pending={change.isPending}
        actions={BACK}
        onSubmit={submit}
      />
    </>
  )
}

const ReviewToChange = () => {
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
      <PageHeader title={TITLE} />
      {/* What the form was opened with a while ago is not what it opens with */}
      {match(read.isFetchedAfterMount ? read.data : undefined)
        .with(undefined, () => (
          <LoadingIndicator label='レビューを読み込んでいます' />
        ))
        .with({ type: 'found' }, (own) => (
          <Change own={own} onGone={() => setGone(true)} />
        ))
        .with({ type: 'notFound' }, () => (
          <>
            {gone && (
              <Alert tone='warning'>
                このレビューは、すでに削除されていたため、変更を保存できませんでした。
              </Alert>
            )}
            <EmptyState
              title='レビューが見つかりません'
              description='アドレスが正しいか、お確かめください。ほかのアカウントで書いたレビューは、変更できません。'
              actions={
                <ButtonLink href={OWN_REVIEWS}>自分のレビューを見る</ButtonLink>
              }
            />
          </>
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={inJapanese(
              unreadMessageOf(writtenInJapanese('レビュー'), reason),
            )}
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
export const ReviewChangeScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='レビューを変更するには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <ReviewToChange />
  </RequireSession>
)
