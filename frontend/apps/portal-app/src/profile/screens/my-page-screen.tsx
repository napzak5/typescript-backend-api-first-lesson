import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import { RequireSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import {
  portalFrameMessages,
  portalProfileMessages,
} from '@beauty-salon-shared/i18n/messages/portal'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useQuery } from '@tanstack/react-query'
import { match, P } from 'ts-pattern'
import { OwnPreferences } from '../../preferences/screens/own-preferences'
import { SECURITY_PATH } from '../../security/screens/security-screens'
import { SignInHelp } from '../../session/screens/sign-in-help'
import { CUSTOMERS } from '../../session/utils/roles'
import { OWN_PROFILE, readOwnProfile } from '../api/profile-api'
import { MembershipDetails } from '../components/membership-details/membership-details'
import { ProfileDetails } from '../components/profile-details/profile-details'

const {
  myPage: words,
  membership,
  profile: profileWords,
  names,
} = portalProfileMessages

const OwnPage = () => {
  const say = useSay()
  const read = useQuery({
    queryKey: OWN_PROFILE,
    queryFn: readOwnProfile,
    // The salons change what they keep of a member (the rank, the points,
    // the visits): what is shown is read whenever the screen opens
    staleTime: 0,
  })

  return (
    <>
      <PageHeader title={say(portalFrameMessages.navigation.myPage)} />
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(profileWords.loading)} />
        ))
        .with({ type: 'found' }, ({ profile }) => (
          <>
            <Card title={say(membership.title)}>
              <MembershipDetails profile={profile} />
            </Card>
            <Card title={say(words.profile)}>
              <ProfileDetails profile={profile} />
              <ButtonLink href='/mypage/profile'>
                {say(words.change)}
              </ButtonLink>
            </Card>
            <OwnPreferences />
            <Card title={say(words.reviews)}>
              <p>{say(words.reviewsDescription)}</p>
              <ButtonLink href='/mypage/reviews'>
                {say(words.toReviews)}
              </ButtonLink>
            </Card>
          </>
        ))
        .with({ type: 'none' }, () => (
          <EmptyState
            title={say(words.none)}
            description={say(words.noneDescription)}
            actions={
              <ButtonLink href='/mypage/profile'>
                {say(words.register)}
              </ButtonLink>
            }
          />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.profile, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
      {/* The account is there whether or not the customer said who they are */}
      <Card title={say(securityMessages.accountSecurity)}>
        <p>{say(words.securityDescription)}</p>
        <ButtonLink href={SECURITY_PATH}>{say(words.toSecurity)}</ButtonLink>
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
export const MyPageScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(words.signInNotice)}
      signInHelp={<SignInHelp />}
    >
      <OwnPage />
    </RequireSession>
  )
}
