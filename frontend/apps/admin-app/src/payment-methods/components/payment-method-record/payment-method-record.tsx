import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { methodKindNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  amountsNameOf,
  feeNameOf,
  placesNameOf,
  usedNameOf,
} from '../../utils/payment-method-format'

const { words: WORDS } = adminPaymentMethodMessages

export type PaymentMethodRecordProps = {
  method: ModelsPaymentMethodResponse
  currency: string
}

/**
 * Everything the salon keeps of a payment method: its name and kind, what
 * it takes at once, its fee and the company it goes through, where and
 * whether it is used, and its place in the order.
 */
export const PaymentMethodRecord = ({
  method,
  currency,
}: PaymentMethodRecordProps) => {
  const say = useSay()
  const fee = feeNameOf(method.fee)

  return (
    <Card title={say(WORDS.method)}>
      <DescriptionList
        items={[
          { term: say(WORDS.displayName), description: method.displayName },
          {
            term: say(WORDS.kind),
            description: say(methodKindNameOf(method.method)),
          },
          {
            term: say(WORDS.description),
            description: <WrittenText>{method.description}</WrittenText>,
          },
          {
            term: say(WORDS.amounts),
            description: say(amountsNameOf(method, currency)),
          },
          {
            term: say(WORDS.fee),
            description: fee === null ? null : say(fee),
          },
          {
            term: say(WORDS.processor),
            description: method.processorName,
          },
          { term: say(WORDS.places), description: say(placesNameOf(method)) },
          {
            term: say(WORDS.status),
            description: say(usedNameOf(method.isActive)),
          },
          {
            term: say(WORDS.sortOrder),
            description: say(formats.numberOf(method.sortOrder)),
          },
        ]}
      />
    </Card>
  )
}
