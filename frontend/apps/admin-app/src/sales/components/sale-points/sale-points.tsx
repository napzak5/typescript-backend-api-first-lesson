import { Actions, ButtonLink, Card } from '@beauty-salon-frontend/ui'
import styles from './sale-points.module.css'

export type SalePointsProps = {
  /** The screen that records the points the customer used at the sale */
  usedHref: string
  /** The screen that gives the customer points for the sale */
  earnedHref: string
}

/**
 * The points of the customer of a sale: what they used at the counter and
 * what they are given, each recorded for the sale.
 */
export const SalePoints = ({ usedHref, earnedHref }: SalePointsProps) => (
  <Card title='ポイント'>
    <div className={styles['points']}>
      <p>
        お会計で使ったポイントと、付与するポイントを、この売上に結びつけて、お客様のポイントに記録します。
      </p>
      <Actions>
        <ButtonLink href={usedHref}>使ったポイントを記録する</ButtonLink>
        <ButtonLink href={earnedHref}>ポイントを付与する</ButtonLink>
      </Actions>
    </div>
  </Card>
)
