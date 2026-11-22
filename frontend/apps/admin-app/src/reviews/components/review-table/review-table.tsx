import type {
  ModelsReviewResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  countOf,
  Link,
  type More,
  Rating,
} from '@beauty-salon-frontend/ui'
import { reviewDayNameOf, reviewNameOf } from '../../review-format'

export type ReviewTableProps = {
  /** What the table lists: 「レビュー」 or 「条件に合うレビュー」 */
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

/** Who a review rates: a member by name, one the salon no longer shows, or nobody */
const staffNameOf = (
  staffId: string | null,
  staff: ReviewTableProps['staff'],
): string => {
  if (staffId === null) {
    return '指名なし'
  }
  if (staff === undefined) {
    return ''
  }

  return (
    staff.find(({ id }) => id === staffId)?.displayName ?? '一覧にないスタッフ'
  )
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
}: ReviewTableProps) => (
  <PagedTable
    caption={caption}
    columns={[
      {
        key: 'title',
        header: 'レビュー',
        cell: (review) => (
          <Link href={reviewHref(review.id)}>{reviewNameOf(review)}</Link>
        ),
      },
      {
        key: 'createdAt',
        header: '投稿日',
        cell: ({ createdAt }) => reviewDayNameOf(createdAt, timezone),
      },
      {
        key: 'overallRating',
        header: '評価',
        cell: ({ overallRating }) => <Rating value={overallRating} />,
      },
      {
        key: 'comment',
        header: 'コメント',
        wrap: 'lines',
        cell: ({ comment }) => comment,
      },
      {
        key: 'staffId',
        header: '担当スタッフ',
        cell: ({ staffId }) => staffNameOf(staffId, staff),
      },
      {
        key: 'ownerResponse',
        header: '返信',
        cell: ({ ownerResponse }) =>
          ownerResponse === null ? (
            <Badge tone='warning'>未返信</Badge>
          ) : (
            <Badge tone='success'>返信済み</Badge>
          ),
      },
      {
        key: 'reportCount',
        header: '通報',
        cell: ({ reportCount }) =>
          reportCount === 0 ? (
            'なし'
          ) : (
            <Badge tone='danger'>{`未処理 ${reportCount} 件`}</Badge>
          ),
      },
    ]}
    rows={reviews}
    rowKey={({ id }) => id}
    emptyMessage='レビューはありません'
    count={countOf(total, reviews.length, '件')}
    more={more}
    onMore={onMore}
  />
)
