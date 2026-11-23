import type { ModelsInventoryAlertSummaryResponse } from '@beauty-salon-frontend/api-client'
import { DescriptionList, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import styles from './alert-summary.module.css'

const { severities, summary: words } = adminInventoryMessages.alerts

export type AlertSummaryProps = {
  summary: ModelsInventoryAlertSummaryResponse
}

/** How many alerts there are, and how many of them nobody saw to, in a sentence. */
const sentenceOf = ({
  totalAlerts,
  unacknowledged,
}: ModelsInventoryAlertSummaryResponse): LocalizedText => {
  if (totalAlerts === 0) {
    return words.none
  }

  return unacknowledged === 0
    ? words.allAcknowledged(totalAlerts)
    : words.someNotAcknowledged(totalAlerts, unacknowledged)
}

/**
 * How many alerts the stock of a salon has now: how many nobody saw to,
 * then how many there are of each severity, the heaviest first.
 */
export const AlertSummary = ({ summary }: AlertSummaryProps) => {
  const say = useSay()

  return (
    <div className={styles['summary']}>
      <p>{say(sentenceOf(summary))}</p>
      {summary.totalAlerts > 0 && (
        <DescriptionList
          items={[
            {
              term: say(severities.critical),
              description: say(words.alertsOf(summary.criticalAlerts)),
            },
            {
              term: say(severities.warning),
              description: say(words.alertsOf(summary.warningAlerts)),
            },
            {
              term: say(severities.info),
              description: say(words.alertsOf(summary.infoAlerts)),
            },
          ]}
        />
      )}
    </div>
  )
}
