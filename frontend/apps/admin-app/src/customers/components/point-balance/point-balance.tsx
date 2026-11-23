import { ButtonLink, Card, useSay } from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/ui'
import styles from './point-balance.module.css'

const { balance: words } = adminCustomerMessages.points

export type PointBalanceProps = {
  /** What the latest transaction of the customer left */
  balance: number
  /** The screen that records points of the customer */
  entryHref: string
}

/**
 * The balance of a customer, with the way to record points: points given
 * at the counter, points the customer used, and an adjustment. The points
 * are the customer's, at every salon.
 */
export const PointBalance = ({ balance, entryHref }: PointBalanceProps) => {
  const say = useSay()

  return (
    <Card
      title={say(words.title)}
      actions={
        <ButtonLink href={entryHref} variant='primary'>
          {say(words.record)}
        </ButtonLink>
      }
    >
      <p className={styles['balance']}>
        {say(customerMessages.pointsOf(balance))}
      </p>
      <p>{say(words.everywhere)}</p>
    </Card>
  )
}
