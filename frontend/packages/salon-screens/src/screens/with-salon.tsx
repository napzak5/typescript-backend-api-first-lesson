import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import {
  frameMessages,
  salonScreenMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import { readSalon, salonKeyOf } from '../api/salons-api'

const { names, withSalon: words } = salonScreenMessages

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
