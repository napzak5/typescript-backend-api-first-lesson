import type { ModelsSalesByStaffResponse } from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import { Card, Note, Table } from '@beauty-salon-frontend/ui'
import { percentOfMost } from '../../sales-breakdown'
import { countNameOf, rankNameOf, STAFF_SALES_NOTE } from '../../sales-report'
import { ShareBar } from '../share-bar/share-bar'
import styles from './staff-sales.module.css'

export type StaffSalesProps = {
  /** Every member of the staff who had a line of the sales, the most first, as the API answers; at least one */
  staff: readonly ModelsSalesByStaffResponse[]
  /** The currency of the salon */
  currency: string
}

/** A member of the staff, at their place among the others */
type Ranked = { rank: number; counted: ModelsSalesByStaffResponse }

/**
 * The sales of a period of every member of the staff, in the order the API
 * ranks them: their sales with a bar as long as their share of the most,
 * the number of their services and the average of them. How they are
 * counted is said under the table.
 */
export const StaffSales = ({ staff, currency }: StaffSalesProps) => {
  const money = (amount: number): string => amountOf(amount, currency)
  const most = staff[0]?.totalSales ?? 0

  return (
    <Card title='スタッフごとの売上'>
      <div className={styles['part']}>
        <Table<Ranked>
          caption='スタッフ別の売上'
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
              cell: ({ counted }) => (
                <ShareBar percent={percentOfMost(counted.totalSales, most)}>
                  {money(counted.totalSales)}
                </ShareBar>
              ),
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
          rows={staff.map((counted, index) => ({ rank: index + 1, counted }))}
          rowKey={({ counted }) => counted.staffId}
          emptyMessage='担当したスタッフのいる売上はありません'
        />
        <Note>{STAFF_SALES_NOTE}</Note>
      </div>
    </Card>
  )
}
