import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { methodKindNameOf } from '@beauty-salon-frontend/salon-screens'
import { Link, Table, useSay } from '@beauty-salon-frontend/ui'
import { adminPaymentMethodMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  amountsNameOf,
  feeNameOf,
  placesNameOf,
  usedNameOf,
} from '../../utils/payment-method-format'

const { words: WORDS, list, titles } = adminPaymentMethodMessages

export type PaymentMethodTableProps = {
  /** The payment methods of the salon, in their order */
  methods: readonly ModelsPaymentMethodResponse[]
  currency: string
  /** The address of a payment method */
  methodHref: (paymentMethodId: string) => string
}

/**
 * The payment methods of a salon, in their order, those it uses no more
 * among them: each with its kind, what it takes at once, its fee, where it
 * is used and whether it is used. The name leads to the method. The
 * screen heads the table, so its caption is for assistive technology only.
 */
export const PaymentMethodTable = ({
  methods,
  currency,
  methodHref,
}: PaymentMethodTableProps) => {
  const say = useSay()

  return (
    <Table
      caption={say(titles.methods)}
      captionHidden
      columns={[
        {
          key: 'displayName',
          header: say(WORDS.displayName),
          cell: ({ id, displayName }) => (
            <Link href={methodHref(id)}>{displayName}</Link>
          ),
        },
        {
          key: 'method',
          header: say(WORDS.kind),
          cell: ({ method }) => say(methodKindNameOf(method)),
        },
        {
          key: 'amounts',
          header: say(WORDS.amounts),
          cell: (method) => say(amountsNameOf(method, currency)),
        },
        {
          key: 'fee',
          header: say(WORDS.fee),
          cell: ({ fee }) => {
            const named = feeNameOf(fee)

            return named === null ? null : say(named)
          },
        },
        {
          key: 'places',
          header: say(WORDS.places),
          cell: (method) => say(placesNameOf(method)),
        },
        {
          key: 'isActive',
          header: say(WORDS.status),
          cell: ({ isActive }) => say(usedNameOf(isActive)),
        },
      ]}
      rows={methods}
      rowKey={({ id }) => id}
      emptyMessage={say(list.none)}
    />
  )
}
