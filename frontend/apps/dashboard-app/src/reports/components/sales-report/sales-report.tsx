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
  inJapanese,
  Link,
  Note,
  Table,
} from '@beauty-salon-frontend/ui'
import {
  CATEGORY_SALES_NOTE,
  countNameOf,
  percentNameOf,
  rankNameOf,
  STAFF_SALES_NOTE,
} from '../../utils/sales-report'
import styles from './sales-report.module.css'

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
  const money = (amount: number): string =>
    inJapanese(amountOf(amount, currency))

  return (
    <div className={styles['report']}>
      <Card title='期間の合計'>
        <div className={styles['part']}>
          <DescriptionList
            items={[
              { term: '売上', description: money(report.totalSales) },
              { term: '返金', description: money(report.totalRefunds) },
              { term: '純売上', description: money(report.netSales) },
              {
                term: '会計の件数',
                description: countNameOf(report.transactionCount),
              },
              {
                term: '客単価',
                description: money(report.averageTransactionValue),
              },
              { term: '消費税', description: money(report.totalTax) },
              { term: '値引き', description: money(report.totalDiscounts) },
            ]}
          />
          <Note>
            売上は、消費税を含み、値引きを引いた額です。純売上は、売上から返金を引いた額です。返金は、返金した日ではなく、もとの会計の日で数えます。
          </Note>
        </div>
      </Card>
      <Card title='支払い方法別'>
        <div className={styles['part']}>
          <Table<ModelsSalesByMethodResponse>
            caption='支払い方法別の入金'
            captionHidden
            columns={[
              {
                key: 'method',
                header: '支払い方法',
                cell: ({ method }) => inJapanese(methodKindNameOf(method)),
              },
              {
                key: 'amount',
                header: '入金',
                align: 'end',
                cell: ({ amount }) => money(amount),
              },
              {
                key: 'count',
                header: '支払いの件数',
                align: 'end',
                cell: ({ count }) => countNameOf(count),
              },
              {
                key: 'percentage',
                header: '割合',
                align: 'end',
                cell: ({ percentage }) => percentNameOf(percentage),
              },
            ]}
            rowHeader='method'
            rows={report.salesByMethod}
            rowKey={({ method }) => method}
            emptyMessage='受け取った支払いはありません'
          />
          <Note>
            入金は、受け取った支払いから返金を引いた額です。まだ受け取っていない額は入らないので、合わせても売上と同じにならないことがあります。
          </Note>
        </div>
      </Card>
      <Card title='メニューの区分別'>
        <div className={styles['part']}>
          <Table<ModelsSalesByCategoryResponse>
            caption='メニューの区分別の売上'
            captionHidden
            columns={[
              {
                key: 'category',
                header: 'メニューの区分',
                cell: ({ category }) => inJapanese(categoryNameOf(category)),
              },
              {
                key: 'amount',
                header: '売上',
                align: 'end',
                cell: ({ amount }) => money(amount),
              },
              {
                key: 'count',
                header: '施術の数',
                align: 'end',
                cell: ({ count }) => countNameOf(count),
              },
              {
                key: 'percentage',
                header: '割合',
                align: 'end',
                cell: ({ percentage }) => percentNameOf(percentage),
              },
            ]}
            rowHeader='category'
            rows={report.salesByCategory}
            rowKey={({ category }) => category}
            emptyMessage='メニューの売上はありません'
          />
          <Note>{CATEGORY_SALES_NOTE}</Note>
          <p>
            <Link href={categoriesHref}>区分別の売上へ</Link>
          </p>
        </div>
      </Card>
      <Card title='スタッフ別の上位 5 人'>
        <div className={styles['part']}>
          <Table<Ranked>
            caption='スタッフ別の売上の上位 5 人'
            captionHidden
            columns={[
              {
                key: 'rank',
                header: '順位',
                align: 'end',
                cell: ({ rank }) => rankNameOf(rank),
              },
              {
                key: 'staff',
                header: 'スタッフ',
                cell: ({ counted }) => counted.displayName,
              },
              {
                key: 'totalSales',
                header: '売上',
                align: 'end',
                cell: ({ counted }) => money(counted.totalSales),
              },
              {
                key: 'serviceCount',
                header: '施術の数',
                align: 'end',
                cell: ({ counted }) => countNameOf(counted.serviceCount),
              },
              {
                key: 'averageServiceValue',
                header: '施術の平均単価',
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
            emptyMessage='担当したスタッフのいる売上はありません'
          />
          <Note>{STAFF_SALES_NOTE}</Note>
          <p>
            <Link href={staffHref}>すべてのスタッフの売上へ</Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
