import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsAuthTwoFactorSetupResponse,
  ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  Card,
  type FormSays,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import {
  type AccountRead,
  confirmTwoFactor,
  OWN_ACCOUNT,
  readOwnAccount,
  startTwoFactor,
} from '../api/security-api'
import { AuthenticatorRegistration } from '../components/authenticator-registration/authenticator-registration'
import { BackupCodeList } from '../components/backup-code-list/backup-code-list'
import { TwoFactorPasswordForm } from '../components/two-factor-password-form/two-factor-password-form'
import {
  afterRefusal,
  CHANGED_ELSEWHERE,
  readCode,
  readPassword,
  withTwoFactorStatus,
} from '../utils/two-factor-flow'

const { twoFactor } = securityMessages

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
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [step, setStep] = useState<Step>({ type: 'password' })
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
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
        <Card title={say(twoFactor.alreadyOn)} headingRef={heading}>
          <p>{say(twoFactor.alreadyOnDescription)}</p>
          <ButtonLink href={securityHref} variant='primary'>
            {say(securityMessages.backToSecurity)}
          </ButtonLink>
        </Card>
      ) : (
        <Card title={say(twoFactor.confirmPassword)} headingRef={heading}>
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
      <Card title={say(twoFactor.turnedOn)} headingRef={heading}>
        <p>{say(twoFactor.turnedOnDescription)}</p>
        <p>{say(twoFactor.backupCodesDescription)}</p>
        <BackupCodeList codes={backupCodes} />
        <ButtonLink href={securityHref} variant='primary'>
          {say(securityMessages.backToSecurity)}
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
  const say = useSay()
  const read = useQuery({
    queryKey: OWN_ACCOUNT,
    queryFn: readOwnAccount,
    // The second factor is set up on other devices too
    staleTime: 0,
  })

  return (
    <>
      <PageHeader
        title={say(twoFactor.setUp)}
        description={say(twoFactor.setUpDescription)}
      />
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(securityMessages.loadingAccount)} />
        ))
        .with({ type: 'found' }, ({ user }) => (
          <Setup user={user} securityHref={securityHref} />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(
              unreadMessageOf(securityMessages.names.account, reason),
            )}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}
