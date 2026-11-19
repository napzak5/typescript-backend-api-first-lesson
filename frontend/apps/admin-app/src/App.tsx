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
import { Link, Route, Routes } from 'react-router'

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
        account={<SessionAccount />}
      >
        {/* Every screen needs a session: who is not signed in signs in here, at the address they asked for */}
        <RequireSession roles={ROLES}>
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='*' element={<NotFoundPage />} />
          </Routes>
        </RequireSession>
      </AppShell>
    </NotificationProvider>
    <EnvironmentBanner environment={import.meta.env.VITE_MODE} />
  </LinkProvider>
)
