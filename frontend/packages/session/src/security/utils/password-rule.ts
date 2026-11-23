import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'

/*
 * The rule of the API for a password that a person chooses: when an account
 * is registered, when a password is set anew from a mail, when an invitation
 * is accepted and when the password is changed.
 */

const MIN_PASSWORD_LENGTH = 15
const MAX_PASSWORD_LENGTH = 128

const { passwordRule } = securityMessages

/** The rule, as a person is told it. */
export const PASSWORD_RULE: LocalizedText =
  passwordRule.rule(MIN_PASSWORD_LENGTH)

const PASSWORD_TOO_SHORT = passwordRule.tooShort(MIN_PASSWORD_LENGTH)
const PASSWORD_TOO_LONG = passwordRule.tooLong(MAX_PASSWORD_LENGTH)

/**
 * The length the API counts: the characters of the password as it is
 * stored, not the units of the string. An emoji is one character.
 */
const lengthOf = (password: string): number =>
  Array.from(password.normalize('NFC')).length

/**
 * What is wrong with a password that is chosen, said before the API is
 * asked: only what cannot be right (nothing, too short, too long). Whether
 * a password is easy to guess is the API's to say.
 */
export const newPasswordError = (password: string): LocalizedText | undefined =>
  match(lengthOf(password))
    .with(0, () => passwordRule.missing)
    .when(
      (length) => length < MIN_PASSWORD_LENGTH,
      () => PASSWORD_TOO_SHORT,
    )
    .when(
      (length) => length > MAX_PASSWORD_LENGTH,
      () => PASSWORD_TOO_LONG,
    )
    .otherwise(() => undefined)

/** What to say at the control of a chosen password that the API did not take, for the rule it broke. */
export const refusedPasswordMessage = (rule: string): LocalizedText =>
  match(rule)
    .with('too_small', () => PASSWORD_TOO_SHORT)
    .with('too_big', () => PASSWORD_TOO_LONG)
    .with('blocklisted', () => passwordRule.guessable)
    .otherwise(() => passwordRule.refused)
