import { RequireSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingIndicator,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { CUSTOMERS } from '../roles'
import { UnreadNotice } from '../salons/unread-notice'
import { SignInHelp } from '../sign-in-help'
import { MembershipDetails } from './components/membership-details/membership-details'
import { ProfileDetails } from './components/profile-details/profile-details'
import { OWN_PROFILE, readOwnProfile } from './profile-api'

const TITLE = 'マイページ'

const UNREAD = P.union('tooManyRequests', 'failed')

const OwnPage = () => {
  const read = useQuery({
    queryKey: OWN_PROFILE,
    queryFn: readOwnProfile,
    // The salons change what they keep of a member (the rank, the points,
    // the visits): what is shown is read whenever the screen opens
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={TITLE} />
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='お客様の情報を読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ profile }) => (
          <>
            <Card title='会員の情報'>
              <MembershipDetails profile={profile} />
            </Card>
            <Card title='お客様の情報'>
              <ProfileDetails profile={profile} />
              <p>
                <ButtonLink href='/mypage/profile' variant='secondary'>
                  お客様の情報を変更する
                </ButtonLink>
              </p>
            </Card>
          </>
        ))
        .with({ type: 'none' }, () => (
          <EmptyState
            title='お客様の情報は、まだ登録されていません'
            description='お名前と電話番号を登録すると、サロンを予約できます。会員の情報も、ここに表示されます。'
            action={
              <ButtonLink href='/mypage/profile'>
                お客様の情報を登録する
              </ButtonLink>
            }
          />
        ))
        .with({ type: UNREAD }, (reason) => (
          <UnreadNotice
            what='お客様の情報'
            reason={reason}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}

/**
 * What the salons know of the customer who is signed in: what they keep of
 * a member, and what the customer said about themselves, with the way to
 * change it.
 */
export const MyPageScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='マイページを見るには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <OwnPage />
  </RequireSession>
)
