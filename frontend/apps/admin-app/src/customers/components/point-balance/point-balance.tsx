import { ButtonLink, Card } from '@beauty-salon-frontend/ui'
import { countNameOf } from '../../utils/customer-format'
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
    <p className={styles['balance']}>{countNameOf(balance, 'ポイント')}</p>
    <p>ポイントは、どのサロンで貯めたものも、どのサロンでも使えます。</p>
  </Card>
)
