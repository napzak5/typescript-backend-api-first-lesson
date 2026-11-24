import type { Locale } from '@beauty-salon-shared/i18n'
import { mailMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { Mail } from '../../../services/mailer'
import {
  EMAIL_VERIFICATION,
  type MailedTokenKind,
  PASSWORD_RESET,
  STAFF_INVITATION,
} from './mailed-token'

/**
 * The mails of the flows that concern an account, as plain text, in the
 * language of the request that caused each (`language`). What they say is
 * written in every language in `mailMessages`. A link points at a page of
 * the web application, whose address is configuration and never taken from
 * the request. The token is in the fragment, which a browser sends to no
 * server and leaves out of the Referer header.
 */

const linkTo = (publicAppUrl: string, page: string, token: string): string =>
  `${publicAppUrl}/${page}#token=${token}`

const hoursOf = ({ lifetimeMinutes }: MailedTokenKind): number =>
  lifetimeMinutes / 60

const daysOf = (kind: MailedTokenKind): number => hoursOf(kind) / 24

export const emailVerificationMail = (
  to: string,
  language: Locale,
  publicAppUrl: string,
  token: string,
): Mail => ({
  to,
  language,
  subject: mailMessages.emailVerification.subject,
  text: mailMessages.emailVerification.text(
    linkTo(publicAppUrl, 'verify-email', token),
    hoursOf(EMAIL_VERIFICATION),
  ),
})

export const passwordResetMail = (
  to: string,
  language: Locale,
  publicAppUrl: string,
  token: string,
): Mail => ({
  to,
  language,
  subject: mailMessages.passwordReset.subject,
  text: mailMessages.passwordReset.text(
    linkTo(publicAppUrl, 'reset-password', token),
    PASSWORD_RESET.lifetimeMinutes,
  ),
})

/**
 * The name of the salon is the salon's own text, the same in every
 * language. It is part of the body only, never of a header.
 */
export const staffInvitationMail = (
  to: string,
  language: Locale,
  salonName: string,
  publicAppUrl: string,
  token: string,
): Mail => ({
  to,
  language,
  subject: mailMessages.staffInvitation.subject,
  text: mailMessages.staffInvitation.text(
    salonName,
    linkTo(publicAppUrl, 'accept-staff-invitation', token),
    daysOf(STAFF_INVITATION),
  ),
})

export const passwordChangedMail = (to: string, language: Locale): Mail => ({
  to,
  language,
  ...mailMessages.passwordChanged,
})

export const twoFactorEnabledMail = (to: string, language: Locale): Mail => ({
  to,
  language,
  ...mailMessages.twoFactorEnabled,
})

export const twoFactorDisabledMail = (to: string, language: Locale): Mail => ({
  to,
  language,
  ...mailMessages.twoFactorDisabled,
})

export const twoFactorResetMail = (to: string, language: Locale): Mail => ({
  to,
  language,
  ...mailMessages.twoFactorReset,
})

export const backupCodesRegeneratedMail = (
  to: string,
  language: Locale,
): Mail => ({
  to,
  language,
  ...mailMessages.backupCodesRegenerated,
})

export const backupCodeUsedMail = (
  to: string,
  language: Locale,
  backupCodesLeft: number,
): Mail => ({
  to,
  language,
  subject: mailMessages.backupCodeUsed.subject,
  text: mailMessages.backupCodeUsed.text(backupCodesLeft),
})
