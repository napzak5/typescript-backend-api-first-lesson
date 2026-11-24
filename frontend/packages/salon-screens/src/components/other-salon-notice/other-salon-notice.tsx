import { ButtonLink, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { salonScreenMessages } from '@beauty-salon-shared/i18n/messages/ui'

const { names, otherSalon } = salonScreenMessages

export type OtherSalonNoticeProps = {
  /** What is not theirs to see (「売上」), as it stands inside the sentence */
  what?: LocalizedText
  /** Who may see it */
  who?: LocalizedText
  /** Where the start of the application leads a member: 「予約」 */
  start?: LocalizedText
}

/**
 * What a member of the staff of another salon is told: the API shows what
 * is kept of a salon (its bookings, its sales) to its own staff. The start
 * leads to their own salon.
 */
export const OtherSalonNotice = ({
  what = names.bookings,
  who = names.staffOfTheSalon,
  start = names.bookings,
}: OtherSalonNoticeProps) => {
  const say = useSay()

  return (
    <>
      <p>{say(otherSalon.notice(what, who))}</p>
      <ButtonLink href='/'>{say(otherSalon.toOwnSalon(start))}</ButtonLink>
    </>
  )
}
