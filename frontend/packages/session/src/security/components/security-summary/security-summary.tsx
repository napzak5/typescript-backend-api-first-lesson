import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import { match } from 'ts-pattern'
import { passwordChangedOf, twoFactorStateOf } from '../../security-format'
import styles from './security-summary.module.css'

export type SecuritySummaryProps = {
  /** The account of the session, as the API has it now */
  user: ModelsUserResponse
  /** The address of the screen that changes the password */
  passwordHref: string
  /** The address of the screen that sets the second factor up */
  twoFactorHref: string
  /** The second factor is on, and new backup codes are asked for */
  onIssueBackupCodes: () => void
  /** The second factor is on, and is to be turned off */
  onStopTwoFactor: () => void
  /** The heading of the second factor, which takes the focus when its buttons go */
  twoFactorHeadingRef?: Ref<HTMLHeadingElement> | undefined
  /** The time zone of whoever reads: the moment the password was changed is said in it */
  timeZone: string
}

/**
 * How the account is kept from others: its password, with the way to change
 * it, and whether the sign-in also asks for the code of an authenticator
 * app, with what can be done about it in that state: set it up, set it up
 * anew, or issue new backup codes and turn it off.
 */
export const SecuritySummary = ({
  user,
  passwordHref,
  twoFactorHref,
  onIssueBackupCodes,
  onStopTwoFactor,
  twoFactorHeadingRef,
  timeZone,
}: SecuritySummaryProps) => {
  const twoFactor = twoFactorStateOf(user.twoFactorStatus)

  return (
    <>
      <Card title='パスワード'>
        <DescriptionList
          items={[
            {
              term: '最後に変更した日時',
              description: passwordChangedOf(user, timeZone),
            },
          ]}
        />
        <p>
          <ButtonLink href={passwordHref}>パスワードを変更する</ButtonLink>
        </p>
      </Card>
      <Card title='2 要素認証' headingRef={twoFactorHeadingRef}>
        <DescriptionList
          items={[
            {
              term: '状態',
              description: (
                <Badge tone={twoFactor.tone}>{twoFactor.label}</Badge>
              ),
            },
          ]}
        />
        <p>{twoFactor.description}</p>
        <p className={styles['actions']}>
          {match(user.twoFactorStatus)
            .with('disabled', () => (
              <ButtonLink href={twoFactorHref}>2 要素認証を設定する</ButtonLink>
            ))
            .with('pending', () => (
              <ButtonLink href={twoFactorHref}>設定をやり直す</ButtonLink>
            ))
            .with('enabled', () => (
              <>
                <Button onClick={onIssueBackupCodes}>
                  バックアップコードを発行し直す
                </Button>
                <Button variant='danger' onClick={onStopTwoFactor}>
                  2 要素認証を無効にする
                </Button>
              </>
            ))
            .exhaustive()}
        </p>
      </Card>
    </>
  )
}
