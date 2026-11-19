import {
  AppShell,
  ButtonLink,
  EnvironmentBanner,
  type LinkComponent,
  LinkProvider,
  PageHeader,
} from '@beauty-salon-frontend/ui'
import { Link, Route, Routes } from 'react-router'

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
    <AppShell title={import.meta.env.VITE_APP_TITLE}>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='*' element={<NotFoundPage />} />
      </Routes>
    </AppShell>
    <EnvironmentBanner environment={import.meta.env.VITE_MODE} />
  </LinkProvider>
)
