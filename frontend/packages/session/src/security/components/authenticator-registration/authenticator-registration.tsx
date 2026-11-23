import {
  ButtonLink,
  Card,
  Form,
  type FormErrors,
  NO_ERRORS,
  QrCode,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { Ref } from 'react'
import { CODE, secretGroupsOf } from '../../utils/two-factor-flow'
import styles from './authenticator-registration.module.css'

const { twoFactor } = securityMessages

export type AuthenticatorRegistrationProps = {
  /** The `otpauth://` address the authenticator app reads: it holds the secret */
  qrCodeUrl: string
  /** The secret, for an app that cannot read the code */
  secret: string
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with the code, under the name of its control */
  errors?: FormErrors<LocalizedText> | undefined
  /** The code is on its way */
  pending?: boolean | undefined
  /** Where the way back leads: the screen of the security of the account */
  cancelHref: string
  /** The value of the control, under its name */
  onSubmit: (values: FormData) => void
  /** The heading of the step, which takes the focus when the step begins */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

/**
 * The second step of setting up the second factor: the authenticator app
 * takes the secret, from the QR code or as it is typed, and its code shows
 * that it holds it.
 */
export const AuthenticatorRegistration = ({
  qrCodeUrl,
  secret,
  message,
  errors = NO_ERRORS,
  pending,
  cancelHref,
  onSubmit,
  headingRef,
}: AuthenticatorRegistrationProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <>
      <Card title={say(twoFactor.register)} headingRef={headingRef}>
        <p>{say(twoFactor.scan)}</p>
        <QrCode value={qrCodeUrl} label={say(twoFactor.qrCode)} />
        <p>{say(twoFactor.key)}</p>
        <p className={styles['secret']}>
          <code>{secretGroupsOf(secret)}</code>
        </p>
      </Card>
      <Card title={say(twoFactor.confirmCode)}>
        <Form
          submitLabel={say(twoFactor.turnOn)}
          message={said.message}
          errors={errors}
          pending={pending}
          actions={
            <ButtonLink href={cancelHref}>
              {say(securityMessages.cancel)}
            </ButtonLink>
          }
          onSubmit={onSubmit}
        >
          <TextField
            width='short'
            label={say(twoFactor.appCode)}
            name={CODE}
            inputMode='numeric'
            autoComplete='one-time-code'
            required
            description={say(twoFactor.appCodeDescription)}
            error={said.errors[CODE]}
          />
        </Form>
      </Card>
    </>
  )
}
