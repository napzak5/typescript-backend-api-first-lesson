import { PasswordChangePage } from '@beauty-salon-frontend/app-frame'
import {
  AccountSecurityScreen,
  RequireSession,
  TwoFactorSetupScreen,
} from '@beauty-salon-frontend/session'
import { ButtonLink, useSay } from '@beauty-salon-frontend/ui'
import { portalFrameMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { MY_PAGE } from '../../profile/screens/my-page'
import { SignInHelp } from '../../session/screens/sign-in-help'
import { CUSTOMERS } from '../../session/utils/roles'

/** Where the screens of the security of the account are: below the page of the customer. */
export const SECURITY_PATH = '/mypage/security'
export const PASSWORD_PATH = `${SECURITY_PATH}/password`
export const TWO_FACTOR_PATH = `${SECURITY_PATH}/two-factor`

const { security } = portalFrameMessages

/**
 * How the account of the customer is kept from others: the password, the
 * second factor and the devices that are signed in.
 */
export const OwnSecurityScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(security.signInNotice)}
      signInHelp={<SignInHelp />}
    >
      <AccountSecurityScreen
        passwordHref={PASSWORD_PATH}
        twoFactorHref={TWO_FACTOR_PATH}
        actions={
          <ButtonLink href={MY_PAGE}>{say(security.backToMyPage)}</ButtonLink>
        }
      />
    </RequireSession>
  )
}

/** Changes the password of the customer, and leads back to the security of the account. */
export const OwnPasswordScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(security.passwordSignInNotice)}
      signInHelp={<SignInHelp />}
    >
      <PasswordChangePage securityHref={SECURITY_PATH} />
    </RequireSession>
  )
}

/** Sets up the second factor of the account of the customer. */
export const OwnTwoFactorScreen = () => {
  const say = useSay()

  return (
    <RequireSession
      roles={CUSTOMERS}
      signInNotice={say(security.twoFactorSignInNotice)}
      signInHelp={<SignInHelp />}
    >
      <TwoFactorSetupScreen securityHref={SECURITY_PATH} />
    </RequireSession>
  )
}
