import { OtherSalonNotice } from '@beauty-salon-frontend/salon-screens'
import { ButtonLink, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { frameMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'

const { names, refusal: words } = dashboardReportMessages

export type ReportRefusalProps = {
  /** Why there is no report: the account is of another salon, or the salon was removed */
  refusal: 'forbidden' | 'notFound'
  /** What is not shown, as a sentence names it: `dashboardReportMessages.names.seen.report` */
  what: LocalizedText
}

/**
 * What a screen of the sales says instead of them: that they are not the
 * account's to see, and the way to those of its own salon; or that the
 * salon was removed since it was read.
 */
export const ReportRefusal = ({ refusal, what }: ReportRefusalProps) => {
  const say = useSay()

  return match(refusal)
    .with('forbidden', () => (
      <OtherSalonNotice what={what} who={names.who} start={names.seen.report} />
    ))
    .with('notFound', () => (
      <>
        <p>{say(words.removed(what))}</p>
        <ButtonLink href='/'>{say(frameMessages.notFound.back)}</ButtonLink>
      </>
    ))
    .exhaustive()
}
