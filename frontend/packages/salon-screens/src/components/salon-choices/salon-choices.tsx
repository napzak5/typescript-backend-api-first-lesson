import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  Badge,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import { salonScreenMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { PagedTable } from '../paged-table/paged-table'

const { salonChoices: words } = salonScreenMessages

export type SalonChoicesProps = {
  /** The salons that were read so far, in the order of the API; at least one */
  salons: readonly ModelsSalonResponse[]
  /** How many salons there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the salons that come next */
  onMore: () => void
  /** Where choosing a salon leads */
  salonHref: (salon: ModelsSalonResponse) => string
}

/** Where a salon is, in one line: the parts of the address as the salon wrote them, as the portal shows them. */
const addressOf = ({
  prefecture,
  city,
  address,
  building,
}: Pick<
  ModelsSalonResponse,
  'prefecture' | 'city' | 'address' | 'building'
>): string =>
  [prefecture, city, address, building]
    .filter((part) => part !== null)
    .join(' ')

/**
 * The salons to choose from. The name of a salon leads to what it is chosen
 * for; a salon that takes no bookings now is among them and says so.
 */
export const SalonChoices = ({
  salons,
  total,
  more,
  onMore,
  salonHref,
}: SalonChoicesProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(words.caption)}
      columns={[
        {
          key: 'name',
          header: say(words.salon),
          cell: (salon) => <Link href={salonHref(salon)}>{salon.name}</Link>,
        },
        { key: 'address', header: say(words.address), cell: addressOf },
        {
          key: 'isActive',
          header: say(words.bookings),
          cell: ({ isActive }) =>
            isActive ? (
              <Badge tone='success'>{say(words.accepting)}</Badge>
            ) : (
              <Badge>{say(words.paused)}</Badge>
            ),
        },
      ]}
      rows={salons}
      rowKey={({ id }) => id}
      emptyMessage={say(words.none)}
      count={say(countOf(total, salons.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
