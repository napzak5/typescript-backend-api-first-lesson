import { unreadMessageOf } from '@beauty-salon-frontend/salon-screens'
import { NoSalonNotice, useOwnSalon } from '@beauty-salon-frontend/session'
import {
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { Navigate } from 'react-router'
import { match, P } from 'ts-pattern'
import { bookingsHrefOf } from './navigation'
import { SalonChoiceScreen } from './salons/salon-choice-screen'

/**
 * The start of the application. An administrator chooses a salon here; a
 * member of the staff is led on to the bookings of their salon, and the
 * address of the start is replaced, so going back does not lead here again.
 */
export const HomeScreen = () => {
  const { salon, readAgain, readingAgain } = useOwnSalon()

  return match(salon)
    .with(undefined, () => (
      <>
        <PageHeader title={import.meta.env.VITE_APP_TITLE} />
        <LoadingIndicator label='サロンを確かめています' />
      </>
    ))
    .with({ type: 'platform' }, () => <SalonChoiceScreen />)
    .with({ type: 'member' }, ({ salonId }) => (
      <Navigate to={bookingsHrefOf(salonId)} replace />
    ))
    .with({ type: 'none' }, () => <NoSalonNotice />)
    .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
      <>
        <PageHeader title={import.meta.env.VITE_APP_TITLE} />
        <UnreadNotice
          message={unreadMessageOf('所属するサロン', reason)}
          onRetry={readAgain}
          retrying={readingAgain}
        />
      </>
    ))
    .exhaustive()
}
