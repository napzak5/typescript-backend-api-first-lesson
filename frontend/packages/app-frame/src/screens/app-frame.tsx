import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  AppShell,
  EnvironmentBanner,
  type EnvironmentBannerProps,
  type LinkComponent,
  LinkProvider,
  type NavigationItem,
  NotificationProvider,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'

/**
 * The links of the header of an application, for the role of who is signed
 * in (`undefined`: nobody is, or it is not known yet) and the address: a
 * pure function of the application (`navigationFor` in its `navigation.ts`).
 */
export type NavigationOf = (
  role: ModelsUserResponse['role'] | undefined,
  pathname: string,
) => readonly NavigationItem[]

export type AppFrameProps = {
  /** The name of the application: that of `applications` of the brand package */
  title: string
  /** What belongs to who is signed in, at the end of the header: a `SessionAccount` */
  account: ReactNode
  navigationFor: NavigationOf
  /** The environment the page belongs to (`VITE_MODE`): named in a corner, but for production */
  environment: EnvironmentBannerProps['environment']
  /** The screens: the routes of the application */
  children: ReactNode
}

/** The links that the shared components draw move within the application */
const RouterLink: LinkComponent = ({ href, ...rest }) => (
  <Link {...rest} to={href} />
)

/**
 * The frame of an application, around its routes: the links of the shared
 * components as links of the router, the notifications, the header with the
 * links of who is signed in at the address that is shown, and the name of
 * the environment. It stands inside the router and the `QueryClientProvider`
 * (`startApplication`).
 */
export const AppFrame = ({
  title,
  account,
  navigationFor,
  environment,
  children,
}: AppFrameProps) => {
  const session = useSession()
  const { pathname } = useLocation()

  return (
    <LinkProvider component={RouterLink}>
      <NotificationProvider>
        <AppShell
          title={title}
          account={account}
          navigation={navigationFor(
            session.type === 'signedIn' ? session.user.role : undefined,
            pathname,
          )}
        >
          {children}
        </AppShell>
      </NotificationProvider>
      <EnvironmentBanner environment={environment} />
    </LinkProvider>
  )
}
