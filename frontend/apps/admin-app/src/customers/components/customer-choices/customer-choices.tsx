import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { customerKanaOf, customerNameOf } from '../../api/customers-api'

const { choices: words } = adminCustomerMessages

/**
 * How a customer is chosen by their name: a link that leads on (to the
 * next step of a booking, to the merge with them), or a button that hands
 * the customer over (to a form that stays open). The customer the screen
 * is about is found too, and cannot be chosen: they are named as such.
 */
export type ChooseCustomer = (
  | { type: 'link'; hrefOf: (customer: ModelsCustomerResponse) => string }
  | { type: 'button'; onChoose: (customer: ModelsCustomerResponse) => void }
) & {
  /** The ID of the customer who cannot be chosen; `undefined` for none */
  excluded: string | undefined
}

export type CustomerChoicesProps = {
  /** The customers that were read so far, in the order of the API; at least one */
  customers: readonly ModelsCustomerResponse[]
  /** How many customers have the keyword; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the customers that come next */
  onMore: () => void
  /** How a customer is chosen */
  choose: ChooseCustomer
}

/**
 * The customers that were found, to choose one of: the one a booking is
 * for, the one who referred another. The name chooses; the kana, the phone
 * number and the address of mail tell two customers of one name apart.
 */
export const CustomerChoices = ({
  customers,
  total,
  more,
  onMore,
  choose,
}: CustomerChoicesProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(words.caption)}
      columns={[
        {
          key: 'name',
          header: say(words.name),
          cell: (customer) =>
            match(choose)
              .when(
                ({ excluded }) => customer.id === excluded,
                () => say(words.thisCustomer(customerNameOf(customer))),
              )
              .with({ type: 'link' }, ({ hrefOf }) => (
                <Link href={hrefOf(customer)}>{customerNameOf(customer)}</Link>
              ))
              .with({ type: 'button' }, ({ onChoose }) => (
                <Button size='small' onClick={() => onChoose(customer)}>
                  {customerNameOf(customer)}
                </Button>
              ))
              .exhaustive(),
        },
        { key: 'kana', header: say(words.kana), cell: customerKanaOf },
        {
          key: 'phoneNumber',
          header: say(words.phoneNumber),
          cell: ({ phoneNumber }) => phoneNumber,
        },
        {
          key: 'email',
          header: say(words.email),
          cell: ({ email }) => email,
        },
      ]}
      rows={customers}
      rowKey={({ id }) => id}
      emptyMessage={say(words.empty)}
      count={say(countOf(total, customers.length, COUNTED.people))}
      more={more}
      onMore={onMore}
    />
  )
}
