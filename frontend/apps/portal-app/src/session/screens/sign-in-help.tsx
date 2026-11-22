import { Link } from 'react-router'

/** The ways on for somebody who cannot sign in: to a new password, to a new account. */
export const SignInHelp = () => (
  <>
    <p>
      <Link to='/forgot-password'>パスワードを忘れた場合</Link>
    </p>
    <p>
      はじめての方は、<Link to='/register'>アカウントを登録</Link>
      してください。
    </p>
  </>
)
