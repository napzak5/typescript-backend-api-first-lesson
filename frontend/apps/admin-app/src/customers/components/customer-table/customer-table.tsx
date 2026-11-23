import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { dayNameOf, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Checkbox,
  COUNTED,
  countOf,
  inJapanese,
  Link,
  type More,
} from '@beauty-salon-frontend/ui'
import { customerKanaOf, customerNameOf } from '../../api/customers-api'
import {
  countNameOf,
  customerStatusNameOf,
  customerStatusToneOf,
  tierNameOf,
} from '../../utils/customer-format'

export type CustomerTableProps = {
  /** What the table lists: 「顧客台帳」, or 「条件に合うお客様」 */
  caption: string
  /** The customers that were read so far, the latest registered first; at least one */
  rows: readonly ModelsCustomerResponse[]
  /** How many customers there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the customers that come next */
  onMore: () => void
  /** The address of the page of a customer */
  customerHref: (customer: ModelsCustomerResponse) => string
  /** The customers that can be chosen, to do one thing to all of them; none when it is not given */
  choice?: CustomerChoice | undefined
}

/** Which customers are chosen, and what is told when one is chosen or no longer */
type CustomerChoice = {
  chosen: ReadonlySet<string>
  onChoose: (customer: ModelsCustomerResponse, chosen: boolean) => void
}

/**
 * The ledger of the customers: each by name, which leads to the customer,
 * with the kana of the name, the phone number, the rank, the state, how
 * often they came and the last visit. With a choice, each row begins with
 * the checkbox that chooses the customer; the name still heads the row.
 */
export const CustomerTable = ({
  caption,
  rows,
  total,
  more,
  onMore,
  customerHref,
  choice,
}: CustomerTableProps) => (
  <PagedTable
    caption={caption}
    rowHeader='name'
    columns={[
      ...(choice === undefined
        ? []
        : [
            {
              key: 'chosen',
              header: '選ぶ',
              cell: (customer: ModelsCustomerResponse) => (
                <Checkbox
                  label={`${customerNameOf(customer)} 様を選ぶ`}
                  labelHidden
                  checked={choice.chosen.has(customer.id)}
                  onChange={(event) =>
                    choice.onChoose(customer, event.currentTarget.checked)
                  }
                />
              ),
            },
          ]),
      {
        key: 'name',
        header: 'お名前',
        cell: (customer) => (
          <Link href={customerHref(customer)}>{customerNameOf(customer)}</Link>
        ),
      },
      {
        key: 'kana',
        header: 'フリガナ',
        cell: (customer) => customerKanaOf(customer),
      },
      {
        key: 'phoneNumber',
        header: '電話番号',
        cell: ({ phoneNumber }) => phoneNumber,
      },
      {
        key: 'membershipTier',
        header: '会員ランク',
        cell: ({ membershipTier }) => tierNameOf(membershipTier),
      },
      {
        key: 'customerStatus',
        header: 'ステータス',
        cell: ({ customerStatus }) => (
          <Badge tone={customerStatusToneOf(customerStatus)}>
            {customerStatusNameOf(customerStatus)}
          </Badge>
        ),
      },
      {
        key: 'visitCount',
        header: '来店回数',
        align: 'end',
        cell: ({ visitCount }) => countNameOf(visitCount, '回'),
      },
      {
        key: 'lastVisitDate',
        header: '最終来店日',
        cell: ({ lastVisitDate }) =>
          lastVisitDate === null
            ? '来店なし'
            : inJapanese(dayNameOf(lastVisitDate)),
      },
    ]}
    rows={rows}
    rowKey={({ id }) => id}
    emptyMessage='お客様はいません'
    count={inJapanese(countOf(total, rows.length, COUNTED.people))}
    more={more}
    onMore={onMore}
  />
)
