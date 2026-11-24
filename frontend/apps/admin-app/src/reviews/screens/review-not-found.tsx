import { ButtonLink, PageHeader, useSay } from '@beauty-salon-frontend/ui'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { reviewsHrefOf } from '../../navigation'

const { notFound, words } = adminReviewMessages

/** The way back to the reviews of the salon */
export const ToTheReviews = ({ salonId }: { salonId: string }) => {
  const say = useSay()

  return (
    <ButtonLink href={reviewsHrefOf(salonId)}>
      {say(words.toReviews)}
    </ButtonLink>
  )
}

/** What a screen of a review says when there is none to show: none at the address, one removed, or one of another salon. */
export const ReviewNotFound = ({ salonId }: { salonId: string }) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ToTheReviews salonId={salonId} />
    </>
  )
}
