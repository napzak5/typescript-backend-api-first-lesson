import type {
  ModelsAuthTwoFactorSetupResponse,
  ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  Card,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import { AuthenticatorRegistration } from './components/authenticator-registration/authenticator-registration'
import { BackupCodeList } from './components/backup-code-list/backup-code-list'
import { TwoFactorPasswordForm } from './components/two-factor-password-form/two-factor-password-form'
import {
  type AccountRead,
  confirmTwoFactor,
  OWN_ACCOUNT,
  readOwnAccount,
  startTwoFactor,
} from './security-api'
import { type FormSays, NOTHING_TO_SAY, unreadMessageOf } from './security-flow'
import {
  afterRefusal,
  CHANGED_ELSEWHERE,
  readCode,
  readPassword,
  withTwoFactorStatus,
} from './two-factor-flow'

const UNSENT = P.union('tooManyRequests', 'failed')

/**
 * Where the set-up is. The secret and the backup codes are in the answer
 * that issued them and nowhere else, so the steps are held here and not in
 * the address: a reload begins anew, and the API issues new ones.
 */
type Step =
  | { type: 'password' }
  | { type: 'app'; setup: ModelsAuthTwoFactorSetupResponse }
  | { type: 'enabled'; backupCodes: readonly string[] }

type SetupProps = {
  user: ModelsUserResponse
  securityHref: string
}

const Setup = ({ user, securityHref }: SetupProps) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [step, setStep] = useState<Step>({ type: 'password' })
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const heading = useRef<HTMLHeadingElement>(null)
  /** The second factor was turned on before the set-up began, here or elsewhere */
  const onAlready =
    step.type === 'password' && user.twoFactorStatus === 'enabled'
  /** What the screen shows: a step, or that there is nothing to set up */
  const showing = onAlready ? 'onAlready' : step.type
  const shownBefore = useRef(showing)

  // In the commit that shows another step, before the browser paints: what
  // had the focus went with the step before, on an answer of the API or
  // when the account was read anew
  useLayoutEffect(() => {
    const another = showing !== shownBefore.current
    shownBefore.current = showing
    const focusLost =
      document.activeElement === null ||
      document.activeElement === document.body
    if (another && focusLost) {
      heading.current?.focus()
    }
  }, [showing])

  const moveTo = (next: Step): void => {
    setSays(NOTHING_TO_SAY)
    setStep(next)
  }

  /** The second factor was changed elsewhere: the account is read again, and the set-up begins anew. */
  const changedElsewhere = (): void => {
    moveTo({ type: 'password' })
    void queryClient.invalidateQueries({ queryKey: OWN_ACCOUNT })
    notify({ tone: 'warning', message: CHANGED_ELSEWHERE })
  }

  const start = useMutation({
    mutationFn: startTwoFactor,
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'issued' }, ({ setup }) => moveTo({ type: 'app', setup }))
        .with({ type: 'conflict' }, changedElsewhere)
        .with(
          { type: P.union('invalid', 'tooManyRequests', 'failed') },
          (refusal) => setSays(afterRefusal(refusal, 'app')),
        )
        .exhaustive(),
  })

  const confirm = useMutation({
    mutationFn: confirmTwoFactor,
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'enabled' }, () => {
          if (step.type === 'app') {
            moveTo({ type: 'enabled', backupCodes: step.setup.backupCodes })
          }
          // The screen of the security shows the second factor on at once,
          // and not what it read before
          queryClient.setQueryData<AccountRead>(OWN_ACCOUNT, (read) =>
            withTwoFactorStatus(read, 'enabled'),
          )
          void queryClient.invalidateQueries({ queryKey: OWN_ACCOUNT })
        })
        .with({ type: 'conflict' }, changedElsewhere)
        .with(
          { type: P.union('invalid', 'tooManyRequests', 'failed') },
          (refusal) => setSays(afterRefusal(refusal, 'app')),
        )
        .exhaustive(),
  })

  const submitPassword = (values: FormData): void => {
    const read = readPassword(values)
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    start.mutate(read.value)
  }

  const submitCode = (values: FormData): void => {
    const read = readCode(values, 'app')
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    confirm.mutate(read.value)
  }

  return match(step)
    .with({ type: 'password' }, () =>
      onAlready ? (
        <Card title='2 要素認証は、すでに有効です' headingRef={heading}>
          <p>
            バックアップコードの発行し直しと、2
            要素認証を無効にすることは、アカウントの安全の画面でできます。
          </p>
          <ButtonLink href={securityHref} variant='primary'>
            アカウントの安全へ戻る
          </ButtonLink>
        </Card>
      ) : (
        <Card title='パスワードを確かめる' headingRef={heading}>
          <TwoFactorPasswordForm
            message={says.message}
            errors={says.errors}
            pending={start.isPending}
            cancelHref={securityHref}
            onSubmit={submitPassword}
          />
        </Card>
      ),
    )
    .with({ type: 'app' }, ({ setup }) => (
      <AuthenticatorRegistration
        qrCodeUrl={setup.qrCodeUrl}
        secret={setup.secret}
        message={says.message}
        errors={says.errors}
        pending={confirm.isPending}
        cancelHref={securityHref}
        onSubmit={submitCode}
        headingRef={heading}
      />
    ))
    .with({ type: 'enabled' }, ({ backupCodes }) => (
      <Card title='2 要素認証を有効にしました' headingRef={heading}>
        <p>
          次のサインインから、パスワードに加えて、認証アプリのコードを確かめます。有効にしたことを、メールでお知らせしました。
        </p>
        <p>
          認証アプリを使えないときのための、バックアップコードです。それぞれ 1
          回だけ、認証アプリのコードの代わりに使えます。この画面を離れると、二度と表示されません。印刷するか、パスワードマネージャーなどの安全な場所に控えてください。控えをなくしたときは、認証アプリのコードで、アカウントの安全の画面から発行し直せます。
        </p>
        <BackupCodeList codes={backupCodes} />
        <ButtonLink href={securityHref} variant='primary'>
          アカウントの安全へ戻る
        </ButtonLink>
      </Card>
    ))
    .exhaustive()
}

export type TwoFactorSetupScreenProps = {
  /** The address of the screen of the security of the account: the way back */
  securityHref: string
}

/**
 * Sets up the second factor of the account of the session: the password,
 * then the authenticator app takes the secret and its code confirms it,
 * then the backup codes. An account whose second factor is on is told so.
 */
export const TwoFactorSetupScreen = ({
  securityHref,
}: TwoFactorSetupScreenProps) => {
  const read = useQuery({
    queryKey: OWN_ACCOUNT,
    queryFn: readOwnAccount,
    // The second factor is set up on other devices too
    staleTime: 0,
  })

  return (
    <>
      <PageHeader
        title='2 要素認証を設定する'
        description='サインインのときに、パスワードに加えて、スマートフォンの認証アプリが表示するコードを確かめるようにします。パスワードが知られても、サインインされません。'
      />
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='アカウントを読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ user }) => (
          <Setup user={user} securityHref={securityHref} />
        ))
        .with({ type: UNSENT }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('アカウント', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}
