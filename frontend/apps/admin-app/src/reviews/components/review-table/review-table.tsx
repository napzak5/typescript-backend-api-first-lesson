import type {
  ModelsReviewResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  COUNTED,
  countOf,
  Link,
  type More,
  NONE,
  Rating,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminReviewMessages,
  adminStaffMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { reviewDayNameOf, reviewNameOf } from '../../utils/review-format'

const { list, words } = adminReviewMessages

export type ReviewTableProps = {
  /** What the table lists, in the language of the page: 「レビュー」 or 「条件に合うレビュー」 */
  caption: string
  /** The reviews that were read so far, in the order of the list; at least one */
  reviews: readonly ModelsReviewResponse[]
  /** The time zone of the salon, which the days are said in */
  timezone: string
  /** The staff of the salon, who name the member a review rates; `undefined` while they are read */
  staff:
    | readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
    | undefined
  /** The screen of a review */
  reviewHref: (reviewId: string) => string
  /** How many reviews there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the reviews that come next */
  onMore: () => void
}

/** Who a review rates: a member by name, one the salon no longer shows, or nobody; nothing while the staff are read */
const staffNameOf = (
  staffId: string | null,
  staff: ReviewTableProps['staff'],
): LocalizedText | undefined => {
  if (staffId === null) {
    return words.noStaff
  }
  if (staff === undefined) {
    return undefined
  }
  const member = staff.find(({ id }) => id === staffId)

  return member === undefined
    ? adminStaffMessages.unlisted
    : adminStaffMessages.named(member.displayName)
}

/**
 * The reviews of a salon: what each is called, which leads to it, the day
 * it was written at the salon, its overall rating, its comment, the member
 * of the staff it rates, whether the salon answered it, and how many
 * reports of it wait for the platform.
 */
export const ReviewTable = ({
  caption,
  reviews,
  timezone,
  staff,
  reviewHref,
  total,
  more,
  onMore,
}: ReviewTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={caption}
      columns={[
        {
          key: 'title',
          header: say(words.review),
          cell: (review) => (
            <Link href={reviewHref(review.id)}>
              {say(reviewNameOf(review))}
            </Link>
          ),
        },
        {
          key: 'createdAt',
          header: say(list.postedOn),
          cell: ({ createdAt }) => say(reviewDayNameOf(createdAt, timezone)),
        },
        {
          key: 'overallRating',
          header: say(words.rating),
          cell: ({ overallRating }) => <Rating value={overallRating} />,
        },
        {
          key: 'comment',
          header: say(words.comment),
          wrap: 'lines',
          cell: ({ comment }) => comment,
        },
        {
          key: 'staffId',
          header: say(words.staff),
          cell: ({ staffId }) => {
            const name = staffNameOf(staffId, staff)

            return name === undefined ? '' : say(name)
          },
        },
        {
          key: 'ownerResponse',
          header: say(words.response),
          cell: ({ ownerResponse }) =>
            ownerResponse === null ? (
              <Badge tone='warning'>{say(list.unanswered)}</Badge>
            ) : (
              <Badge tone='success'>{say(list.answered)}</Badge>
            ),
        },
        {
          key: 'reportCount',
          header: say(list.reports),
          cell: ({ reportCount }) =>
            reportCount === 0 ? (
              say(NONE)
            ) : (
              <Badge tone='danger'>
                {say(list.pendingReportsOf(reportCount))}
              </Badge>
            ),
        },
      ]}
      rows={reviews}
      rowKey={({ id }) => id}
      emptyMessage={say(list.none)}
      count={say(countOf(total, reviews.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
