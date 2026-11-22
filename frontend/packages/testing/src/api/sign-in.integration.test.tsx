import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OWNER } from '../fixtures/seed'
import { signInAs } from './sign-in'
import { testApi } from './test-api'

/** What the form was sent with */
let sent: [string, FormDataEntryValue][] = []

/** The controls of the sign-in screen, by their names */
const SignInForm = () => (
  <form
    onSubmit={(event) => {
      event.preventDefault()
      sent = [...new FormData(event.currentTarget).entries()]
    }}
  >
    <label>
      メールアドレス
      <input name='email' type='email' />
    </label>
    <label>
      パスワード
      <input name='password' type='password' />
    </label>
    <button type='button' onClick={() => sent.push(['pressed', 'another'])}>
      パスワードを表示する
    </button>
    <button type='submit'>サインイン</button>
  </form>
)

describe('signInAs', () => {
  afterEach(() => {
    cleanup()
    sent = []
  })

  it('should send the form of the screen, once it is there, with the address and the password of the seed data', async () => {
    // Arrange
    const view = render(<p>読んでいます</p>)

    // Act
    const signedIn = signInAs(OWNER)
    view.rerender(<SignInForm />)
    await signedIn

    // Assert
    expect(sent).toEqual([
      ['email', OWNER],
      ['password', testApi().seedPassword],
    ])
  })
})
