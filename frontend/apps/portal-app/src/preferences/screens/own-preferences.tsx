import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import {
  PreferencesDetails,
  staffNamed,
} from '@beauty-salon-frontend/preferences'
import {
  ButtonLink,
  Card,
  LoadingIndicator,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { portalPreferenceMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { OWN_PREFERENCES, readOwnPreferences } from '../api/preferences-api'

/**
 * The part of the page of a customer that shows what they want the salons
 * to keep in mind, with the way to change it. It reads for itself: when it
 * cannot be read, the rest of the page is there.
 */
const words = portalPreferenceMessages

export const OwnPreferences = () => {
  const say = useSay()
  const read = useQuery({
    queryKey: OWN_PREFERENCES,
    queryFn: readOwnPreferences,
    // A salon writes the preferences of its customers as well, and the
    // staff they name come and go: what is shown is read whenever the page
    // opens
    staleTime: 0,
  })

  return (
    <Card title={say(words.title)}>
      {match(read.data)
        .with(undefined, () => <LoadingIndicator label={say(words.loading)} />)
        .with({ type: 'found' }, ({ preferences, staff }) => (
          <>
            <PreferencesDetails
              preferences={preferences}
              staffNames={(ids) => staffNamed(ids, staff)}
            />
            <ButtonLink href='/mypage/preferences'>
              {say(words.change)}
            </ButtonLink>
          </>
        ))
        // The page shows this part for an account that has a profile. One
        // that lost it since the page was read has no preferences to show
        .with({ type: 'none' }, () => <p>{say(words.withoutProfile)}</p>)
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(words.names.preferences, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}
