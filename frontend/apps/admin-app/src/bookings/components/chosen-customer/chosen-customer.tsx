import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { ButtonLink, Card, DescriptionList } from '@beauty-salon-frontend/ui'
import {
  customerKanaOf,
  customerNameOf,
} from '../../../customers/customers-api'

export type ChosenCustomerProps = {
  customer: Pick<
    ModelsCustomerResponse,
    | 'lastName'
    | 'firstName'
    | 'lastNameKana'
    | 'firstNameKana'
    | 'phoneNumber'
    | 'email'
  >
  /** The address of the choice of a customer, with the search that found this one */
  againHref: string
}

/**
 * The customer a booking is put in for, as the ledger knows them: enough
 * to say on the phone who it is, and the way back to choose another one.
 */
export const ChosenCustomer = ({
  customer,
  againHref,
}: ChosenCustomerProps) => {
  const kana = customerKanaOf(customer)

  return (
    <Card
      title='お客様'
      actions={
        <ButtonLink href={againHref} size='small'>
          お客様を選び直す
        </ButtonLink>
      }
    >
      <DescriptionList
        items={[
          { term: 'お名前', description: customerNameOf(customer) },
          { term: 'フリガナ', description: kana === '' ? null : kana },
          { term: '電話番号', description: customer.phoneNumber },
          { term: 'メールアドレス', description: customer.email },
        ]}
      />
    </Card>
  )
}
