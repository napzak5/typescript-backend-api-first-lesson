import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { ValidationIssue } from '../../../shared'

/**
 * Passwords nobody may choose, however long they are. NIST SP 800-63B-4
 * (3.1.1.2) has a new password compared against a list of commonly used,
 * expected or compromised values. The whole password is compared, never a
 * part of it: a passphrase that merely contains one of these is allowed.
 *
 * The list here is what can be told without a corpus of leaked passwords:
 * the account's own address, patterns anyone can type without thinking, and
 * a few values that are published as examples of long passwords.
 *
 * A password that belongs to no account, such as the one of a share link,
 * is compared with all of it but the address.
 */

/** Widely published examples and keyboard walks, as `essenceOf` leaves them. */
const WELL_KNOWN = new Set([
  'correcthorsebatterystaple',
  'thequickbrownfoxjumpsoverthelazydog',
  'qwerty1234567890',
  '1q2w3e4r5t6y7u8i9o0p',
  'q1w2e3r4t5y6u7i8o9p0',
  '1qaz2wsx3edc4rfv5tgb6yhn7ujm',
  'qazwsxedcrfvtgbyhnujm',
])

/**
 * The word itself, alone or with digits after it, as `essenceOf` leaves
 * it: "password", "Passw0rd!", "password1234567890".
 */
const THE_WORD_ITSELF = /^passw[o0]rd\d*$/

/** Rows of a QWERTY keyboard, typed one after the other. */
const KEYBOARD_ROWS = [
  '1234567890qwertyuiopasdfghjklzxcvbnm',
  'qwertyuiopasdfghjklzxcvbnm',
  'mnbvcxzlkjhgfdsapoiuytrewq',
]

/** The longest unit whose repetition is still a pattern rather than a phrase. */
const MAX_REPEATED_UNIT = 8

/**
 * What is left of a password when case, spaces and punctuation are taken
 * away: "Correct Horse-Battery Staple!" is the same choice as
 * "correcthorsebatterystaple".
 */
const essenceOf = (value: string): string =>
  value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** One unit typed over and over: "aaaaaaaaaaaaaaaa", "abc123abc123abc123". */
const isRepetition = (characters: string[]): boolean =>
  Array.from(
    { length: Math.min(MAX_REPEATED_UNIT, Math.floor(characters.length / 2)) },
    (_, index) => index + 1,
  ).some((unit) =>
    characters.every(
      (character, index) => character === characters[index % unit],
    ),
  )

const follows = (previous: string, next: string, step: 1 | -1): boolean =>
  (next.codePointAt(0) ?? 0) - (previous.codePointAt(0) ?? 0) === step ||
  (step === 1 && previous === '9' && next === '0') ||
  (step === -1 && previous === '0' && next === '9')

const isRun = (characters: string[], step: 1 | -1): boolean =>
  characters.every(
    (character, index) =>
      index === 0 || follows(characters[index - 1] ?? '', character, step),
  )

/** Neighbours all the way, up or down: "123456789012345", "zyxwvutsrqponml". */
const isSequence = (characters: string[]): boolean =>
  isRun(characters, 1) || isRun(characters, -1)

/** A well-known password, or a pattern anyone can type without thinking. */
const isCommonChoice = (password: string): boolean => {
  const typed = password.toLowerCase()
  const essence = essenceOf(password)
  const characters = [...typed]

  return (
    WELL_KNOWN.has(essence) ||
    THE_WORD_ITSELF.test(essence) ||
    KEYBOARD_ROWS.some((row) => row.includes(typed)) ||
    isRepetition(characters) ||
    isSequence(characters)
  )
}

const isBlocklisted = (password: string, email: string): boolean => {
  const essence = essenceOf(password)
  // A password without a letter or digit has no essence to compare.
  const isSameChoiceAs = (other: string): boolean =>
    essence.length > 0 && essence === essenceOf(other)

  return (
    password.toLowerCase() === email ||
    isSameChoiceAs(email) ||
    isSameChoiceAs(email.split('@')[0] ?? '') ||
    isCommonChoice(password)
  )
}

/**
 * The broken rule when `password` is one that is refused for the account
 * with `email`, to be reported under `field`; null when the password may be
 * chosen. The reason goes back to the user, who has to pick another one.
 */
export const blocklistIssue = (
  field: string,
  password: string,
  email: string,
): ValidationIssue | null =>
  isBlocklisted(password, email)
    ? {
        field,
        rule: 'blocklisted',
        message: authMessages.passwordGuessableWithEmail,
      }
    : null

/**
 * The broken rule when `password` is one that is refused for something no
 * account owns, to be reported under `field`; null when the password may
 * be chosen.
 */
export const commonChoiceIssue = (
  field: string,
  password: string,
): ValidationIssue | null =>
  isCommonChoice(password)
    ? {
        field,
        rule: 'blocklisted',
        message: authMessages.passwordGuessable,
      }
    : null
