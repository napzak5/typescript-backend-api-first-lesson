import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { Link } from '@beauty-salon-frontend/ui'
import {
  countOf,
  PagedTable,
} from '../../../components/paged-table/paged-table'
import type { More } from '../../../pages'
import { customerKanaOf, customerNameOf } from '../../customers-api'

export type CustomerChoicesProps = {
  /** The customers that were read so far, in the order of the API; at least one */
  customers: readonly ModelsCustomerResponse[]
  /** How many customers have the keyword; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the customers that come next */
  onMore: () => void
  /** Where choosing a customer leads */
  customerHref: (customer: ModelsCustomerResponse) => string
}

/**
 * The customers that were found, to choose the one a booking is for. The
 * name leads on; the kana, the phone number and the address of mail tell
 * two customers of one name apart.
 */
export const CustomerChoices = ({
  customers,
  total,
  more,
  onMore,
  customerHref,
}: CustomerChoicesProps) => (
  <PagedTable
    caption='見つかったお客様'
    columns={[
      {
        key: 'name',
        header: 'お名前',
        cell: (customer) => (
          <Link href={customerHref(customer)}>{customerNameOf(customer)}</Link>
        ),
      },
      { key: 'kana', header: 'フリガナ', cell: customerKanaOf },
      {
        key: 'phoneNumber',
        header: '電話番号',
        cell: ({ phoneNumber }) => phoneNumber,
      },
      { key: 'email', header: 'メールアドレス', cell: ({ email }) => email },
    ]}
    rows={customers}
    rowKey={({ id }) => id}
    emptyMessage='お客様はいません'
    count={countOf(total, customers.length, '人')}
    more={more}
    onMore={onMore}
  />
)
