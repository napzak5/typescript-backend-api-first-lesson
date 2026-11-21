import { unreadMessageOf } from '@beauty-salon-frontend/answers'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { OwnPreferences } from '../preferences/own-preferences'
import { CUSTOMERS } from '../roles'
import { SECURITY_PATH } from '../security/security-screens'
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
              <ButtonLink href='/mypage/profile'>
                お客様の情報を変更する
              </ButtonLink>
            </Card>
            <OwnPreferences />
            <Card title='レビュー'>
              <p>
                来店したサロンに書いたレビューを確かめ、変更し、削除できます。
              </p>
              <ButtonLink href='/mypage/reviews'>
                自分のレビューを見る
              </ButtonLink>
            </Card>
          </>
        ))
        .with({ type: 'none' }, () => (
          <EmptyState
            title='お客様の情報は、まだ登録されていません'
            description='お名前と電話番号を登録すると、サロンを予約できます。会員の情報も、ここに表示されます。'
            actions={
              <ButtonLink href='/mypage/profile'>
                お客様の情報を登録する
              </ButtonLink>
            }
          />
        ))
        .with({ type: UNREAD }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('お客様の情報', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
      {/* The account is there whether or not the customer said who they are */}
      <Card title='アカウントの安全'>
        <p>
          パスワードの変更と、このアカウントでサインインしている端末の確認ができます。
        </p>
        <ButtonLink href={SECURITY_PATH}>アカウントの安全を確かめる</ButtonLink>
      </Card>
    </>
  )
}

/**
 * What the salons know of the customer who is signed in: what they keep of
 * a member, what the customer said about themselves, and what the customer
 * wants them to keep in mind, each with the way to change it; the way to
 * what the customer wrote about the salons; and the way to the security of
 * the account.
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
