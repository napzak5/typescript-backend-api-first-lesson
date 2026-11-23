import { useSay } from '@beauty-salon-frontend/ui'
import { portalFrameMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { frameMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { Link } from 'react-router'

const { firstTimeWithLink: firstTime } = portalFrameMessages

/** The ways on for somebody who cannot sign in: to a new password, to a new account. */
export const SignInHelp = () => {
  const say = useSay()

  return (
    <>
      <p>
        <Link to='/forgot-password'>{say(frameMessages.forgotPassword)}</Link>
      </p>
      <p>
        {say(firstTime.before)}
        <Link to='/register'>{say(firstTime.link)}</Link>
        {say(firstTime.after)}
      </p>
    </>
  )
}
