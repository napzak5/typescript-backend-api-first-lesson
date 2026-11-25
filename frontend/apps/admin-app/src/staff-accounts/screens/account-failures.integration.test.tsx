import {
  refuse,
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  notifications,
  readAgain,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import {
  arrangeInactive,
  arrangeOwnerAccount,
  staffIdOf,
  TANAKA,
} from '../../staff/__tests__/arrangements'
import { userIdOf } from '../../user-accounts/__tests__/arrangements'
import {
  acceptedMeanwhile,
  arrangeInvitation,
  storedAccountOf,
  storedInvitationOf,
  unlinkedMeanwhile,
  WATANABE,
} from '../__tests__/arrangements'
import { cardHeading, expectFocusOn, openAccountOf } from '../__tests__/screens'

/*
 * The accounts of the staff, when a read or a write fails, when the role of
 * the owner changed meanwhile, and when the member or their account
 * changed meanwhile. The failures are arranged in the database; what goes
 * well is in `staff-account.integration.test.tsx`.
 */

const LEDGER_FORBIDDEN =
  'このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。'

const REVOKING = 'Yui Watanabe さんへの招待を取り消しますか？'

const UNLINKING =
  'Hiroshi Tanaka さんのログインアカウントの紐づけを解除しますか？'

/** The path below `/api/v1` of the account or the invitation of a member of the salon in Tokyo */
const apiPathOf = async (staffCode: string, below: string): Promise<string> =>
  `/salons/${await salonIdOf(TOKYO)}/staff/${await staffIdOf(staffCode)}/${below}`

/** Opens the dialog of a button of the account of a member, and waits for it. */
const askWith = async (
  user: ReturnType<typeof userEvent.setup>,
  button: string,
  dialog: string,
): Promise<HTMLElement> => {
  await user.click(await screen.findByRole('button', { name: button }))

  return screen.findByRole('dialog', { name: dialog })
}

describe('the accounts of the staff, when something fails or changes meanwhile, against the API', () => {
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
    const readable = await unreadable(
      'users',
      'updatedAt',
      await userIdOf(STYLIST),
    )
    await openAccountOf(TANAKA)
    expect(
      await screen.findByText(
        'ログインアカウントを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await cardHeading('ログインアカウント')).toBeVisible()
  })

  it.each<[string, string]>([
    ['the account', 'account'],
    ['the invitation', 'invitation'],
  ])(
    'should tell an owner who keeps the ledger no more that it is not theirs to keep, when %s was read',
    async (_, below) => {
      // Arrange
      whenAskedFor(`GET ${await apiPathOf(TANAKA, below)}`, () =>
        madeStaffMeanwhile(OWNER),
      )

      // Act
      await openAccountOf(TANAKA)

      // Assert
      expect(await screen.findByText(LEDGER_FORBIDDEN)).toBeVisible()
      expect(
        screen.queryByRole('region', { name: 'ログインアカウント' }),
      ).toBeNull()
    },
  )

  it('should say that an invitation could not be mailed when the database fails, and keep the role chosen', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAccountOf(WATANABE.code)
    await user.click(await screen.findByRole('radio', { name: 'スタッフ' }))
    await refuse('insert', 'staff_invitations')

    // Act
    await user.click(screen.getByRole('button', { name: '招待メールを送る' }))

    // Assert
    expect(
      await screen.findByText(
        '招待メールを送れませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('radio', { name: 'スタッフ' })).toBeChecked()
    expect(await storedInvitationOf(WATANABE.code)).toEqual([])
  })

  it('should say in the dialog that the invitation was kept when the owner may revoke none any more, and close it when asked', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeInvitation(WATANABE.code, {
      role: 'staff',
      mailedAgo: '1 day',
    })
    await openAccountOf(WATANABE.code)
    const dialog = await askWith(user, '招待を取り消す', REVOKING)
    await madeStaffMeanwhile(OWNER)
    await user.click(within(dialog).getByRole('button', { name: '取り消す' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'このアカウントでは、招待を取り消せません。',
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await storedInvitationOf(WATANABE.code)).toHaveLength(1)

    // Act
    const opened = await askWith(user, '招待を取り消す', REVOKING)

    // Assert: what went wrong is said no more
    expect(within(opened).queryByRole('alert')).toBeNull()
  })

  it('should show the account an invitation made meanwhile when it was to be revoked', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeInvitation(WATANABE.code, {
      role: 'staff',
      mailedAgo: '1 day',
    })
    await openAccountOf(WATANABE.code)
    const dialog = await askWith(user, '招待を取り消す', REVOKING)
    await acceptedMeanwhile(WATANABE.code)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

    // Assert
    await expectFocusOn('ログインアカウント')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(notifications()).toContain(
      'その間に、Yui Watanabe さんのログインアカウントか招待が、変わっていました（招待が受け入れられたか、取り消されたか、紐づけが解除されていました）。いまの状態を出しています。',
    )
  })

  it('should show the invitation of an inactive member, and lead to making them active instead of mailing it again', async () => {
    // Arrange
    await arrangeInvitation(WATANABE.code, {
      role: 'staff',
      mailedAgo: '1 day',
    })
    await arrangeInactive(WATANABE.code)

    // Act
    await openAccountOf(WATANABE.code)

    // Assert
    expect(await cardHeading('招待')).toBeVisible()
    expect(
      screen.getByText(
        '無効なスタッフは、招待できません。休職や退職の手続きが終わって復帰するときは、スタッフ情報を有効に戻してから招待してください。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: '招待し直す' })).toBeNull()
    expect(screen.getByRole('button', { name: '招待を取り消す' })).toBeVisible()
  })

  it('should say that the role could not be changed when the database fails', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAccountOf(TANAKA)
    await user.click(await screen.findByRole('radio', { name: 'マネージャー' }))
    await refuse('update', 'users')

    // Act
    await user.click(screen.getByRole('button', { name: 'ロールを変える' }))

    // Assert
    expect(
      await screen.findByText(
        'ロールを変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    expect(await storedAccountOf(STYLIST)).toEqual([
      { role: 'staff', linked: true },
    ])
  })

  it('should ask an owner for a role for the account of another owner, which has none the owner may give, without asking the API', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeOwnerAccount(MANAGER)
    await openAccountOf('STF901')
    await screen.findByRole('radiogroup', { name: 'ロール' })

    // Act
    await user.click(screen.getByRole('button', { name: 'ロールを変える' }))

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: 'ロール' }),
    ).toHaveAccessibleDescription(/ロールを選んでください。/)
    expect(await storedAccountOf(MANAGER)).toEqual([
      { role: 'owner', linked: true },
    ])
  })

  it('should say in the dialog that the account stays linked when the owner may unlink none any more, and close it when asked', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAccountOf(TANAKA)
    const dialog = await askWith(user, '紐づけを解除する', UNLINKING)
    await madeStaffMeanwhile(OWNER)
    await user.click(within(dialog).getByRole('button', { name: '解除する' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'このアカウントでは、紐づけを解除できません。',
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await storedAccountOf(STYLIST)).toEqual([
      { role: 'staff', linked: true },
    ])

    // Act
    const opened = await askWith(user, '紐づけを解除する', UNLINKING)

    // Assert: what went wrong is said no more
    expect(within(opened).queryByRole('alert')).toBeNull()
  })

  it('should show what the member has now when the account was unlinked before it was to be unlinked', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAccountOf(TANAKA)
    const dialog = await askWith(user, '紐づけを解除する', UNLINKING)
    await unlinkedMeanwhile(TANAKA)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '解除する' }))

    // Assert
    await expectFocusOn('招待する')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(notifications()).toContain(
      'その間に、Hiroshi Tanaka さんのログインアカウントか招待が、変わっていました（招待が受け入れられたか、取り消されたか、紐づけが解除されていました）。いまの状態を出しています。',
    )
  })

  it('should say of the account of an inactive member that it cannot use the screens of the salon', async () => {
    // Arrange
    await arrangeInactive(TANAKA)

    // Act
    await openAccountOf(TANAKA)

    // Assert
    expect(await cardHeading('ログインアカウント')).toBeVisible()
    expect(
      screen.getByText(
        '無効なスタッフです。スタッフ情報を有効に戻すまで、このアカウントでは、サロンの画面を使えません。',
      ),
    ).toBeVisible()
  })
})
