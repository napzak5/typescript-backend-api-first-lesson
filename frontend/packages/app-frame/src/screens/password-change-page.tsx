import { PasswordChangeScreen } from '@beauty-salon-frontend/session'
import { useNavigate } from 'react-router'

export type PasswordChangePageProps = {
  /** The screen of the security of the account, in this application */
  securityHref: string
}

/**
 * The change of the password of who is signed in, at a route of an
 * application: after the change it goes back to the security of the
 * account, which then says when the password was changed.
 */
export const PasswordChangePage = ({
  securityHref,
}: PasswordChangePageProps) => {
  const navigate = useNavigate()

  return (
    <PasswordChangeScreen
      securityHref={securityHref}
      onChanged={() => void navigate(securityHref)}
    />
  )
}
