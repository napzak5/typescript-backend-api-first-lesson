import type { ModelsPaymentMethodResponse } from '@beauty-salon-frontend/api-client'
import { methodKindNameOf } from '@beauty-salon-frontend/salon-screens'
import { inJapanese, Link, Table } from '@beauty-salon-frontend/ui'
import {
  amountsNameOf,
  feeNameOf,
  placesNameOf,
  usedNameOf,
} from '../../utils/payment-method-format'

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
}: PaymentMethodTableProps) => (
  <Table
    caption='支払い方法'
    captionHidden
    columns={[
      {
        key: 'displayName',
        header: '表示名',
        cell: ({ id, displayName }) => (
          <Link href={methodHref(id)}>{displayName}</Link>
        ),
      },
      {
        key: 'method',
        header: '種類',
        cell: ({ method }) => inJapanese(methodKindNameOf(method)),
      },
      {
        key: 'amounts',
        header: '1 回の金額',
        cell: (method) => amountsNameOf(method, currency),
      },
      {
        key: 'fee',
        header: '手数料率',
        cell: ({ fee }) => feeNameOf(fee),
      },
      {
        key: 'places',
        header: '使う場所',
        cell: (method) => placesNameOf(method),
      },
      {
        key: 'isActive',
        header: '状態',
        cell: ({ isActive }) => usedNameOf(isActive),
      },
    ]}
    rows={methods}
    rowKey={({ id }) => id}
    emptyMessage='支払い方法はありません'
  />
)
