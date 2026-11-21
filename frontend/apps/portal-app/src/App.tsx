import { applications } from '@beauty-salon-frontend/brand'
import {
  RequireSession,
  SessionAccount,
  useSession,
} from '@beauty-salon-frontend/session'
import {
  AppShell,
  ButtonLink,
  EnvironmentBanner,
  type LinkComponent,
  LinkProvider,
  NotificationProvider,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router'
import { AcceptStaffInvitationScreen } from './account/accept-staff-invitation-screen'
import { ForgotPasswordScreen } from './account/forgot-password-screen'
import { RegisterScreen } from './account/register-screen'
import { ResetPasswordScreen } from './account/reset-password-screen'
import { VerifyEmailScreen } from './account/verify-email-screen'
import { BookingDetailScreen } from './bookings/booking-detail-screen'
import { BookingMoveScreen } from './bookings/booking-move-screen'
import { BookingScreen } from './bookings/booking-screen'
import { OwnBookingsScreen } from './bookings/own-bookings-screen'
import { navigationFor } from './navigation'
import { PreferencesScreen } from './preferences/preferences-screen'
import { MyPageScreen } from './profile/my-page-screen'
import { ProfileScreen } from './profile/profile-screen'
import { OwnReviewsScreen } from './reviews/own-reviews-screen'
import { ReviewChangeScreen } from './reviews/review-change-screen'
import { ReviewWriteScreen } from './reviews/review-write-screen'
import { EVERY_ROLE } from './roles'
import { SalonScreen } from './salons/salon-screen'
import { SalonSearchScreen } from './salons/salon-search-screen'
import {
  OwnPasswordScreen,
  OwnSecurityScreen,
  OwnTwoFactorScreen,
  PASSWORD_PATH,
  SECURITY_PATH,
  TWO_FACTOR_PATH,
} from './security/security-screens'
import { SharedFileScreen } from './share/shared-file-screen'
import { SignInHelp } from './sign-in-help'
import { pathAfterSignIn, SIGN_IN_PATH } from './sign-in-path'

/** The links that the shared components draw move within the application */
const RouterLink: LinkComponent = ({ href, ...rest }) => (
  <Link {...rest} to={href} />
)

/**
 * The sign-in screen, and for somebody who is signed in the way on: to the
 * page that sent them here, or to the start.
 */
const SignInPage = () => {
  const [query] = useSearchParams()

  return (
    <RequireSession roles={EVERY_ROLE} signInHelp={<SignInHelp />}>
      <Navigate to={pathAfterSignIn(query)} replace />
    </RequireSession>
  )
}

const NotFoundPage = () => (
  <>
    <PageHeader
      title='ページが見つかりません'
      description='アドレスが正しいか、お確かめください。'
    />
    <ButtonLink href='/'>トップへ戻る</ButtonLink>
  </>
)

export const App = () => {
  const session = useSession()
  const { pathname } = useLocation()
  const items = navigationFor(
    session.type === 'signedIn' ? session.user.role : undefined,
    pathname,
  )

  return (
    <LinkProvider component={RouterLink}>
      <NotificationProvider>
        <AppShell
          title={applications.portal.name}
          account={<SessionAccount signInHref={SIGN_IN_PATH} />}
          navigation={items}
        >
          <Routes>
            <Route path='/' element={<SalonSearchScreen />} />
            <Route path='/salons/:salonId' element={<SalonScreen />} />
            <Route
              path='/salons/:salonId/services/:serviceId/booking'
              element={<BookingScreen />}
            />
            <Route path='/bookings' element={<OwnBookingsScreen />} />
            <Route
              path='/bookings/:bookingId'
              element={<BookingDetailScreen />}
            />
            <Route
              path='/bookings/:bookingId/reschedule'
              element={<BookingMoveScreen />}
            />
            <Route
              path='/bookings/:bookingId/review'
              element={<ReviewWriteScreen />}
            />
            <Route path='/mypage' element={<MyPageScreen />} />
            <Route path='/mypage/profile' element={<ProfileScreen />} />
            <Route path='/mypage/preferences' element={<PreferencesScreen />} />
            <Route path='/mypage/reviews' element={<OwnReviewsScreen />} />
            <Route path={SECURITY_PATH} element={<OwnSecurityScreen />} />
            <Route path={PASSWORD_PATH} element={<OwnPasswordScreen />} />
            <Route path={TWO_FACTOR_PATH} element={<OwnTwoFactorScreen />} />
            <Route
              path='/mypage/reviews/:reviewId'
              element={<ReviewChangeScreen />}
            />
            <Route path={SIGN_IN_PATH} element={<SignInPage />} />
            <Route path='/register' element={<RegisterScreen />} />
            <Route path='/forgot-password' element={<ForgotPasswordScreen />} />
            {/* The addresses of the links that the API mails */}
            <Route path='/verify-email' element={<VerifyEmailScreen />} />
            <Route path='/reset-password' element={<ResetPasswordScreen />} />
            <Route
              path='/accept-staff-invitation'
              element={<AcceptStaffInvitationScreen />}
            />
            {/* The address of the share links that a salon gives */}
            <Route path='/share' element={<SharedFileScreen />} />
            <Route path='*' element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </NotificationProvider>
      <EnvironmentBanner environment={import.meta.env.VITE_MODE} />
    </LinkProvider>
  )
}
