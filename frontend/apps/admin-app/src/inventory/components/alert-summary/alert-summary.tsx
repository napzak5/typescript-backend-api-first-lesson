import type { ModelsInventoryAlertSummaryResponse } from '@beauty-salon-frontend/api-client'
import { DescriptionList } from '@beauty-salon-frontend/ui'
import styles from './alert-summary.module.css'

export type AlertSummaryProps = {
  summary: ModelsInventoryAlertSummaryResponse
}

/** How many alerts there are, and how many of them nobody saw to, in a sentence. */
const sentenceOf = ({
  totalAlerts,
  unacknowledged,
}: ModelsInventoryAlertSummaryResponse): string => {
  if (totalAlerts === 0) {
    return '今出ているアラートはありません。'
  }

  return unacknowledged === 0
    ? `今出ているアラートは ${totalAlerts} 件で、どれも確認済みです。`
    : `今出ているアラートは ${totalAlerts} 件で、そのうち ${unacknowledged} 件が未確認です。`
}

/**
 * How many alerts the stock of a salon has now: how many nobody saw to,
 * then how many there are of each severity, the heaviest first.
 */
export const AlertSummary = ({ summary }: AlertSummaryProps) => (
  <div className={styles['summary']}>
    <p>{sentenceOf(summary)}</p>
    {summary.totalAlerts > 0 && (
      <DescriptionList
        items={[
          { term: '緊急', description: `${summary.criticalAlerts} 件` },
          { term: '注意', description: `${summary.warningAlerts} 件` },
          { term: '情報', description: `${summary.infoAlerts} 件` },
        ]}
      />
    )}
  </div>
)
