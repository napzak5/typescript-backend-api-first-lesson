import type { ModelsInventoryValueReportResponse } from '@beauty-salon-frontend/api-client'
import { EmptyState, Table } from '@beauty-salon-frontend/ui'
import { amountOf } from '../../../bookings/booking-format'

export type ValueReportProps = {
  report: ModelsInventoryValueReportResponse
  /** The currency of the salon */
  currency: string
}

/**
 * What the stock of a salon is worth at the purchase prices of its
 * products, by their categories, the most valuable first: the total above,
 * then each category with how many of its products are in stock.
 */
export const ValueReport = ({ report, currency }: ValueReportProps) =>
  report.categories.length === 0 ? (
    <EmptyState
      title='在庫のある商品はありません'
      description='在庫の移動か棚卸しで在庫数が 0 より多くなった商品が、ここに出ます。'
    />
  ) : (
    <>
      <p>
        {`在庫評価額の合計は ${amountOf(report.totalValue, currency)}（${report.totalItems} 品目）です。在庫数に商品の仕入価格を掛けた額で、仕入価格のない商品は 0 円として数えます。`}
      </p>
      <Table
        caption='カテゴリーごとの在庫評価額'
        columns={[
          {
            key: 'category',
            header: 'カテゴリー',
            cell: ({ category }) => category ?? 'カテゴリーなし',
          },
          {
            key: 'itemCount',
            header: '品目数',
            align: 'end',
            cell: ({ itemCount }) => `${itemCount} 品目`,
          },
          {
            key: 'value',
            header: '在庫評価額',
            align: 'end',
            cell: ({ value }) => amountOf(value, currency),
          },
        ]}
        rows={report.categories}
        rowKey={({ category }) => category ?? ''}
        emptyMessage='在庫のある商品はありません'
      />
    </>
  )
