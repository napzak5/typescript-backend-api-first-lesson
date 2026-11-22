import { authCrudLogin } from '@beauty-salon-frontend/api-client'
import { applications } from '@beauty-salon-frontend/brand'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { address, heading } from '@beauty-salon-frontend/testing/screens'
import { CUSTOMER, STYLIST } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import {
  NEWCOMER,
  NEWCOMER_PASSWORD,
  registerNewcomer,
  signedInAs,
} from '../../bookings/__tests__/arrangements'

/*
 * The screens themselves are tested in the session package
 * (`security.integration.test.tsx`), against the same API. Here is what the
 * portal adds: where they are, who gets to them, and the ways between them.
 */

const TITLE = applications.portal.name
const NEW_PASSWORD = 'aoi sora to shiroi kumo no aida'

const lastPasswordChangeOf = async (email: string): Promise<unknown> => {
  const [row] = await testApi().query(
    `select to_json("lastPasswordChange") #>> '{}' as "changedAt" from users where email = $1`,
    [email],
  )

  return row?.['changedAt']
}

describe('the security of the account in the portal, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe.each([
    [
      '/mypage/security',
      'アカウントの安全を確かめるには、サインインしてください。',
    ],
    [
      '/mypage/security/password',
      'パスワードを変更するには、サインインしてください。',
    ],
    [
      '/mypage/security/two-factor',
      '2 要素認証を設定するには、サインインしてください。',
    ],
  ])('the screen at %s', (path, notice) => {
    it('should ask somebody who is not signed in to sign in', async () => {
      // Act
      renderAt(path)

      // Assert
      expect(await screen.findByText(notice)).toBeVisible()
      expect(screen.queryByLabelText('現在のパスワード')).toBeNull()
      expect(screen.queryByRole('region')).toBeNull()
    })

    it('should tell an account of the staff of a salon that the screen is not for it: its screens are in the application of the salons', async () => {
      // Arrange
      await signedInAs(STYLIST)

      // Act
      renderAt(path)

      // Assert
      expect(
        await screen.findByText(
          `${STYLIST} のアカウントでは利用できません。利用できるアカウントでサインインし直してください。`,
        ),
      ).toBeVisible()
      expect(screen.queryByLabelText('現在のパスワード')).toBeNull()
      expect(screen.queryByRole('region')).toBeNull()
    })
  })

  it('should lead from my page to the security of the account, and back', async () => {
    // Arrange
    await signedInAs(CUSTOMER)
    renderAt('/mypage')
    const user = userEvent.setup()

    // Act
    await user.click(
      within(
        await screen.findByRole('region', { name: 'アカウントの安全' }),
      ).getByRole('link', { name: 'アカウントの安全を確かめる' }),
    )

    // Assert
    expect(await heading('アカウントの安全')).toHaveFocus()
    expect(address()).toBe('/mypage/security')
    expect(document.title).toBe(`アカウントの安全 | ${TITLE}`)
    await screen.findByText('1 台の端末でサインインしています')
    expect(await findAccessibilityViolations()).toEqual([])

    // Act
    await user.click(screen.getByRole('link', { name: 'マイページへ戻る' }))

    // Assert
    expect(await heading('マイページ')).toHaveFocus()
  })

  it('should lead from the security of the account to the set-up of the second factor, and back', async () => {
    // Arrange
    await signedInAs(CUSTOMER)
    renderAt('/mypage/security')
    const user = userEvent.setup()

    // Act
    await user.click(
      within(
        await screen.findByRole('region', { name: '2 要素認証' }),
      ).getByRole('link', { name: '2 要素認証を設定する' }),
    )

    // Assert
    expect(await heading('2 要素認証を設定する')).toHaveFocus()
    expect(address()).toBe('/mypage/security/two-factor')
    expect(document.title).toBe(`2 要素認証を設定する | ${TITLE}`)
    expect(await screen.findByLabelText('パスワード')).toBeVisible()
    expect(await findAccessibilityViolations()).toEqual([])

    // Act
    await user.click(screen.getByRole('link', { name: 'やめる' }))

    // Assert
    expect(await heading('アカウントの安全')).toHaveFocus()
    expect(address()).toBe('/mypage/security')
  })

  it('should lead to the security of the account from the page of an account that has no profile', async () => {
    // Arrange
    await registerNewcomer()
    await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)

    // Act
    renderAt('/mypage')

    // Assert
    expect(
      await screen.findByText('お客様の情報は、まだ登録されていません'),
    ).toBeVisible()
    expect(
      within(
        screen.getByRole('region', { name: 'アカウントの安全' }),
      ).getByRole('link', { name: 'アカウントの安全を確かめる' }),
    ).toHaveAttribute('href', '/mypage/security')
  })

  it('should change the password, and come back to the security of the account, which says when, and nothing of what it read before', async () => {
    // Arrange: a phone, which the change signs out
    await signedInAs(CUSTOMER)
    const phone = await authCrudLogin({
      email: CUSTOMER,
      password: testApi().seedPassword,
      rememberMe: true,
      twoFactorCode: null,
    })
    expect(phone.status).toBe(200)
    renderAt('/mypage/security')
    const user = userEvent.setup()
    await screen.findByText('2 台の端末でサインインしています')
    await user.click(
      await screen.findByRole('link', { name: 'パスワードを変更する' }),
    )
    expect(await heading('パスワードを変更する')).toHaveFocus()
    expect(await findAccessibilityViolations()).toEqual([])

    // Act
    await user.type(
      screen.getByLabelText('現在のパスワード'),
      testApi().seedPassword,
    )
    await user.type(screen.getByLabelText('新しいパスワード'), NEW_PASSWORD)
    await user.click(
      screen.getByRole('button', { name: 'パスワードを変更する' }),
    )

    // Assert
    expect(await heading('アカウントの安全')).toHaveFocus()
    expect(address()).toBe('/mypage/security')
    // What the screen had read before the change is not shown again
    expect(
      screen.queryByText('アカウントを作ってから、変更していません'),
    ).toBeNull()
    expect(screen.queryByText('2 台の端末でサインインしています')).toBeNull()
    expect(
      await screen.findByText('1 台の端末でサインインしています'),
    ).toBeVisible()
    const changedAt = await lastPasswordChangeOf(CUSTOMER)
    expect(changedAt).not.toBeNull()
    expect(
      await within(
        await screen.findByRole('region', { name: 'パスワード' }),
      ).findByText(
        new Intl.DateTimeFormat('ja-JP', {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(new Date(String(changedAt))),
      ),
    ).toBeVisible()
  })

  it('should lead back from the change of the password without changing it', async () => {
    // Arrange
    await signedInAs(CUSTOMER)
    renderAt('/mypage/security/password')
    const user = userEvent.setup()

    // Act
    await user.click(await screen.findByRole('link', { name: 'やめる' }))

    // Assert
    expect(await heading('アカウントの安全')).toHaveFocus()
    expect(await lastPasswordChangeOf(CUSTOMER)).toBeNull()
  })
})
