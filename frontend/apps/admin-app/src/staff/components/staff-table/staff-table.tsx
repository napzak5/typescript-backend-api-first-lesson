import type { ModelsStaffResponse } from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  activityNameOf,
  bookingsNameOf,
  fullStaffNameOf,
  levelNameOf,
} from '../../utils/staff-format'

const { ledger, titles, words } = adminStaffMessages

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
}: StaffTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(titles.ledger)}
      columns={[
        {
          key: 'displayName',
          header: say(words.displayName),
          cell: (member) => (
            <Link href={memberHref(member.id)}>{member.displayName}</Link>
          ),
        },
        {
          key: 'name',
          header: say(words.fullName),
          cell: (member) => say(fullStaffNameOf(member)),
        },
        {
          key: 'level',
          header: say(words.level),
          cell: ({ level }) => say(levelNameOf(level)),
        },
        {
          key: 'position',
          header: say(words.position),
          cell: ({ position }) => position,
        },
        {
          key: 'canReceiveBookings',
          header: say(words.bookings),
          cell: (member) => say(bookingsNameOf(member)),
        },
        {
          key: 'isActive',
          header: say(words.status),
          cell: (member) => say(activityNameOf(member)),
        },
      ]}
      rows={rows}
      rowKey={({ id }) => id}
      emptyMessage={say(ledger.none)}
      count={say(countOf(total, rows.length, COUNTED.people))}
      more={more}
      onMore={onMore}
    />
  )
}
