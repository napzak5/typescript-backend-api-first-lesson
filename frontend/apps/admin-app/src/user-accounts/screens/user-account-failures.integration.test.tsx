import { unreadable, whenAskedFor } from '@beauty-salon-frontend/testing/api'
import { readAgain } from '@beauty-salon-frontend/testing/screens'
import { OPERATOR, YUKI } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import { userAccountHrefOf } from '../../navigation'
import {
  arrangeTwoFactor,
  deletedMeanwhile,
  storedAccountOf,
  userIdOf,
} from '../__tests__/arrangements'
import { askToReset, openAccountOf } from '../__tests__/screens'

/*
 * The accounts of the users, when the read fails, when the administrator
 * is one no more, and when the account was deleted meanwhile. The failures
 * are arranged in the database; what goes well is in
 * `user-accounts.integration.test.tsx`.
 */

const ADMINISTRATORS_ONLY =
  'このアカウントでは、ログインアカウントを扱えません。利用者のアカウントの状態を見て、ロックを解除し、2 要素認証をリセットするのは、管理者です。'

describe('the accounts of the users, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the account could not be read, and show it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await userIdOf(YUKI.email)
    const readable = await unreadable('users', 'updatedAt', id)
    await openAs(userAccountHrefOf(id), OPERATOR)
    expect(
      await screen.findByText(
        'アカウントを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(
      await screen.findByRole('region', { name: 'アカウントの状態' }),
    ).toHaveTextContent(YUKI.email)
  })

  it('should tell an account that is no administrator any more who looks after the accounts, as the API refused the read', async () => {
    // Arrange
    const id = await userIdOf(YUKI.email)
    whenAskedFor(`GET /admin/auth/users/${id}`, () =>
      madeStaffMeanwhile(OPERATOR),
    )

    // Act
    await openAs(userAccountHrefOf(id), OPERATOR)

    // Assert
    expect(await screen.findByText(ADMINISTRATORS_ONLY)).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'アカウントの状態' }),
    ).toBeNull()
  })

  it('should say that an account deleted before its second factor was reset is not found', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeTwoFactor(YUKI.email)
    await openAccountOf(YUKI.email)
    const dialog = await askToReset(user, YUKI.email)
    await deletedMeanwhile(YUKI.email)

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'リセットする' }),
    )

    // Assert
    expect(
      await screen.findByText(
        'このアカウントは見つかりません。削除されたか、アドレスが違います。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should close the dialog and say who resets a second factor when the administrator is one no more, and keep it', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeTwoFactor(YUKI.email)
    await openAccountOf(YUKI.email)
    const dialog = await askToReset(user, YUKI.email)
    await madeStaffMeanwhile(OPERATOR)

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'リセットする' }),
    )

    // Assert
    expect(
      await within(
        screen.getByRole('region', { name: '2 要素認証のリセット' }),
      ).findByRole('alert'),
    ).toHaveTextContent(ADMINISTRATORS_ONLY)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await storedAccountOf(YUKI.email)).toEqual([
      expect.objectContaining({ twoFactorStatus: 'enabled', secretKept: true }),
    ])

    // Act
    await askToReset(user, YUKI.email)

    // Assert: the refusal is said no more once the dialog is asked for again
    expect(
      within(
        screen.getByRole('region', { name: '2 要素認証のリセット' }),
      ).queryByRole('alert'),
    ).toBeNull()
  })
})
