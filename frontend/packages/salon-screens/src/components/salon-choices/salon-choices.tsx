import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  Badge,
  COUNTED,
  countOf,
  inJapanese,
  Link,
  type More,
} from '@beauty-salon-frontend/ui'
import { PagedTable } from '../paged-table/paged-table'

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
}: SalonChoicesProps) => (
  <PagedTable
    caption='サロン'
    columns={[
      {
        key: 'name',
        header: 'サロン',
        cell: (salon) => <Link href={salonHref(salon)}>{salon.name}</Link>,
      },
      { key: 'address', header: '所在地', cell: addressOf },
      {
        key: 'isActive',
        header: '予約の受付',
        cell: ({ isActive }) =>
          isActive ? (
            <Badge tone='success'>受付中</Badge>
          ) : (
            <Badge>停止中</Badge>
          ),
      },
    ]}
    rows={salons}
    rowKey={({ id }) => id}
    emptyMessage='サロンはありません'
    count={inJapanese(countOf(total, salons.length, COUNTED.items))}
    more={more}
    onMore={onMore}
  />
)
