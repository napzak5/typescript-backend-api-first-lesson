import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import { Button, countOf, Link, type More } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { customerKanaOf, customerNameOf } from '../../customers-api'

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
}: CustomerChoicesProps) => (
  <PagedTable
    caption='見つかったお客様'
    columns={[
      {
        key: 'name',
        header: 'お名前',
        cell: (customer) =>
          match(choose)
            .when(
              ({ excluded }) => customer.id === excluded,
              () => `${customerNameOf(customer)}（このお客様）`,
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
