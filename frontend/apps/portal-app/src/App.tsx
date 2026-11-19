import {
  RequireSession,
  type RequireSessionProps,
  SessionAccount,
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
import { Link, Navigate, Route, Routes } from 'react-router'

/** Where a visitor signs in: the screens of this application are for everybody unless they say otherwise */
const SIGN_IN_PATH = '/sign-in'

/** Anybody with an account signs in here; a screen for customers alone asks for that role itself */
const ANY_ROLE: RequireSessionProps['roles'] = [
  'customer',
  'staff',
  'manager',
  'owner',
  'admin',
]

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

/** The sign-in screen, and for somebody who is signed in the way back to the start. */
const SignInPage = () => (
  <RequireSession roles={ANY_ROLE}>
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
          <Route path='*' element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </NotificationProvider>
    <EnvironmentBanner environment={import.meta.env.VITE_MODE} />
  </LinkProvider>
)
