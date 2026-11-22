import { AppFrame, NotFoundPage } from '@beauty-salon-frontend/app-frame'
import { applications } from '@beauty-salon-frontend/brand'
import { RequireSession, SessionAccount } from '@beauty-salon-frontend/session'
import { Navigate, Route, Routes, useSearchParams } from 'react-router'
import { AcceptStaffInvitationScreen } from './account/screens/accept-staff-invitation-screen'
import { ForgotPasswordScreen } from './account/screens/forgot-password-screen'
import { RegisterScreen } from './account/screens/register-screen'
import { ResetPasswordScreen } from './account/screens/reset-password-screen'
import { VerifyEmailScreen } from './account/screens/verify-email-screen'
import { BookingDetailScreen } from './bookings/screens/booking-detail-screen'
import { BookingMoveScreen } from './bookings/screens/booking-move-screen'
import { BookingScreen } from './bookings/screens/booking-screen'
import { OwnBookingsScreen } from './bookings/screens/own-bookings-screen'
import { navigationFor } from './navigation'
import { PreferencesScreen } from './preferences/screens/preferences-screen'
import { MyPageScreen } from './profile/screens/my-page-screen'
import { ProfileScreen } from './profile/screens/profile-screen'
import { OwnReviewsScreen } from './reviews/screens/own-reviews-screen'
import { ReviewChangeScreen } from './reviews/screens/review-change-screen'
import { ReviewWriteScreen } from './reviews/screens/review-write-screen'
import { SalonScreen } from './salons/screens/salon-screen'
import { SalonSearchScreen } from './salons/screens/salon-search-screen'
import {
  OwnPasswordScreen,
  OwnSecurityScreen,
  OwnTwoFactorScreen,
  PASSWORD_PATH,
  SECURITY_PATH,
  TWO_FACTOR_PATH,
} from './security/screens/security-screens'
import { SignInHelp } from './session/screens/sign-in-help'
import { EVERY_ROLE } from './session/utils/roles'
import { pathAfterSignIn, SIGN_IN_PATH } from './session/utils/sign-in-path'
import { SharedFileScreen } from './share/screens/shared-file-screen'

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

export const App = () => (
  <AppFrame
    title={applications.portal.name}
    account={<SessionAccount signInHref={SIGN_IN_PATH} />}
    navigationFor={navigationFor}
    environment={import.meta.env.VITE_MODE}
  >
    <Routes>
      <Route path='/' element={<SalonSearchScreen />} />
      <Route path='/salons/:salonId' element={<SalonScreen />} />
      <Route
        path='/salons/:salonId/services/:serviceId/booking'
        element={<BookingScreen />}
      />
      <Route path='/bookings' element={<OwnBookingsScreen />} />
      <Route path='/bookings/:bookingId' element={<BookingDetailScreen />} />
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
  </AppFrame>
)
