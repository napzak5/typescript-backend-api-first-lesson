import type { ModelsSalesByStaffResponse } from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import { Card, Note, Table, useSay } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { percentOfMost } from '../../utils/sales-breakdown'
import { ShareBar } from '../share-bar/share-bar'
import styles from './staff-sales.module.css'

const { columns, count, staff: words, titles } = dashboardReportMessages

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
  const say = useSay()
  const money = (amount: number): string => say(amountOf(amount, currency))
  const most = staff[0]?.totalSales ?? 0

  return (
    <Card title={say(words.title)}>
      <div className={styles['part']}>
        <Table<Ranked>
          caption={say(titles.staff)}
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
              cell: ({ counted }) => (
                <ShareBar percent={percentOfMost(counted.totalSales, most)}>
                  {money(counted.totalSales)}
                </ShareBar>
              ),
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
          rows={staff.map((counted, index) => ({ rank: index + 1, counted }))}
          rowKey={({ counted }) => counted.staffId}
          emptyMessage={say(words.noneInTable)}
        />
        <Note>{say(words.note)}</Note>
      </div>
    </Card>
  )
}
