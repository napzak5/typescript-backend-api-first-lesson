import { ButtonLink, PageHeader } from '@beauty-salon-frontend/ui'
import { reviewsHrefOf } from '../navigation'

/** The way back to the reviews of the salon */
export const ToTheReviews = ({ salonId }: { salonId: string }) => (
  <p>
    <ButtonLink href={reviewsHrefOf(salonId)}>レビューへ</ButtonLink>
  </p>
)

/** What a screen of a review says when there is none to show: none at the address, one removed, or one of another salon. */
export const ReviewNotFound = ({ salonId }: { salonId: string }) => (
  <>
    <PageHeader
      title='レビューが見つかりません'
      description='アドレスが正しいか、お確かめください。お客様が削除したレビューと、運営が削除したレビューは、表示できません。'
    />
    <ToTheReviews salonId={salonId} />
  </>
)
