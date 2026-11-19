import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import {
  Badge,
  ButtonLink,
  Card,
  DescriptionList,
} from '@beauty-salon-frontend/ui'
import { passwordChangedOf, twoFactorStateOf } from '../../security-format'

export type SecuritySummaryProps = {
  /** The account of the session, as the API has it now */
  user: ModelsUserResponse
  /** The address of the screen that changes the password */
  passwordHref: string
  /** The time zone of whoever reads: the moment the password was changed is said in it */
  timeZone: string
}

/**
 * How the account is kept from others: its password, with the way to change
 * it, and whether the sign-in also asks for the code of an authenticator
 * app.
 */
export const SecuritySummary = ({
  user,
  passwordHref,
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
          <ButtonLink href={passwordHref} variant='secondary'>
            パスワードを変更する
          </ButtonLink>
        </p>
      </Card>
      <Card title='2 要素認証'>
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
      </Card>
    </>
  )
}
