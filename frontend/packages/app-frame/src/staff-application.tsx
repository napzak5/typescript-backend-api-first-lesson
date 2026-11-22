import {
  AccountSecurityScreen,
  RequireSession,
  type RequireSessionProps,
  SessionAccount,
  TwoFactorSetupScreen,
} from '@beauty-salon-frontend/session'
import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router'
import { AppFrame, type AppFrameProps } from './app-frame'
import { NotFoundPage } from './components/not-found-page/not-found-page'
import { PasswordChangePage } from './password-change-page'

/** Where the screens of the security of the account are: the header leads to them */
const SECURITY_PATH = '/account/security'
const PASSWORD_PATH = `${SECURITY_PATH}/password`
const TWO_FACTOR_PATH = `${SECURITY_PATH}/two-factor`

export type StaffApplicationProps = Pick<
  AppFrameProps,
  'title' | 'navigationFor' | 'environment'
> & {
  /** Who the application is for */
  roles: RequireSessionProps['roles']
  /** The address of the portal (`VITE_PORTAL_APP_URL`), where a password is set anew */
  portalUrl: string
  /**
   * The routes of the application (`Route`). The screens of the security
   * of the account and the screen of an address that is none follow them
   */
  children: ReactNode
}

/**
 * An application for those who work at a salon and for the operator of the
 * platform (the admin and the dashboard application): every screen needs a
 * session of one of `roles`. Who is not signed in signs in at the address
 * they asked for, and is led to the portal for a new password: the link of
 * the mail leads there for every account. The header leads to the security
 * of the account, whose screens are at `/account/security`.
 */
export const StaffApplication = ({
  title,
  navigationFor,
  environment,
  roles,
  portalUrl,
  children,
}: StaffApplicationProps) => (
  <AppFrame
    title={title}
    account={<SessionAccount securityHref={SECURITY_PATH} />}
    navigationFor={navigationFor}
    environment={environment}
  >
    <RequireSession
      roles={roles}
      signInHelp={
        <p>
          <a href={`${portalUrl}/forgot-password`}>パスワードを忘れた場合</a>
        </p>
      }
    >
      <Routes>
        {children}
        <Route
          path={SECURITY_PATH}
          element={
            <AccountSecurityScreen
              passwordHref={PASSWORD_PATH}
              twoFactorHref={TWO_FACTOR_PATH}
            />
          }
        />
        <Route
          path={PASSWORD_PATH}
          element={<PasswordChangePage securityHref={SECURITY_PATH} />}
        />
        <Route
          path={TWO_FACTOR_PATH}
          element={<TwoFactorSetupScreen securityHref={SECURITY_PATH} />}
        />
        <Route path='*' element={<NotFoundPage />} />
      </Routes>
    </RequireSession>
  </AppFrame>
)
