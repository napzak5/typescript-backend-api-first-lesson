import { ButtonLink, Card, inJapanese } from '@beauty-salon-frontend/ui'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/ui'
import styles from './point-balance.module.css'

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
export const PointBalance = ({ balance, entryHref }: PointBalanceProps) => (
  <Card
    title='残高'
    actions={
      <ButtonLink href={entryHref} variant='primary'>
        ポイントを記録する
      </ButtonLink>
    }
  >
    <p className={styles['balance']}>
      {inJapanese(customerMessages.pointsOf(balance))}
    </p>
    <p>ポイントは、どのサロンで貯めたものも、どのサロンでも使えます。</p>
  </Card>
)
