import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import {
  Actions,
  Badge,
  Button,
  ButtonLink,
  Card,
  DescriptionList,
  useSay,
} from '@beauty-salon-frontend/ui'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Ref } from 'react'
import { match } from 'ts-pattern'
import {
  passwordChangedOf,
  twoFactorStateOf,
} from '../../utils/security-format'

const { password, twoFactor } = securityMessages

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
  const say = useSay()
  const state = twoFactorStateOf(user.twoFactorStatus)

  return (
    <>
      <Card title={say(password.title)}>
        <DescriptionList
          items={[
            {
              term: say(password.lastChanged),
              description: say(passwordChangedOf(user, timeZone)),
            },
          ]}
        />
        <ButtonLink href={passwordHref}>{say(password.change)}</ButtonLink>
      </Card>
      <Card title={say(twoFactor.title)} headingRef={twoFactorHeadingRef}>
        <DescriptionList
          items={[
            {
              term: say(twoFactor.state),
              description: <Badge tone={state.tone}>{say(state.label)}</Badge>,
            },
          ]}
        />
        <p>{say(state.description)}</p>
        <Actions>
          {match(user.twoFactorStatus)
            .with('disabled', () => (
              <ButtonLink href={twoFactorHref}>
                {say(twoFactor.setUp)}
              </ButtonLink>
            ))
            .with('pending', () => (
              <ButtonLink href={twoFactorHref}>
                {say(twoFactor.setUpAgain)}
              </ButtonLink>
            ))
            .with('enabled', () => (
              <>
                <Button onClick={onIssueBackupCodes}>
                  {say(twoFactor.issueBackupCodes)}
                </Button>
                <Button variant='danger' onClick={onStopTwoFactor}>
                  {say(twoFactor.turnOff)}
                </Button>
              </>
            ))
            .exhaustive()}
        </Actions>
      </Card>
    </>
  )
}
