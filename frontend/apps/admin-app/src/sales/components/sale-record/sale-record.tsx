import type {
  ModelsCustomerResponse,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  dayNameOf,
  momentNameAt,
} from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  ButtonLink,
  Card,
  DescriptionList,
  Link,
  NONE,
  Table,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { numberOf } from '@beauty-salon-shared/i18n/formats'
import {
  adminCustomerMessages,
  adminSaleMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import { memberNameOf, type Names } from '../../../bookings/utils/day-bookings'
import { customerNameOf } from '../../../customers/api/customers-api'
import {
  owedOf,
  paymentStatusNameOf,
  paymentStatusToneOf,
  receivedOf,
  refundedOf,
} from '../../utils/sale-format'
import styles from './sale-record.module.css'

const { record, titles, words } = adminSaleMessages

export type SaleRecordProps = {
  sale: ModelsSaleResponse
  /** `null`: the customer was removed */
  customer: Pick<ModelsCustomerResponse, 'lastName' | 'firstName'> | null
  staff: Names['staff']
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
  /** The address of the page of the booking the sale bills */
  bookingHref?: string | undefined
  /** The address of the screen that changes the sale; `undefined` for a sale that is not changed */
  changeHref?: string | undefined
  /** The heading of the sale: the focus goes there after it was voided */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

/**
 * What the ledger keeps of a sale: when it was entered, for whom and by
 * whom, what it bills line by line, and what it comes to: what was
 * received of it, what was given back, and what is left to pay. A sale
 * that was voided says when and why.
 */
export const SaleRecord = ({
  sale,
  customer,
  staff,
  timezone,
  currency,
  bookingHref,
  changeHref,
  headingRef,
}: SaleRecordProps) => {
  const say = useSay()
  const refunded = refundedOf(sale)
  const customerName = customerNameIn(sale.customerId, customer)

  return (
    <div className={styles['record']}>
      <Card
        title={say(record.title)}
        headingRef={headingRef}
        actions={
          changeHref !== undefined && (
            <ButtonLink href={changeHref}>{say(titles.change)}</ButtonLink>
          )
        }
      >
        <DescriptionList
          items={[
            { term: say(words.saleNumber), description: sale.saleNumber },
            {
              term: say(words.saleTime),
              description: say(momentNameAt(sale.saleTime, timezone)),
            },
            {
              term: say(words.saleDate),
              description: say(dayNameOf(sale.saleDate)),
            },
            {
              term: say(record.customer),
              description: customerName === null ? null : say(customerName),
            },
            {
              term: say(words.cashier),
              description:
                sale.staffId === null
                  ? null
                  : say(memberNameOf(sale.staffId, staff)),
            },
            {
              term: say(record.booking),
              description:
                bookingHref === undefined ? (
                  say(NONE)
                ) : (
                  <Link href={bookingHref}>{say(record.toBooking)}</Link>
                ),
            },
            {
              term: say(words.payment),
              description: sale.isVoid ? (
                <Badge>{say(words.voided)}</Badge>
              ) : (
                <Badge tone={paymentStatusToneOf(sale.paymentStatus)}>
                  {say(paymentStatusNameOf(sale.paymentStatus))}
                </Badge>
              ),
            },
            ...(sale.voidedAt === null
              ? []
              : [
                  {
                    term: say(record.voidedAt),
                    description: say(momentNameAt(sale.voidedAt, timezone)),
                  },
                  {
                    term: say(record.voidReason),
                    description: sale.voidReason,
                  },
                ]),
            { term: say(words.notes), description: sale.notes },
          ]}
        />
      </Card>
      <Card title={say(words.lineItems)}>
        <Table
          caption={say(words.lineItems)}
          captionHidden
          columns={[
            {
              key: 'itemName',
              header: say(words.item),
              cell: ({ itemName }) => itemName,
            },
            {
              key: 'staff',
              header: say(words.staff),
              cell: ({ staffId }) => say(memberNameOf(staffId, staff)),
            },
            {
              key: 'quantity',
              header: say(words.quantity),
              cell: ({ quantity }) => say(numberOf(quantity)),
            },
            {
              key: 'unitPrice',
              header: say(words.unitPrice),
              cell: ({ unitPrice }) => say(amountOf(unitPrice, currency)),
            },
            {
              key: 'discountAmount',
              header: say(words.discount),
              cell: ({ discountAmount }) =>
                say(amountOf(discountAmount, currency)),
            },
            {
              key: 'taxAmount',
              header: say(words.tax),
              cell: ({ taxAmount }) => say(amountOf(taxAmount, currency)),
            },
            {
              key: 'totalAmount',
              header: say(words.amount),
              cell: ({ totalAmount }) => say(amountOf(totalAmount, currency)),
            },
          ]}
          rows={sale.details}
          rowKey={({ sortOrder }) => String(sortOrder)}
          emptyMessage={say(words.noLineItems)}
        />
      </Card>
      <Card title={say(words.amounts)}>
        <DescriptionList
          items={[
            {
              term: say(words.subtotal),
              description: say(amountOf(sale.subtotal, currency)),
            },
            {
              term: say(words.discount),
              description: say(amountOf(sale.discountAmount, currency)),
            },
            {
              term: say(words.tax),
              description: say(amountOf(sale.taxAmount, currency)),
            },
            {
              term: say(words.total),
              description: say(amountOf(sale.totalAmount, currency)),
            },
            {
              term: say(record.received),
              description: say(amountOf(receivedOf(sale), currency)),
            },
            ...(refunded === 0
              ? []
              : [
                  {
                    term: say(record.refunded),
                    description: say(amountOf(refunded, currency)),
                  },
                ]),
            {
              term: say(record.owed),
              description: say(amountOf(owedOf(sale), currency)),
            },
          ]}
        />
      </Card>
    </div>
  )
}

/** The customer of a sale, by name, removed from the ledger, or `null` when none was recorded. */
const customerNameIn = (
  customerId: string | null,
  customer: SaleRecordProps['customer'],
): LocalizedText | null => {
  if (customerId === null) {
    return null
  }
  if (customer === null) {
    return adminCustomerMessages.naming.removed
  }
  const name = customerNameOf(customer)

  return { en: name, ja: name }
}
