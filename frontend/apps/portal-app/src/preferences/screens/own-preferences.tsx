import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import {
  PreferencesDetails,
  staffNamed,
} from '@beauty-salon-frontend/preferences'
import {
  ButtonLink,
  Card,
  inJapanese,
  LoadingIndicator,
  UnreadNotice,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { OWN_PREFERENCES, readOwnPreferences } from '../api/preferences-api'

/**
 * The part of the page of a customer that shows what they want the salons
 * to keep in mind, with the way to change it. It reads for itself: when it
 * cannot be read, the rest of the page is there.
 */
export const OwnPreferences = () => {
  const read = useQuery({
    queryKey: OWN_PREFERENCES,
    queryFn: readOwnPreferences,
    // A salon writes the preferences of its customers as well, and the
    // staff they name come and go: what is shown is read whenever the page
    // opens
    staleTime: 0,
  })

  return (
    <Card title='好みの設定'>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='好みの設定を読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ preferences, staff }) => (
          <>
            <PreferencesDetails
              preferences={preferences}
              staffNames={(ids) => staffNamed(ids, staff)}
            />
            <ButtonLink href='/mypage/preferences'>
              好みの設定を変更する
            </ButtonLink>
          </>
        ))
        // The page shows this part for an account that has a profile. One
        // that lost it since the page was read has no preferences to show
        .with({ type: 'none' }, () => (
          <p>好みの設定は、お客様の情報を登録すると使えます。</p>
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={inJapanese(
              unreadMessageOf(writtenInJapanese('好みの設定'), reason),
            )}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}
