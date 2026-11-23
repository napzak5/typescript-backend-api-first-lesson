import type {
  ModelsSalesByCategoryResponse,
  ModelsSalesByMethodResponse,
  ModelsSalesByStaffResponse,
  ModelsSalesReportResponse,
} from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  categoryNameOf,
  methodKindNameOf,
} from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  Link,
  Note,
  Table,
  useSay,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { percentNameOf } from '../../utils/sales-report'
import styles from './sales-report.module.css'

const {
  categories,
  columns,
  count,
  report: words,
  staff,
} = dashboardReportMessages
const { payments, topStaff, totals } = words

export type SalesReportProps = {
  /** The sales of a period, as the API counted them; at least one */
  report: ModelsSalesReportResponse
  /** The currency of the salon */
  currency: string
  /** The sales of every member of the staff, over the same days */
  staffHref: string
  /** The sales of every kind of service, over the same days */
  categoriesHref: string
}

/** A member of the staff, at their place among those who sold the most */
type Ranked = { rank: number; counted: ModelsSalesByStaffResponse }

/**
 * The sales of a period: the sums, what was received by each kind of
 * payment, what each kind of service sold, and the five members of the
 * staff who sold the most. Each part says how it is counted, where that
 * makes its sum another than that of the sales.
 */
export const SalesReport = ({
  report,
  currency,
  staffHref,
  categoriesHref,
}: SalesReportProps) => {
  const say = useSay()
  const money = (amount: number): string => say(amountOf(amount, currency))

  return (
    <div className={styles['report']}>
      <Card title={say(totals.title)}>
        <div className={styles['part']}>
          <DescriptionList
            items={[
              {
                term: say(columns.sales),
                description: money(report.totalSales),
              },
              {
                term: say(totals.refunds),
                description: money(report.totalRefunds),
              },
              { term: say(totals.net), description: money(report.netSales) },
              {
                term: say(columns.transactions),
                description: say(count(report.transactionCount)),
              },
              {
                term: say(columns.averageTransaction),
                description: money(report.averageTransactionValue),
              },
              { term: say(totals.tax), description: money(report.totalTax) },
              {
                term: say(totals.discounts),
                description: money(report.totalDiscounts),
              },
            ]}
          />
          <Note>{say(totals.note)}</Note>
        </div>
      </Card>
      <Card title={say(payments.title)}>
        <div className={styles['part']}>
          <Table<ModelsSalesByMethodResponse>
            caption={say(payments.caption)}
            captionHidden
            columns={[
              {
                key: 'method',
                header: say(payments.method),
                cell: ({ method }) => say(methodKindNameOf(method)),
              },
              {
                key: 'amount',
                header: say(payments.received),
                align: 'end',
                cell: ({ amount }) => money(amount),
              },
              {
                key: 'count',
                header: say(payments.payments),
                align: 'end',
                cell: (method) => say(count(method.count)),
              },
              {
                key: 'percentage',
                header: say(columns.share),
                align: 'end',
                cell: ({ percentage }) => say(percentNameOf(percentage)),
              },
            ]}
            rowHeader='method'
            rows={report.salesByMethod}
            rowKey={({ method }) => method}
            emptyMessage={say(payments.none)}
          />
          <Note>{say(payments.note)}</Note>
        </div>
      </Card>
      <Card title={say(words.categories.title)}>
        <div className={styles['part']}>
          <Table<ModelsSalesByCategoryResponse>
            caption={say(words.categories.caption)}
            captionHidden
            columns={[
              {
                key: 'category',
                header: say(words.categories.category),
                cell: ({ category }) => say(categoryNameOf(category)),
              },
              {
                key: 'amount',
                header: say(columns.sales),
                align: 'end',
                cell: ({ amount }) => money(amount),
              },
              {
                key: 'count',
                header: say(columns.services),
                align: 'end',
                cell: (category) => say(count(category.count)),
              },
              {
                key: 'percentage',
                header: say(columns.share),
                align: 'end',
                cell: ({ percentage }) => say(percentNameOf(percentage)),
              },
            ]}
            rowHeader='category'
            rows={report.salesByCategory}
            rowKey={({ category }) => category}
            emptyMessage={say(categories.noneInTable)}
          />
          <Note>{say(categories.note)}</Note>
          <p>
            <Link href={categoriesHref}>{say(words.categories.all)}</Link>
          </p>
        </div>
      </Card>
      <Card title={say(topStaff.title)}>
        <div className={styles['part']}>
          <Table<Ranked>
            caption={say(topStaff.caption)}
            captionHidden
            columns={[
              {
                key: 'rank',
                header: say(columns.rank),
                align: 'end',
                cell: ({ rank }) => say(formats.placeOf(rank)),
              },
              {
                key: 'staff',
                header: say(columns.staff),
                cell: ({ counted }) => counted.displayName,
              },
              {
                key: 'totalSales',
                header: say(columns.sales),
                align: 'end',
                cell: ({ counted }) => money(counted.totalSales),
              },
              {
                key: 'serviceCount',
                header: say(columns.services),
                align: 'end',
                cell: ({ counted }) => say(count(counted.serviceCount)),
              },
              {
                key: 'averageServiceValue',
                header: say(columns.averageService),
                align: 'end',
                cell: ({ counted }) => money(counted.averageServiceValue),
              },
            ]}
            rowHeader='staff'
            rows={report.topStaff.map((counted, index) => ({
              rank: index + 1,
              counted,
            }))}
            rowKey={({ counted }) => counted.staffId}
            emptyMessage={say(staff.noneInTable)}
          />
          <Note>{say(staff.note)}</Note>
          <p>
            <Link href={staffHref}>{say(topStaff.all)}</Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
