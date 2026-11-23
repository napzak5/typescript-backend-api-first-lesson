import { Actions, ButtonLink, Card, useSay } from '@beauty-salon-frontend/ui'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import styles from './sale-points.module.css'

const { points } = adminSaleMessages

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
export const SalePoints = ({ usedHref, earnedHref }: SalePointsProps) => {
  const say = useSay()

  return (
    <Card title={say(points.title)}>
      <div className={styles['points']}>
        <p>{say(points.explanation)}</p>
        <Actions>
          <ButtonLink href={usedHref}>{say(points.used)}</ButtonLink>
          <ButtonLink href={earnedHref}>{say(points.earned)}</ButtonLink>
        </Actions>
      </div>
    </Card>
  )
}
