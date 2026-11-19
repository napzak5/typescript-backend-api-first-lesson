import {
  AccountSecurityScreen,
  PasswordChangeScreen,
  RequireSession,
  type RequireSessionProps,
  SessionAccount,
  TwoFactorSetupScreen,
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
import { Link, Route, Routes, useNavigate } from 'react-router'

/** Who this application is for: the people who work at a salon, and the operator of the platform */
const ROLES: RequireSessionProps['roles'] = [
  'owner',
  'manager',
  'staff',
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

/**
 * The way on for somebody who cannot sign in. A password is set anew in the
 * portal, where the link of the mail leads for every account.
 */
const SignInHelp = () => (
  <p>
    <a href={`${import.meta.env.VITE_PORTAL_APP_URL}/forgot-password`}>
      パスワードを忘れた場合
    </a>
  </p>
)

/** Where the screens of the security of the account are: the header leads to them */
const SECURITY_PATH = '/account/security'
const PASSWORD_PATH = `${SECURITY_PATH}/password`
const TWO_FACTOR_PATH = `${SECURITY_PATH}/two-factor`

const PasswordPage = () => {
  const navigate = useNavigate()

  return (
    <PasswordChangeScreen
      securityHref={SECURITY_PATH}
      onChanged={() => void navigate(SECURITY_PATH)}
    />
  )
}

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
        account={<SessionAccount securityHref={SECURITY_PATH} />}
      >
        {/* Every screen needs a session: who is not signed in signs in here, at the address they asked for */}
        <RequireSession roles={ROLES} signInHelp={<SignInHelp />}>
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route
              path={SECURITY_PATH}
              element={
                <AccountSecurityScreen
                  passwordHref={PASSWORD_PATH}
                  twoFactorHref={TWO_FACTOR_PATH}
                />
              }
            />
            <Route path={PASSWORD_PATH} element={<PasswordPage />} />
            <Route
              path={TWO_FACTOR_PATH}
              element={<TwoFactorSetupScreen securityHref={SECURITY_PATH} />}
            />
            <Route path='*' element={<NotFoundPage />} />
          </Routes>
        </RequireSession>
      </AppShell>
    </NotificationProvider>
    <EnvironmentBanner environment={import.meta.env.VITE_MODE} />
  </LinkProvider>
)
