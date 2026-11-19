import { RequireSession, SessionAccount } from '@beauty-salon-frontend/session'
import {
  AppShell,
  ButtonLink,
  EnvironmentBanner,
  type LinkComponent,
  LinkProvider,
  NotificationProvider,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import { Link, Navigate, Route, Routes } from 'react-router'
import { AcceptStaffInvitationScreen } from './account/accept-staff-invitation-screen'
import { ForgotPasswordScreen } from './account/forgot-password-screen'
import { RegisterScreen } from './account/register-screen'
import { ResetPasswordScreen } from './account/reset-password-screen'
import { VerifyEmailScreen } from './account/verify-email-screen'
import { EVERY_ROLE } from './roles'

/** Where a visitor signs in: the screens of this application are for everybody unless they say otherwise */
const SIGN_IN_PATH = '/sign-in'

/** The links that the shared components draw move within the application */
const RouterLink: LinkComponent = ({ href, ...rest }) => (
  <Link {...rest} to={href} />
)

const HomePage = () => (
  <>
    <PageHeader title={import.meta.env.VITE_APP_TITLE} />
    <p>画面は準備中です。</p>
  </>
)

/** The ways on for somebody who cannot sign in: to a new account, to a new password. */
const SignInHelp = () => (
  <>
    <p>
      <Link to='/forgot-password'>パスワードを忘れた場合</Link>
    </p>
    <p>
      はじめての方は、<Link to='/register'>アカウントを登録</Link>
      してください。
    </p>
  </>
)

/** The sign-in screen, and for somebody who is signed in the way back to the start. */
const SignInPage = () => (
  <RequireSession roles={EVERY_ROLE} signInHelp={<SignInHelp />}>
    <Navigate to='/' replace />
  </RequireSession>
)

const NotFoundPage = () => (
  <>
    <PageHeader
      title='ページが見つかりません'
      description='アドレスが正しいか、お確かめください。'
    />
    <p>
      <ButtonLink href='/' variant='secondary'>
        トップへ戻る
      </ButtonLink>
    </p>
  </>
)

export const App = () => (
  <LinkProvider component={RouterLink}>
    <NotificationProvider>
      <AppShell
        title={import.meta.env.VITE_APP_TITLE}
        account={<SessionAccount signInHref={SIGN_IN_PATH} />}
      >
        <Routes>
          <Route path='/' element={<HomePage />} />
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
          <Route path='*' element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </NotificationProvider>
    <EnvironmentBanner environment={import.meta.env.VITE_MODE} />
  </LinkProvider>
)
