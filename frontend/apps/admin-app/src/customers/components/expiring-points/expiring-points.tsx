import type { ModelsPointExpiringResponse } from '@beauty-salon-frontend/api-client'
import { dayNameOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { Card, Table, useSay } from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { transactionNameOf } from '../../utils/points'
import styles from './expiring-points.module.css'

const { expiring: words } = adminCustomerMessages.points

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
  const say = useSay()
  const anyPast = expiring.transactions.some(
    ({ expiryDate }) => expiryDate !== null && expiryDate < today,
  )

  return (
    <Card title={say(words.title)}>
      {expiring.expirationDate === null ? (
        <p>{say(words.noneWithin(days))}</p>
      ) : (
        <div className={styles['expiring']}>
          <p>
            {say(
              words.within(
                days,
                expiring.expiringPoints,
                dayNameOf(expiring.expirationDate),
              ),
            )}
          </p>
          {anyPast && <p>{say(words.pastUsable)}</p>}
          <Table
            caption={say(words.breakdown)}
            captionHidden
            columns={[
              {
                key: 'expiryDate',
                header: say(words.expiryDate),
                cell: ({ expiryDate }) =>
                  expiryDate === null
                    ? ''
                    : say(
                        expiryDate < today
                          ? words.expired(dayNameOf(expiryDate))
                          : dayNameOf(expiryDate),
                      ),
              },
              {
                key: 'transactionType',
                header: say(words.kind),
                cell: ({ transactionType }) =>
                  say(transactionNameOf(transactionType)),
              },
              {
                key: 'points',
                header: say(words.points),
                cell: ({ points }) => say(customerMessages.pointsOf(points)),
                align: 'end',
              },
              {
                key: 'createdAt',
                header: say(words.moment),
                cell: ({ createdAt }) => say(momentNameAt(createdAt, timezone)),
              },
              {
                key: 'description',
                header: say(words.description),
                cell: ({ description }) => description,
              },
            ]}
            rows={expiring.transactions}
            rowKey={({ id }) => id}
            emptyMessage={say(words.empty)}
          />
          <p>{say(words.asGiven)}</p>
        </div>
      )}
    </Card>
  )
}
