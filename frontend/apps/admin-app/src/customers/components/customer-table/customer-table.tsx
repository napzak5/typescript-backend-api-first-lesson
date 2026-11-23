import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { dayNameOf, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Checkbox,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { customerKanaOf, customerNameOf } from '../../api/customers-api'
import {
  customerStatusNameOf,
  customerStatusToneOf,
  tierNameOf,
} from '../../utils/customer-format'

const { record, table } = adminCustomerMessages

export type CustomerTableProps = {
  /** What the table lists: 「顧客台帳」, or 「条件に合うお客様」 */
  caption: LocalizedText
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
}: CustomerTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(caption)}
      rowHeader='name'
      columns={[
        ...(choice === undefined
          ? []
          : [
              {
                key: 'chosen',
                header: say(table.choose),
                cell: (customer: ModelsCustomerResponse) => (
                  <Checkbox
                    label={say(table.chooseCustomer(customerNameOf(customer)))}
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
          header: say(table.name),
          cell: (customer) => (
            <Link href={customerHref(customer)}>
              {customerNameOf(customer)}
            </Link>
          ),
        },
        {
          key: 'kana',
          header: say(table.kana),
          cell: (customer) => customerKanaOf(customer),
        },
        {
          key: 'phoneNumber',
          header: say(table.phoneNumber),
          cell: ({ phoneNumber }) => phoneNumber,
        },
        {
          key: 'membershipTier',
          header: say(table.tier),
          cell: ({ membershipTier }) => say(tierNameOf(membershipTier)),
        },
        {
          key: 'customerStatus',
          header: say(table.status),
          cell: ({ customerStatus }) => (
            <Badge tone={customerStatusToneOf(customerStatus)}>
              {say(customerStatusNameOf(customerStatus))}
            </Badge>
          ),
        },
        {
          key: 'visitCount',
          header: say(table.visits),
          align: 'end',
          cell: ({ visitCount }) => say(record.visits.visitsOf(visitCount)),
        },
        {
          key: 'lastVisitDate',
          header: say(table.lastVisit),
          cell: ({ lastVisitDate }) =>
            say(
              lastVisitDate === null ? table.noVisit : dayNameOf(lastVisitDate),
            ),
        },
      ]}
      rows={rows}
      rowKey={({ id }) => id}
      emptyMessage={say(table.empty)}
      count={say(countOf(total, rows.length, COUNTED.people))}
      more={more}
      onMore={onMore}
    />
  )
}
