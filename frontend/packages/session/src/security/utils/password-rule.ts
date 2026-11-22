import { match } from 'ts-pattern'

/*
 * The rule of the API for a password that a person chooses: when an account
 * is registered, when a password is set anew from a mail, when an invitation
 * is accepted and when the password is changed.
 */

/** The rule, as a person is told it. */
export const PASSWORD_RULE =
  '15 文字以上で入力してください。長い文や、いくつかの単語の組み合わせが安全です。'

const MIN_PASSWORD_LENGTH = 15
const MAX_PASSWORD_LENGTH = 128

const PASSWORD_MISSING = 'パスワードを入力してください。'
const PASSWORD_TOO_SHORT =
  'パスワードが短すぎます。15 文字以上で入力してください。'
const PASSWORD_TOO_LONG =
  'パスワードが長すぎます。128 文字以下で入力してください。'
const PASSWORD_GUESSABLE =
  'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。'
const PASSWORD_REFUSED =
  'このパスワードは使えません。別のパスワードを入力してください。'

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
export const newPasswordError = (password: string): string | undefined =>
  match(lengthOf(password))
    .with(0, () => PASSWORD_MISSING)
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
export const refusedPasswordMessage = (rule: string): string =>
  match(rule)
    .with('too_small', () => PASSWORD_TOO_SHORT)
    .with('too_big', () => PASSWORD_TOO_LONG)
    .with('blocklisted', () => PASSWORD_GUESSABLE)
    .otherwise(() => PASSWORD_REFUSED)
