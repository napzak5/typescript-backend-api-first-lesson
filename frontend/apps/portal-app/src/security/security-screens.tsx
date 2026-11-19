import {
  AccountSecurityScreen,
  PasswordChangeScreen,
  RequireSession,
} from '@beauty-salon-frontend/session'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { useNavigate } from 'react-router'
import { CUSTOMERS } from '../roles'
import { SignInHelp } from '../sign-in-help'

/** Where the screens of the security of the account are: below the page of the customer. */
export const SECURITY_PATH = '/mypage/security'
export const PASSWORD_PATH = `${SECURITY_PATH}/password`

/**
 * How the account of the customer is kept from others: the password, the
 * second factor and the devices that are signed in.
 */
export const OwnSecurityScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='アカウントの安全を確かめるには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <AccountSecurityScreen
      passwordHref={PASSWORD_PATH}
      actions={
        <ButtonLink href='/mypage' variant='secondary'>
          マイページへ戻る
        </ButtonLink>
      }
    />
  </RequireSession>
)

const OwnPassword = () => {
  const navigate = useNavigate()

  return (
    <PasswordChangeScreen
      securityHref={SECURITY_PATH}
      onChanged={() => void navigate(SECURITY_PATH)}
    />
  )
}

/** Changes the password of the customer, and leads back to the security of the account. */
export const OwnPasswordScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='パスワードを変更するには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <OwnPassword />
  </RequireSession>
)
