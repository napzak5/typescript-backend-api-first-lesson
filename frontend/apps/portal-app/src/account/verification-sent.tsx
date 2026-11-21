import {
  Alert,
  Button,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { sendVerificationAgain } from './account-api'
import { messageAfter } from './account-flow'

type VerificationSentProps = {
  /** The address that was typed. Whether it has an account is not known here */
  email: string
}

/**
 * What a person reads after asking for the mail that confirms an address.
 * It says the same whether or not a mail was sent: the API answers alike
 * for an address that has an account and for one that has none, and so
 * does the screen.
 */
export const VerificationSent = ({ email }: VerificationSentProps) => {
  const { notify } = useNotifications()
  const [message, setMessage] = useState<string | undefined>(undefined)
  const sending = useMutation({
    mutationFn: sendVerificationAgain,
    onSuccess: (outcome) => {
      if (outcome.type === 'accepted') {
        setMessage(undefined)
        notify({
          tone: 'success',
          message:
            '確認メールの再送を受け付けました。届くまで、しばらくお待ちください。',
        })
        return
      }
      setMessage(messageAfter(outcome))
    },
  })

  return (
    <>
      <PageHeader title='確認メールを送りました' />
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      <p>
        {email}{' '}
        に、確認メールを送りました。メールのリンクを開くと、登録が完了します。リンクは
        24 時間有効です。
      </p>
      <p>
        メールが届かないときは、迷惑メールのフォルダーをお確かめください。すでにアカウントのあるメールアドレスには、確認メールは届きません。その場合は、
        <Link to='/sign-in'>サインイン</Link>するか、
        <Link to='/forgot-password'>パスワードを再設定</Link>
        してください。
      </p>
      <p>
        <Button
          pending={sending.isPending}
          onClick={() => sending.mutate(email)}
        >
          確認メールをもう一度送る
        </Button>
      </p>
      <p>続けて送れるのは、1 分に 1 回までです。</p>
    </>
  )
}
