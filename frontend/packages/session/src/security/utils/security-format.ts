import type {
  ModelsSessionResponse,
  ModelsTwoFactorStatusType,
  ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'

/*
 * How the screens of the security of an account say what the API keeps.
 * An account belongs to no salon, so a moment is said in the time zone of
 * whoever reads (the screens hand over that of the browser).
 */

const { password, sessions, twoFactor } = securityMessages

/** A moment, as 「2026年11月20日 10:15」. */
export const momentOf = (instant: string, timeZone: string): LocalizedText =>
  formats.momentAt(instant, timeZone)

/** When the password was changed last, or that it never was. */
export const passwordChangedOf = (
  { lastPasswordChange }: Pick<ModelsUserResponse, 'lastPasswordChange'>,
  timeZone: string,
): LocalizedText =>
  lastPasswordChange === null
    ? password.neverChanged
    : momentOf(lastPasswordChange, timeZone)

/** What the two-factor authentication of the account is, in a word and in a sentence. */
export type TwoFactorState = {
  label: LocalizedText
  tone: 'success' | 'warning' | 'neutral'
  description: LocalizedText
}

export const twoFactorStateOf = (
  status: ModelsTwoFactorStatusType,
): TwoFactorState =>
  match(status)
    .returnType<TwoFactorState>()
    .with('enabled', () => ({
      label: twoFactor.enabled,
      tone: 'success',
      description: twoFactor.enabledDescription,
    }))
    .with('pending', () => ({
      label: twoFactor.pending,
      tone: 'warning',
      description: twoFactor.pendingDescription,
    }))
    .with('disabled', () => ({
      label: twoFactor.disabled,
      tone: 'neutral',
      description: twoFactor.disabledDescription,
    }))
    .exhaustive()

/**
 * How a session is named: by when its device signed in. A person tells
 * their devices apart by what they did, and the API knows no name for one.
 */
export const sessionNameOf = (
  { createdAt }: Pick<ModelsSessionResponse, 'createdAt'>,
  timeZone: string,
): LocalizedText => sessions.name(momentOf(createdAt, timeZone))

/** The button that signs a session out, named after the session. */
export const signOutNameOf = (
  { createdAt }: Pick<ModelsSessionResponse, 'createdAt'>,
  timeZone: string,
): LocalizedText => sessions.signOutOf(momentOf(createdAt, timeZone))
