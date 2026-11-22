import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  ADMIN,
  MANAGER,
  OWNER,
  STYLIST,
  salonIdOf,
  signInAs,
  THERAPIST,
  TOKYO,
} from '../bookings/__tests__/arrangements'
import { staffAccountHrefOf, staffMemberHrefOf } from '../navigation'
import {
  arrangeInactive,
  arrangeOwnerAccount,
  MORI,
  removedMeanwhile,
  staffIdOf,
  TANAKA,
} from '../staff/__tests__/arrangements'
import {
  acceptedMeanwhile,
  arrangeAccount,
  arrangeInvitation,
  storedAccountOf,
  storedInvitationOf,
  unlinkedMeanwhile,
  WATANABE,
} from './__tests__/arrangements'

/*
 * The accounts of the members of the salon in Tokyo, as its owner keeps
 * them: Yui Watanabe, who has none and is invited, and the accounts of the
 * seed data. Somebody did something meanwhile where a test says so.
 */

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** Opens the account of a member of the salon in Tokyo, signed in as an account of the seed data. */
const openAccountOf = async (staffCode: string, as = OWNER): Promise<void> => {
  renderAt(
    staffAccountHrefOf(await salonIdOf(TOKYO), await staffIdOf(staffCode)),
  )
  await signInAs(as)
}

const cardHeading = (name: string) =>
  screen.findByRole('heading', { level: 2, name })

/**
 * Waits until the heading of a card has the focus. It takes the focus once
 * the part a write left is shown, which can be a moment after the heading
 * itself: what was read anew reaches the screen after the write is done.
 */
const expectFocusOn = async (name: string): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 2, name })).toHaveFocus()
  })
}

/** What the application says in its notifications, and above the cards. */
const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((said) => said !== '')

/** What a card says, term by term. */
const termsOf = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

/** The roles a form offers, and whether each is chosen. */
const rolesOffered = (): [string, boolean][] =>
  within(screen.getByRole('radiogroup', { name: 'ロール' }))
    .getAllByRole('radio')
    .map((radio) => [
      radio.closest('label')?.textContent ?? '',
      radio.matches(':checked'),
    ])

/** The addresses the API mailed to in this test. */
const mailedTo = async (): Promise<string[]> =>
  (await testApi().mails()).map(({ to }) => to)

const INACTIVE_NOTICE =
  '無効なスタッフは、招待できません。休職や退職の手続きが終わって復帰するときは、スタッフ情報を有効に戻してから招待してください。'

describe('the accounts of the staff, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('an invitation', () => {
    it('should invite a member without an account from their page, and show the invitation that was mailed', async () => {
      // Arrange
      const user = userEvent.setup()
      const salonId = await salonIdOf(TOKYO)
      renderAt(staffMemberHrefOf(salonId, await staffIdOf(WATANABE.code)))
      await signInAs(OWNER)
      await user.click(
        await screen.findByRole('link', { name: 'ログインアカウント' }),
      )
      expect(
        await screen.findByText(/ログインアカウントは、まだありません。/),
      ).toBeVisible()
      expect(rolesOffered()).toEqual([
        ['マネージャー', false],
        ['スタッフ', false],
      ])
      expect(
        screen.getByText(
          /台帳のメールアドレス（yui\.watanabe@beautysalon\.jp）に送ります/,
        ),
      ).toBeVisible()

      // Act
      await user.click(screen.getByRole('radio', { name: 'スタッフ' }))
      await user.click(screen.getByRole('button', { name: '招待メールを送る' }))

      // Assert
      await expectFocusOn('招待')
      expect(notifications()).toContain(
        'Yui Watanabe さんに、招待メールを送りました。',
      )
      expect(termsOf('招待')).toEqual([
        ['状態', '受け入れ待ち'],
        ['宛先', WATANABE.email],
        ['ロール', 'スタッフ'],
        ['期限', expect.stringMatching(/^\d{4}年/)],
        ['送った日時', expect.stringMatching(/^\d{4}年/)],
      ])
      expect(await storedInvitationOf(WATANABE.code)).toEqual([
        { email: WATANABE.email, role: 'staff', hoursLasting: 7 * 24 },
      ])
      expect(await mailedTo()).toEqual([WATANABE.email])
      expect(new URL(await testApi().mailedLink(WATANABE.email)).pathname).toBe(
        '/accept-staff-invitation',
      )
      expect(
        within(
          screen.getByRole('navigation', { name: 'メインメニュー' }),
        ).getByRole('link', { name: 'スタッフ' }),
      ).toHaveAttribute('aria-current', 'page')
    })

    it('should ask for a role before an invitation is mailed', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAccountOf(WATANABE.code)

      // Act
      await user.click(
        await screen.findByRole('button', { name: '招待メールを送る' }),
      )

      // Assert
      expect(
        screen.getByRole('radiogroup', { name: 'ロール' }),
      ).toHaveAccessibleDescription(/ロールを選んでください。/)
      expect(screen.getByRole('radio', { name: 'マネージャー' })).toHaveFocus()
      expect(await storedInvitationOf(WATANABE.code)).toEqual([])
      expect(await mailedTo()).toEqual([])
    })

    it('should let an administrator invite a member as an owner', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAccountOf(WATANABE.code, ADMIN)
      await screen.findByRole('radiogroup', { name: 'ロール' })
      expect(rolesOffered().map(([role]) => role)).toEqual([
        'オーナー',
        'マネージャー',
        'スタッフ',
      ])

      // Act
      await user.click(screen.getByRole('radio', { name: 'オーナー' }))
      await user.click(screen.getByRole('button', { name: '招待メールを送る' }))

      // Assert
      await expectFocusOn('招待')
      expect(await storedInvitationOf(WATANABE.code)).toEqual([
        expect.objectContaining({ role: 'owner' }),
      ])
    })

    it('should show an invitation that expired, and mail it again with the role it gave', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeInvitation(WATANABE.code, {
        role: 'manager',
        mailedAgo: '8 days',
      })
      await openAccountOf(WATANABE.code)
      await cardHeading('招待')
      expect(termsOf('招待')[0]).toEqual(['状態', '期限切れ'])
      expect(screen.getByText(/期限が切れたので/)).toBeVisible()
      expect(rolesOffered()).toEqual([
        ['マネージャー', true],
        ['スタッフ', false],
      ])

      // Act
      await user.click(
        screen.getByRole('button', { name: '招待メールを送り直す' }),
      )

      // Assert: the card was shown before, and takes the focus once the invitation was mailed
      expect(
        await screen.findByText(
          'Yui Watanabe さんに、招待メールを送り直しました。前に送ったメールのリンクは、使えなくなりました。',
        ),
      ).toBeVisible()
      await expectFocusOn('招待')
      expect(termsOf('招待')[0]).toEqual(['状態', '受け入れ待ち'])
      expect(await storedInvitationOf(WATANABE.code)).toEqual([
        { email: WATANABE.email, role: 'manager', hoursLasting: 7 * 24 },
      ])
      expect(await mailedTo()).toEqual([WATANABE.email])
    })

    it('should say that an invitation went to an address the ledger no longer has', async () => {
      // Arrange
      await arrangeInvitation(WATANABE.code, {
        role: 'staff',
        email: 'yui.old@beautysalon.jp',
        mailedAgo: '1 day',
      })

      // Act
      await openAccountOf(WATANABE.code)

      // Assert
      await cardHeading('招待')
      expect(termsOf('招待').slice(0, 2)).toEqual([
        ['状態', '使えません'],
        ['宛先', 'yui.old@beautysalon.jp'],
      ])
      expect(
        screen.getByText(/台帳のメールアドレスが変わりました/),
      ).toHaveTextContent(`（いまは${WATANABE.email}）`)
    })

    it('should not mail an invitation again less than a minute after the last one, and say so', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeInvitation(WATANABE.code, {
        role: 'staff',
        mailedAgo: '10 seconds',
      })
      await openAccountOf(WATANABE.code)

      // Act
      await user.click(
        await screen.findByRole('button', { name: '招待メールを送り直す' }),
      )

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Yui Watanabe さんには、1 分以内に招待メールを送ったばかりです。続けては送れません。',
      )
      expect(await mailedTo()).toEqual([])
    })

    it('should revoke an invitation after the dialog asked, and offer a new one', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeInvitation(WATANABE.code, {
        role: 'staff',
        mailedAgo: '1 day',
      })
      await openAccountOf(WATANABE.code)
      await user.click(
        await screen.findByRole('button', { name: '招待を取り消す' }),
      )
      const dialog = await screen.findByRole('dialog', {
        name: 'Yui Watanabe さんへの招待を取り消しますか？',
      })

      // Act
      await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

      // Assert
      await expectFocusOn('招待する')
      expect(notifications()).toContain(
        'Yui Watanabe さんへの招待を取り消しました。',
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await storedInvitationOf(WATANABE.code)).toEqual([])
    })

    it('should show the account an invitation made meanwhile, and mail nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeInvitation(WATANABE.code, {
        role: 'staff',
        mailedAgo: '1 day',
      })
      await openAccountOf(WATANABE.code)
      await screen.findByRole('button', { name: '招待メールを送り直す' })
      await acceptedMeanwhile(WATANABE.code)

      // Act
      await user.click(
        screen.getByRole('button', { name: '招待メールを送り直す' }),
      )

      // Assert
      await expectFocusOn('ログインアカウント')
      expect(notifications()).toContain(
        'その間に、Yui Watanabe さんが招待を受け入れて、ログインアカウントができていました。招待メールは、送っていません。',
      )
      expect(termsOf('ログインアカウント')[0]).toEqual([
        'メールアドレス',
        WATANABE.email,
      ])
      expect(await mailedTo()).toEqual([])
    })

    it('should not offer to invite an inactive member, and lead to making them active', async () => {
      // Arrange
      await arrangeInactive(WATANABE.code)

      // Act
      await openAccountOf(WATANABE.code)

      // Assert
      expect(await screen.findByText(INACTIVE_NOTICE)).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'スタッフ情報を直す' }),
      ).toBeVisible()
      expect(screen.queryByRole('radiogroup')).toBeNull()
    })

    it('should say that the member was made inactive meanwhile, and mail nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAccountOf(WATANABE.code)
      await user.click(
        await screen.findByRole('radio', { name: 'マネージャー' }),
      )
      await arrangeInactive(WATANABE.code)

      // Act
      await user.click(screen.getByRole('button', { name: '招待メールを送る' }))

      // Assert
      expect(await screen.findByText(INACTIVE_NOTICE)).toBeVisible()
      expect(notifications()).toContain(
        '招待メールを送れませんでした。その間に、Yui Watanabe さんのスタッフ情報が無効になっていました。',
      )
      expect(await mailedTo()).toEqual([])
    })

    it('should say that the member is not found when another owner removed them before the invitation', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAccountOf(WATANABE.code)
      await user.click(await screen.findByRole('radio', { name: 'スタッフ' }))
      await removedMeanwhile(await staffIdOf(WATANABE.code))

      // Act
      await user.click(screen.getByRole('button', { name: '招待メールを送る' }))

      // Assert
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'スタッフが見つかりません',
        }),
      ).toBeVisible()
      expect(await mailedTo()).toEqual([])
    })
  })

  describe('an account', () => {
    it('should show the address, the role, the state, the two factors and the last sign-in of an account', async () => {
      // Arrange
      await arrangeAccount(STYLIST, {
        status: 'locked',
        twoFactorStatus: 'enabled',
        lastLoginAt: '2026-11-19T00:15:00Z',
      })

      // Act
      await openAccountOf(TANAKA)

      // Assert
      await cardHeading('ログインアカウント')
      expect(termsOf('ログインアカウント').slice(0, 5)).toEqual([
        ['メールアドレス', STYLIST],
        ['ロール', 'スタッフ'],
        ['状態', 'ロック中'],
        ['2 要素認証', '設定しています'],
        ['最後のログイン', '2026年11月19日（木） 09:15'],
      ])
      expect(
        screen.getByText(/15 分の間、新しいログインができません/),
      ).toBeVisible()
      expect(rolesOffered()).toEqual([
        ['マネージャー', false],
        ['スタッフ', true],
      ])
    })

    it('should give an account another role, which it has from its next request on', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAccountOf(TANAKA)
      await user.click(
        await screen.findByRole('radio', { name: 'マネージャー' }),
      )

      // Act
      await user.click(screen.getByRole('button', { name: 'ロールを変える' }))

      // Assert
      expect(
        await screen.findByText(
          'Hiroshi Tanaka さんのロールを、マネージャーにしました。次の操作から、新しいロールで扱われます。',
        ),
      ).toBeVisible()
      expect(termsOf('ログインアカウント')[1]).toEqual([
        'ロール',
        'マネージャー',
      ])
      expect(await storedAccountOf(STYLIST)).toEqual([
        { role: 'manager', linked: true },
      ])
    })

    it('should ask for nothing when the role stays as it is', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAccountOf(TANAKA)

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'ロールを変える' }),
      )

      // Assert
      expect(
        await screen.findByText('変更された項目はありません。'),
      ).toBeVisible()
      expect(await storedAccountOf(STYLIST)).toEqual([
        { role: 'staff', linked: true },
      ])
    })

    it('should unlink an account after the dialog asked, and offer to invite the member again', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAccountOf(TANAKA)
      await user.click(
        await screen.findByRole('button', { name: '紐づけを解除する' }),
      )
      const dialog = await screen.findByRole('dialog', {
        name: 'Hiroshi Tanaka さんのログインアカウントの紐づけを解除しますか？',
      })

      // Act
      await user.click(within(dialog).getByRole('button', { name: '解除する' }))

      // Assert
      await expectFocusOn('招待する')
      expect(notifications()).toContain(
        'Hiroshi Tanaka さんのログインアカウントの紐づけを解除しました。',
      )
      expect(
        screen.getByText(/ログインアカウントは、まだありません。/),
      ).toBeVisible()
      expect(await storedAccountOf(STYLIST)).toEqual([
        { role: 'staff', linked: false },
      ])
    })

    it('should show what the member has now when the account was unlinked meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAccountOf(TANAKA)
      await user.click(
        await screen.findByRole('radio', { name: 'マネージャー' }),
      )
      await unlinkedMeanwhile(TANAKA)

      // Act
      await user.click(screen.getByRole('button', { name: 'ロールを変える' }))

      // Assert
      await expectFocusOn('招待する')
      expect(notifications()).toContain(
        'その間に、Hiroshi Tanaka さんのログインアカウントか招待が、変わっていました（招待が受け入れられたか、取り消されたか、紐づけが解除されていました）。いまの状態を出しています。',
      )
      expect(await storedAccountOf(STYLIST)).toEqual([
        { role: 'staff', linked: false },
      ])
    })

    it('should not offer the owner to change or unlink their own account', async () => {
      // Act
      await openAccountOf(MORI)

      // Assert
      expect(
        await screen.findByText(
          'ご自身のアカウントです。このアカウントからは、ロールを変えることも、紐づけを解除することもできません。',
        ),
      ).toBeVisible()
      expect(termsOf('ログインアカウント')[1]).toEqual(['ロール', 'オーナー'])
      expect(
        screen.queryByRole('region', { name: 'ロールを変える' }),
      ).toBeNull()
      expect(
        screen.queryByRole('button', { name: '紐づけを解除する' }),
      ).toBeNull()
    })

    it('should offer an owner no role of an owner for the account of another owner, and say who gives it back', async () => {
      // Arrange
      await arrangeOwnerAccount(MANAGER)

      // Act
      await openAccountOf('STF901')

      // Assert
      await screen.findByRole('radiogroup', { name: 'ロール' })
      expect(rolesOffered()).toEqual([
        ['マネージャー', false],
        ['スタッフ', false],
      ])
      expect(
        screen.getByRole('radiogroup', { name: 'ロール' }),
      ).toHaveAccessibleDescription(
        /オーナーのロールを外すと、戻せるのは管理者だけです。/,
      )
    })
  })

  describe('who keeps the accounts', () => {
    it('should tell a manager that the accounts of the staff are not theirs to keep, without asking the API', async () => {
      // Act
      await openAccountOf(TANAKA, MANAGER)

      // Assert
      expect(
        await screen.findByText(
          'このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。',
        ),
      ).toBeVisible()
      expect(
        screen.queryByRole('region', { name: 'ログインアカウント' }),
      ).toBeNull()
    })

    it('should tell the owner of another salon the same, as the API refused it', async () => {
      // Arrange
      await arrangeOwnerAccount(THERAPIST)

      // Act
      await openAccountOf(TANAKA, THERAPIST)

      // Assert
      expect(
        await screen.findByText(
          'このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。',
        ),
      ).toBeVisible()
      expect(
        screen.queryByRole('region', { name: 'ログインアカウント' }),
      ).toBeNull()
    })
  })

  it.each<[string, () => Promise<unknown>, string]>([
    [
      'the invitation of a member without an account',
      async () => undefined,
      '招待する',
    ],
    [
      'an invitation',
      () =>
        arrangeInvitation(WATANABE.code, { role: 'staff', mailedAgo: '1 day' }),
      '招待し直す',
    ],
  ])('should be accessible on %s', async (_, arrange, card) => {
    // Arrange
    await arrange()
    await openAccountOf(WATANABE.code)

    // Act
    await cardHeading(card)

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })

  it('should be accessible on an account', async () => {
    // Arrange
    await openAccountOf(TANAKA)

    // Act
    await cardHeading('ロールを変える')

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
