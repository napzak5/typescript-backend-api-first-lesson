import type { ModelsPointExpiringResponse } from '@beauty-salon-frontend/api-client'
import { dayNameOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { Card, Table } from '@beauty-salon-frontend/ui'
import { countNameOf } from '../../utils/customer-format'
import { transactionNameOf } from '../../utils/points'
import styles from './expiring-points.module.css'

export type ExpiringPointsProps = {
  /** The points that expire within the days, as the API counted them */
  expiring: ModelsPointExpiringResponse
  /** How many days ahead they were counted over */
  days: number
  /** Today at the salon: a day before it is past */
  today: string
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
}

/**
 * The points of a customer that expire soon and are not used: how many,
 * the first day, and the points given they are left of. Points whose day
 * is past can be used until they are expired: the card says so.
 */
export const ExpiringPoints = ({
  expiring,
  days,
  today,
  timezone,
}: ExpiringPointsProps) => {
  const anyPast = expiring.transactions.some(
    ({ expiryDate }) => expiryDate !== null && expiryDate < today,
  )

  return (
    <Card title='期限が近いポイント'>
      {expiring.expirationDate === null ? (
        <p>{`${days} 日以内に期限が来るポイントはありません。`}</p>
      ) : (
        <div className={styles['expiring']}>
          <p>
            {`${days} 日以内に期限が来るポイントは、${countNameOf(expiring.expiringPoints, 'ポイント')}です。最も早い期限は、${dayNameOf(expiring.expirationDate)}です。`}
          </p>
          {anyPast && <p>期限を過ぎたポイントも、失効させるまでは使えます。</p>}
          <Table
            caption='期限が近いポイントの内訳'
            captionHidden
            columns={[
              {
                key: 'expiryDate',
                header: '有効期限',
                cell: ({ expiryDate }) =>
                  expiryDate === null
                    ? ''
                    : `${dayNameOf(expiryDate)}${expiryDate < today ? '（期限切れ）' : ''}`,
              },
              {
                key: 'transactionType',
                header: '種類',
                cell: ({ transactionType }) =>
                  transactionNameOf(transactionType),
              },
              {
                key: 'points',
                header: 'ポイント',
                cell: ({ points }) => countNameOf(points, 'ポイント'),
                align: 'end',
              },
              {
                key: 'createdAt',
                header: '日時',
                cell: ({ createdAt }) => momentNameAt(createdAt, timezone),
              },
              {
                key: 'description',
                header: '説明',
                cell: ({ description }) => description,
              },
            ]}
            rows={expiring.transactions}
            rowKey={({ id }) => id}
            emptyMessage='期限が近いポイントはありません'
          />
          <p>
            表のポイントは、付与したとき（統合で移したとき）の数で、使われずに残っている数ではありません。
          </p>
        </div>
      )}
    </Card>
  )
}
