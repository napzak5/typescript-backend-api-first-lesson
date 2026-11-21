import { NoSalonNotice, useOwnSalon } from '@beauty-salon-frontend/session'
import {
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { Navigate } from 'react-router'
import { match, P } from 'ts-pattern'
import { unreadMessageOf } from './reading'
import { SalonChoiceScreen } from './salon-choice-screen'

export type StartScreenProps = {
  /** The title of the application, while the salon of who is signed in is read */
  title: string
  /** What an administrator chooses a salon for: 「予約台帳を開くサロンを選びます。」 */
  choice: string
  /** Where the screens of a salon begin: its bookings, its sales report */
  salonHref: (salonId: string) => string
}

/**
 * The start of an application of a salon. An administrator chooses a salon
 * here; a member of a salon is led on to the screens of their salon, and
 * the address of the start is replaced, so going back does not lead here
 * again.
 */
export const StartScreen = ({ title, choice, salonHref }: StartScreenProps) => {
  const { salon, readAgain, readingAgain } = useOwnSalon()

  return match(salon)
    .with(undefined, () => (
      <>
        <PageHeader title={title} />
        <LoadingIndicator label='サロンを確かめています' />
      </>
    ))
    .with({ type: 'platform' }, () => (
      <SalonChoiceScreen
        description={choice}
        salonHref={({ id }) => salonHref(id)}
      />
    ))
    .with({ type: 'member' }, ({ salonId }) => (
      <Navigate to={salonHref(salonId)} replace />
    ))
    .with({ type: 'none' }, () => <NoSalonNotice />)
    .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
      <>
        <PageHeader title={title} />
        <UnreadNotice
          message={unreadMessageOf('所属するサロン', reason)}
          onRetry={readAgain}
          retrying={readingAgain}
        />
      </>
    ))
    .exhaustive()
}
