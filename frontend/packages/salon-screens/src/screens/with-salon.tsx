import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  frameMessages,
  salonScreenMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import { readSalon, salonKeyOf } from '../api/salons-api'

const { names, otherSalon, withSalon: words } = salonScreenMessages

export type WithSalonProps = {
  salonId: string
  /** The title of the screen, when the salon could not be read */
  title: string
  /** The screen, for the salon that was read */
  children: (salon: ModelsSalonResponse) => ReactNode
}

/**
 * A screen of a salon. The salon says what the screen is of (its name), when
 * its times are (its time zone) and what its amounts are in (its currency),
 * so nothing of the screen is shown before it is read.
 *
 * While it is read, the screen is not there yet and has no heading: the
 * heading the screen then shows is a heading of another screen, and takes
 * the focus. A heading of the same title shown here first would be drawn
 * anew by the screen, and the focus it had would be lost.
 */
export const WithSalon = ({ salonId, title, children }: WithSalonProps) => {
  const say = useSay()
  const read = useQuery({
    queryKey: salonKeyOf(salonId),
    queryFn: () => readSalon(salonId),
  })

  return match(read.data)
    .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
    .with({ type: 'found' }, ({ salon }) => children(salon))
    .with({ type: 'notFound' }, () => (
      <>
        <PageHeader
          title={say(words.notFound)}
          description={say(words.notFoundDescription)}
        />
        <ButtonLink href='/'>{say(frameMessages.notFound.back)}</ButtonLink>
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        <PageHeader title={title} />
        <UnreadNotice
          message={say(unreadMessageOf(names.salon, reason))}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}

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
