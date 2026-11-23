import type { ModelsStaffResponse } from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  COUNTED,
  countOf,
  inJapanese,
  Link,
  type More,
} from '@beauty-salon-frontend/ui'
import {
  activityNameOf,
  bookingsNameOf,
  fullStaffNameOf,
  levelNameOf,
} from '../../utils/staff-format'

export type StaffTableProps = {
  /** The members that were read so far, in the order they were registered in; at least one */
  rows: readonly ModelsStaffResponse[]
  /** How many members there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the members that come next */
  onMore: () => void
  /** The address of a member */
  memberHref: (staffId: string) => string
}

/**
 * The members of the staff ledger: each by the name the customers see,
 * which leads to the member, with the name the ledger keeps, the level,
 * the position, whether they take bookings and whether they are active.
 */
export const StaffTable = ({
  rows,
  total,
  more,
  onMore,
  memberHref,
}: StaffTableProps) => (
  <PagedTable
    caption='スタッフ'
    columns={[
      {
        key: 'displayName',
        header: '表示名',
        cell: (member) => (
          <Link href={memberHref(member.id)}>{member.displayName}</Link>
        ),
      },
      {
        key: 'name',
        header: '氏名',
        cell: (member) => fullStaffNameOf(member),
      },
      {
        key: 'level',
        header: 'レベル',
        cell: ({ level }) => levelNameOf(level),
      },
      {
        key: 'position',
        header: '役職',
        cell: ({ position }) => position,
      },
      {
        key: 'canReceiveBookings',
        header: '予約',
        cell: (member) => bookingsNameOf(member),
      },
      {
        key: 'isActive',
        header: '状態',
        cell: (member) => activityNameOf(member),
      },
    ]}
    rows={rows}
    rowKey={({ id }) => id}
    emptyMessage='スタッフはいません'
    count={inJapanese(countOf(total, rows.length, COUNTED.people))}
    more={more}
    onMore={onMore}
  />
)
