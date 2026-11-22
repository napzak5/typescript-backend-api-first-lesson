import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsReviewResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  type FormSays,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { reviewHrefOf } from '../../navigation'
import {
  type ReviewRead,
  readReview,
  respondToReview,
  reviewKeyOf,
  reviewsKeyOf,
} from '../api/reviews-api'
import { ResponseForm } from '../components/response-form/response-form'
import {
  afterResponding,
  readResponse,
  speaksForTheSalon,
} from '../utils/review-actions'
import { ReviewNotFound } from './review-not-found'

const TITLE = 'レビューに返信する'

type ResponseEntryProps = {
  salon: ModelsSalonResponse
  review: ModelsReviewResponse
}

/**
 * The answer of the salon to a review, opened with the one the review
 * holds. The same answer again asks the API for nothing. After the answer
 * the screen goes back to the review, which shows it.
 */
const ResponseEntry = ({ salon, review }: ResponseEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const key = reviewKeyOf(review.id)
  const page = reviewHrefOf(salon.id, review.id)

  const respond = useMutation({
    mutationFn: (ownerResponse: string) =>
      respondToReview(review.id, ownerResponse),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'responded' }, ({ review: answered }) => {
          const read: ReviewRead = { type: 'found', review: answered }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: reviewsKeyOf(salon.id) })
          notify({
            tone: 'success',
            message:
              review.ownerResponse === null
                ? 'レビューに返信しました。'
                : '返信を直しました。',
          })
          void navigate(page)
        })
        // The review was removed meanwhile: it is read anew, and the
        // screen says it is gone
        .with({ type: 'notFound' }, () => {
          queryClient.removeQueries({ queryKey: reviewsKeyOf(salon.id) })
          void queryClient.invalidateQueries({ queryKey: key })
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterResponding(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readResponse(values, review.ownerResponse))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(page)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        respond.mutate(value)
      })
      .exhaustive()

  return (
    <ResponseForm
      review={review}
      timezone={salon.timezone}
      message={said.message}
      errors={said.errors}
      pending={respond.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={page} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type ResponsePartProps = { salon: ModelsSalonResponse; reviewId: string }

/**
 * The review of the address, read anew whenever the screen opens, so that
 * the answer the form starts with is the one the review holds now. It is
 * not read again when the window comes back: the form compares what is
 * sent with what it was opened with.
 */
const ResponsePart = ({ salon, reviewId }: ResponsePartProps) => {
  const read = useQuery({
    queryKey: reviewKeyOf(reviewId),
    queryFn: () => readReview(reviewId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const header = <PageHeader title={TITLE} description={salon.name} />

  return match(read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label='レビューを読み込んでいます' />
      </>
    ))
    .with({ type: 'notFound' }, () => <ReviewNotFound salonId={salon.id} />)
    .with(
      { type: 'found', review: P.when(({ salonId }) => salonId !== salon.id) },
      () => <ReviewNotFound salonId={salon.id} />,
    )
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={unreadMessageOf('レビュー', reason)}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .with({ type: 'found' }, ({ review }) => (
      <>
        {header}
        <ResponseEntry salon={salon} review={review} />
      </>
    ))
    .exhaustive()
}

type ResponseForbiddenProps = { salon: ModelsSalonResponse; reviewId: string }

/** What the screen says to an account whose role writes no answers: who does, and the way back to the review. */
const ResponseForbidden = ({ salon, reviewId }: ResponseForbiddenProps) => (
  <>
    <PageHeader title={TITLE} description={salon.name} />
    <p>
      このアカウントでは、レビューに返信できません。返信を書けるのは、サロンのオーナーとマネージャーです。
    </p>
    <ButtonLink href={reviewHrefOf(salon.id, reviewId)}>
      レビューへ戻る
    </ButtonLink>
  </>
)

/** The answer to a review of the salon of the address, for its owner and its managers. */
export const ReviewResponseScreen = () => {
  const { salonId = '', reviewId = '' } = useParams()
  const session = useSession()
  const speaks =
    session.type === 'signedIn' && speaksForTheSalon(session.user.role)

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        speaks ? (
          <ResponsePart key={reviewId} salon={salon} reviewId={reviewId} />
        ) : (
          <ResponseForbidden salon={salon} reviewId={reviewId} />
        )
      }
    </WithSalon>
  )
}
