import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { testApi } from './test-api'

/** The controls of the sign-in form, as a page in each language names them */
const SIGN_IN_FORM = {
  ja: { email: 'メールアドレス', password: 'パスワード', send: 'サインイン' },
  en: { email: 'Email address', password: 'Password', send: 'Sign in' },
}

/**
 * Signs in on the screen, as an account of the seed data: writes the
 * address of mail and the password of the seed data into the form, once
 * it is there, and sends it. The form is found by the names of the
 * language of the page, Japanese unless the test says.
 */
export const signInAs = async (
  email: string,
  language: keyof typeof SIGN_IN_FORM = 'ja',
): Promise<void> => {
  const names = SIGN_IN_FORM[language]
  const user = userEvent.setup()
  await user.type(
    await screen.findByRole('textbox', { name: names.email }),
    email,
  )
  await user.type(screen.getByLabelText(names.password), testApi().seedPassword)
  await user.click(screen.getByRole('button', { name: names.send }))
}
