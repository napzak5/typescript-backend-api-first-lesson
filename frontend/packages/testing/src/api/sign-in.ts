import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { testApi } from './test-api'

/**
 * Signs in on the screen, as an account of the seed data: writes the
 * address of mail and the password of the seed data into the form, once
 * it is there, and sends it.
 */
export const signInAs = async (email: string): Promise<void> => {
  const user = userEvent.setup()
  await user.type(
    await screen.findByRole('textbox', { name: 'メールアドレス' }),
    email,
  )
  await user.type(screen.getByLabelText('パスワード'), testApi().seedPassword)
  await user.click(screen.getByRole('button', { name: 'サインイン' }))
}
