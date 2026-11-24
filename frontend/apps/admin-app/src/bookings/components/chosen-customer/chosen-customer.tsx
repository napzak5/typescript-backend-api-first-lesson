import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  Card,
  DescriptionList,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  customerKanaOf,
  customerNameOf,
} from '../../../customers/api/customers-api'

const { customer: WORDS } = adminBookingMessages.entry

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
  const say = useSay()
  const kana = customerKanaOf(customer)

  return (
    <Card
      title={say(WORDS.chosen)}
      actions={
        <ButtonLink href={againHref} size='small'>
          {say(WORDS.chooseAgain)}
        </ButtonLink>
      }
    >
      <DescriptionList
        items={[
          {
            term: say(customerMessages.parts.name),
            description: customerNameOf(customer),
          },
          {
            term: say(customerMessages.kana),
            description: kana === '' ? null : kana,
          },
          {
            term: say(customerMessages.phoneNumber),
            description: customer.phoneNumber,
          },
          {
            term: say(customerMessages.email),
            description: customer.email,
          },
        ]}
      />
    </Card>
  )
}
