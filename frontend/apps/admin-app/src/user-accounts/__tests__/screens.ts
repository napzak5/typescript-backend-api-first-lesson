import { OPERATOR } from '@beauty-salon-frontend/testing/seed'
import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { openAs } from '../../__tests__/screens'
import { userAccountHrefOf } from '../../navigation'
import { userIdOf } from './arrangements'

/*
 * What the screen tests of the accounts of the users open and wait for.
 */

/** Opens the account of an address as the administrator, and waits for its record. */
export const openAccountOf = async (
  email: string,
  language: 'ja' | 'en' = 'ja',
): Promise<void> => {
  await openAs(userAccountHrefOf(await userIdOf(email)), OPERATOR, language)
  await screen.findByRole('region', {
    name: language === 'ja' ? 'アカウントの状態' : 'State of the account',
  })
}

/** Opens the dialog of the reset of the second factor of the account of the address. */
export const askToReset = async (
  user: ReturnType<typeof userEvent.setup>,
  email: string,
): Promise<HTMLElement> => {
  await user.click(
    await screen.findByRole('button', { name: '2 要素認証をリセットする' }),
  )

  return screen.findByRole('dialog', {
    name: `${email} の 2 要素認証をリセットしますか？`,
  })
}
