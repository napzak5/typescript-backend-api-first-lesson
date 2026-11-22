import { applications } from '@beauty-salon-frontend/brand'
import { signIn } from '@beauty-salon-frontend/session'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'
import * as z from 'zod'
import { App } from '../App'
import { accessTokenOf } from '../bookings/__tests__/arrangements'

const TITLE = applications.portal.name
const ADMIN_APP = 'https://admin.salon.example'

/** An address that has no account, and one of the seed data that has */
const VISITOR = 'first.visit@example.com'
const CUSTOMER = 'customer1@example.com'
const OWNER = 'owner@beautysalon.jp'
/** A member of the staff of the seed data who has no account, and one who has */
const STAFF_WITHOUT_ACCOUNT = 'yui.watanabe@beautysalon.jp'
const STAFF_WITH_ACCOUNT = 'stylist1@beautysalon.jp'

/** A password the API takes, and one it finds easy to guess */
const PASSWORD = 'kirei na kami de dekakeru'
const GUESSABLE = 'password1234567890'

const TOO_SHORT = 'パスワードが短すぎます。15 文字以上で入力してください。'
const GUESSABLE_SAID =
  'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。'

/** The address the application is at, as the router knows it */
let address = ''

/** Opens an address in the same tab, as the link of a mail opened in it does */
let go: (to: string) => void = () => undefined

const Address = () => {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  address = `${pathname}${hash}`
  go = (to) => void navigate(to)

  return null
}

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** The link of the last mail to `to`, as the router takes it. */
const mailedPath = async (to: string): Promise<string> => {
  const { pathname, hash } = new URL(await testApi().mailedLink(to))

  return `${pathname}${hash}`
}

/** Opens the link of the last mail to `to`, as its reader would. */
const openMailedLink = async (to: string): Promise<void> => {
  renderAt(await mailedPath(to))
}

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

const main = () => within(screen.getByRole('main'))

/**
 * What the status regions of the screen say. The region of the notifications
 * is there before anything is said, empty.
 */
const statuses = (): string[] =>
  main()
    .getAllByRole('status')
    .map((status) => status.textContent)
    .filter((text) => text !== '')

const RESENT =
  '確認メールの再送を受け付けました。届くまで、しばらくお待ちください。'

const emailField = () => screen.getByRole('textbox', { name: 'メールアドレス' })

const button = (name: string) => screen.getByRole('button', { name })

/** Asks the API as a client that is no screen does: to arrange what a test starts from. */
const ask = (
  path: string,
  body: unknown,
  { method = 'POST', accessToken = '' } = {},
): Promise<Response> =>
  fetch(`${testApi().origin}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken === '' ? {} : { Authorization: `Bearer ${accessToken}` }),
    },
    body: JSON.stringify(body),
  })

const registerThroughApi = async (email: string): Promise<void> => {
  const answer = await ask('/auth/register', { email, password: PASSWORD })
  expect(answer.status).toBe(204)
}

const askForResetThroughApi = async (email: string): Promise<void> => {
  const answer = await ask('/auth/forgot-password', { email })
  expect(answer.status).toBe(204)
}

const tokenOf = async (to: string): Promise<string> =>
  new URL(await testApi().mailedLink(to)).hash.replace('#token=', '')

const staffSchema = z.tuple([z.object({ id: z.string(), salonId: z.string() })])

/** The path of a member of the staff, below the salon they work at. */
const staffPath = async (email: string): Promise<string> => {
  const [{ id, salonId }] = staffSchema.parse(
    await testApi().query(
      'select id::text, "salonId"::text from staff where email = $1',
      [email],
    ),
  )

  return `/salons/${salonId}/staff/${id}`
}

/** Invites a member of the staff, as the owner of the salon does. */
const invite = async (email: string, owner: string): Promise<void> => {
  const answer = await ask(
    `${await staffPath(email)}/invitation`,
    { role: 'staff' },
    { accessToken: owner },
  )
  expect(answer.status).toBe(201)
}

const accountSchema = z.array(
  z.object({ status: z.string(), emailVerified: z.boolean() }),
)

const accountOf = async (email: string) =>
  accountSchema.parse(
    await testApi().query(
      'select status::text, "emailVerified" from users where email = $1',
      [email],
    ),
  )

/** Lets the minute pass after which the API mails the same account again. */
const letTheMinutePass = (column: string, email: string) =>
  testApi().query(
    `update users set "${column}" = "${column}" - interval '2 minutes' where email = $1`,
    [email],
  )

/** The operations of the API that were asked for, as the paths below `/api/v1`. */
const operationsAsked = (fetched: MockInstance<typeof fetch>): string[] =>
  fetched.mock.calls.flatMap(([input]) => {
    const [, operation] = String(input).split('/api/v1')

    return operation === undefined ? [] : [operation]
  })

const subjectsTo = async (to: string): Promise<string[]> =>
  (await testApi().mails())
    .filter((mail) => mail.to === to)
    .map((mail) => mail.subject)

const signInWith = (email: string, password: string) =>
  signIn({ email, password, rememberMe: false, twoFactorCode: null })

describe('the screens of an account, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    vi.stubEnv('VITE_ADMIN_APP_URL', ADMIN_APP)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('registering', () => {
    const register = async (email: string, password: string): Promise<void> => {
      const user = userEvent.setup()
      await user.type(emailField(), email)
      await user.type(screen.getByLabelText('パスワード'), password)
      await user.click(button('登録する'))
    }

    it('should be reached from the sign-in screen', async () => {
      // Arrange
      renderAt('/sign-in')

      // Act
      await userEvent.click(
        await screen.findByRole('link', { name: 'アカウントを登録' }),
      )

      // Assert
      expect(await heading('アカウントの登録')).toHaveFocus()
      expect(document.title).toBe(`アカウントの登録 | ${TITLE}`)
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should create an account that waits for its address to be confirmed, and say where the link is', async () => {
      // Arrange
      renderAt('/register')
      const user = userEvent.setup()

      // Act: sent with the Enter key in its last control
      await user.type(emailField(), VISITOR)
      await user.type(screen.getByLabelText('パスワード'), `${PASSWORD}{Enter}`)

      // Assert
      expect(await heading('確認メールを送りました')).toHaveFocus()
      expect(main().getByText(new RegExp(`^${VISITOR}`))).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])
      expect(await accountOf(VISITOR)).toEqual([
        { status: 'unverified', emailVerified: false },
      ])
      expect(await subjectsTo(VISITOR)).toEqual(['メールアドレスの確認'])
      expect(await signInWith(VISITOR, PASSWORD)).toEqual({
        type: 'wrongCredentials',
      })
    })

    it('should say the same for an address that has an account, and mail nothing', async () => {
      // Arrange
      renderAt('/register')

      // Act
      await register(CUSTOMER, PASSWORD)

      // Assert
      expect(await heading('確認メールを送りました')).toBeVisible()
      expect(main().getByText(new RegExp(`^${CUSTOMER}`))).toBeVisible()
      expect(await testApi().mails()).toEqual([])
      expect(await signInWith(CUSTOMER, PASSWORD)).toEqual({
        type: 'wrongCredentials',
      })
    })

    it('should say at each control what is missing, go to the first, and send nothing', async () => {
      // Arrange
      const fetched = vi.spyOn(globalThis, 'fetch')
      renderAt('/register')

      // Act
      await userEvent.click(button('登録する'))

      // Assert
      expect(emailField()).toHaveFocus()
      expect(emailField()).toHaveAccessibleDescription(
        '確認のメールをお送りします。 メールアドレスを入力してください。',
      )
      expect(screen.getByLabelText('パスワード')).toHaveAccessibleDescription(
        expect.stringContaining('パスワードを入力してください。'),
      )
      expect(await findAccessibilityViolations()).toEqual([])
      expect(fetched).not.toHaveBeenCalled()
    })

    it('should not send a password that is too short', async () => {
      // Arrange
      const fetched = vi.spyOn(globalThis, 'fetch')
      renderAt('/register')

      // Act
      await register(VISITOR, 'a'.repeat(14))

      // Assert
      expect(screen.getByLabelText('パスワード')).toHaveFocus()
      expect(screen.getByLabelText('パスワード')).toHaveAccessibleDescription(
        expect.stringContaining(TOO_SHORT),
      )
      expect(fetched).not.toHaveBeenCalled()
    })

    it('should say at the password what the API says about one that is easy to guess, and create nothing', async () => {
      // Arrange
      renderAt('/register')

      // Act
      await register(VISITOR, GUESSABLE)

      // Assert
      expect(await screen.findByText(GUESSABLE_SAID)).toBeVisible()
      expect(screen.getByLabelText('パスワード')).toHaveFocus()
      expect(screen.getByLabelText('パスワード')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      expect(await accountOf(VISITOR)).toEqual([])
      expect(await testApi().mails()).toEqual([])
    })

    it('should ask for the mail again when it did not arrive: the API sends another once a minute has passed', async () => {
      // Arrange
      renderAt('/register')
      await register(VISITOR, PASSWORD)
      await heading('確認メールを送りました')
      const first = await testApi().mailedLink(VISITOR)
      await letTheMinutePass('emailVerificationExpiry', VISITOR)

      // Act
      await userEvent.click(button('確認メールをもう一度送る'))

      // Assert
      expect(await main().findByText(RESENT)).toBeVisible()
      expect(statuses()).toEqual([RESENT])
      expect(await subjectsTo(VISITOR)).toEqual([
        'メールアドレスの確認',
        'メールアドレスの確認',
      ])
      expect(await testApi().mailedLink(VISITOR)).not.toBe(first)
    })

    it('should say that the mail was asked for also within the minute, when the API sends none', async () => {
      // Arrange
      renderAt('/register')
      await register(VISITOR, PASSWORD)
      await heading('確認メールを送りました')

      // Act
      await userEvent.click(button('確認メールをもう一度送る'))

      // Assert
      expect(await main().findByText(RESENT)).toBeVisible()
      expect(statuses()).toEqual([RESENT])
      expect(await subjectsTo(VISITOR)).toEqual(['メールアドレスの確認'])
    })
  })

  describe('confirming the address', () => {
    it('should change nothing when the link is opened, and take the token out of the address', async () => {
      // Arrange
      await registerThroughApi(VISITOR)
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await openMailedLink(VISITOR)

      // Assert
      expect(await heading('メールアドレスの確認')).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'メールアドレスを確認する' }),
      ).toBeEnabled()
      expect(address).toBe('/verify-email')
      expect(await findAccessibilityViolations()).toEqual([])
      // Software that opens the links of a mail ahead of its reader uses nothing up
      expect(operationsAsked(fetched)).toEqual([])
      expect(await accountOf(VISITOR)).toEqual([
        { status: 'unverified', emailVerified: false },
      ])
    })

    it('should confirm the address when the button is pressed: the account signs in from then on', async () => {
      // Arrange
      await registerThroughApi(VISITOR)
      await openMailedLink(VISITOR)

      // Act
      await userEvent.click(
        await screen.findByRole('button', { name: 'メールアドレスを確認する' }),
      )

      // Assert
      expect(await heading('メールアドレスを確認しました')).toHaveFocus()
      expect(
        screen.getByRole('link', { name: 'サインインする' }),
      ).toHaveAttribute('href', '/sign-in')
      expect(await findAccessibilityViolations()).toEqual([])
      expect(await accountOf(VISITOR)).toEqual([
        { status: 'active', emailVerified: true },
      ])
      expect(await signInWith(VISITOR, PASSWORD)).toEqual({ type: 'signedIn' })
    })

    it('should say that a link that was used works no more, and offer the ways on', async () => {
      // Arrange
      await registerThroughApi(VISITOR)
      await ask('/auth/verify-email/confirm', { token: await tokenOf(VISITOR) })
      await openMailedLink(VISITOR)

      // Act
      await userEvent.click(
        await screen.findByRole('button', { name: 'メールアドレスを確認する' }),
      )

      // Assert
      expect(await heading('このリンクは使えません')).toHaveFocus()
      expect(main().getByRole('link', { name: 'サインイン' })).toHaveAttribute(
        'href',
        '/sign-in',
      )
      expect(emailField()).toBeRequired()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should mail a new link to somebody whose link ran out, which confirms the address', async () => {
      // Arrange
      await registerThroughApi(VISITOR)
      await testApi().query(
        `update users set "emailVerificationExpiry" = now() - interval '1 minute' where email = $1`,
        [VISITOR],
      )
      await openMailedLink(VISITOR)
      const user = userEvent.setup()
      await user.click(
        await screen.findByRole('button', { name: 'メールアドレスを確認する' }),
      )
      await heading('このリンクは使えません')

      // Act
      await user.type(emailField(), VISITOR)
      await user.click(button('確認メールを送る'))

      // Assert
      expect(await heading('確認メールを送りました')).toHaveFocus()
      expect(await subjectsTo(VISITOR)).toHaveLength(2)
      expect(
        (
          await ask('/auth/verify-email/confirm', {
            token: await tokenOf(VISITOR),
          })
        ).status,
      ).toBe(204)
    })

    it('should ask for the address of somebody who opens the page without a link, and say what is wrong with it', async () => {
      // Arrange
      renderAt('/verify-email')
      await heading('メールアドレスの確認')
      const user = userEvent.setup()

      // Act: sent with the Enter key in its control
      await user.type(emailField(), 'hanako@{Enter}')

      // Assert
      expect(emailField()).toHaveFocus()
      expect(emailField()).toHaveAccessibleDescription(
        expect.stringContaining(
          'メールアドレスは、hanako@example.com のような形で入力してください。',
        ),
      )
      expect(
        screen.queryByRole('button', { name: 'メールアドレスを確認する' }),
      ).not.toBeInTheDocument()
      expect(await findAccessibilityViolations()).toEqual([])
    })
  })

  describe('asking for a new password', () => {
    const askFor = async (email: string): Promise<void> => {
      const user = userEvent.setup()
      await user.type(emailField(), email)
      await user.click(button('再設定のメールを送る'))
    }

    it('should be reached from the sign-in screen', async () => {
      // Arrange
      renderAt('/sign-in')

      // Act
      await userEvent.click(
        await screen.findByRole('link', { name: 'パスワードを忘れた場合' }),
      )

      // Assert
      expect(await heading('パスワードの再設定')).toHaveFocus()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should mail a link to the account, and leave the account as it is', async () => {
      // Arrange
      renderAt('/forgot-password')

      // Act: sent with the Enter key in its control
      await userEvent.type(emailField(), `${CUSTOMER}{Enter}`)

      // Assert
      expect(await heading('再設定のメールを送りました')).toHaveFocus()
      expect(main().getByText(new RegExp(`^${CUSTOMER}`))).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])
      expect(await subjectsTo(CUSTOMER)).toEqual(['パスワードの再設定'])
      expect(await signInWith(CUSTOMER, testApi().seedPassword)).toEqual({
        type: 'signedIn',
      })
    })

    it('should say the same for an address without an account, and mail nothing', async () => {
      // Arrange
      renderAt('/forgot-password')

      // Act
      await askFor(VISITOR)

      // Assert
      expect(await heading('再設定のメールを送りました')).toBeVisible()
      expect(main().getByText(new RegExp(`^${VISITOR}`))).toBeVisible()
      expect(await testApi().mails()).toEqual([])
    })

    it('should send nothing for a value that is no address', async () => {
      // Arrange
      const fetched = vi.spyOn(globalThis, 'fetch')
      renderAt('/forgot-password')

      // Act
      await askFor('customer1')

      // Assert
      expect(emailField()).toHaveFocus()
      expect(emailField()).toHaveAccessibleDescription(
        'メールアドレスは、hanako@example.com のような形で入力してください。',
      )
      expect(fetched).not.toHaveBeenCalled()
    })
  })

  describe('setting a new password', () => {
    const choose = async (password: string): Promise<void> => {
      const user = userEvent.setup()
      await user.type(
        await screen.findByLabelText('新しいパスワード'),
        password,
      )
      await user.click(button('パスワードを変更する'))
    }

    it('should ask for the password once the API has said that the link works, with the token out of the address', async () => {
      // Arrange
      await askForResetThroughApi(CUSTOMER)
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await openMailedLink(CUSTOMER)

      // Assert
      expect(await screen.findByLabelText('新しいパスワード')).toBeRequired()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'パスワードの再設定',
      )
      expect(address).toBe('/reset-password')
      expect(await findAccessibilityViolations()).toEqual([])
      // Asking whether the link works is all that opening it does
      expect(operationsAsked(fetched)).toEqual(['/auth/reset-password/verify'])
    })

    it('should set the password: the new one signs in, the old one no more, and the owner is told by mail', async () => {
      // Arrange
      await askForResetThroughApi(CUSTOMER)
      await openMailedLink(CUSTOMER)

      // Act: sent with the Enter key in its control
      await userEvent.type(
        await screen.findByLabelText('新しいパスワード'),
        `${PASSWORD}{Enter}`,
      )

      // Assert
      expect(await heading('パスワードを変更しました')).toHaveFocus()
      expect(
        screen.getByRole('link', { name: 'サインインする' }),
      ).toHaveAttribute('href', '/sign-in')
      expect(await findAccessibilityViolations()).toEqual([])
      expect(await subjectsTo(CUSTOMER)).toEqual([
        'パスワードの再設定',
        'パスワードが変更されました',
      ])
      expect(await signInWith(CUSTOMER, testApi().seedPassword)).toEqual({
        type: 'wrongCredentials',
      })
      expect(await signInWith(CUSTOMER, PASSWORD)).toEqual({ type: 'signedIn' })
    })

    it('should take the link of a later mail opened in the same tab, and show nothing of the link before', async () => {
      // Arrange
      await askForResetThroughApi(CUSTOMER)
      await openMailedLink(CUSTOMER)
      await choose(PASSWORD)
      await heading('パスワードを変更しました')
      await askForResetThroughApi(CUSTOMER)
      const later = await mailedPath(CUSTOMER)

      // Act
      act(() => go(later))

      // Assert
      expect(await screen.findByLabelText('新しいパスワード')).toBeRequired()
      expect(screen.queryByText('パスワードを変更しました')).toBeNull()
      expect(address).toBe('/reset-password')
    })

    it('should say at the password what the API says about one that is easy to guess, and take a better one with the same link', async () => {
      // Arrange
      await askForResetThroughApi(CUSTOMER)
      await openMailedLink(CUSTOMER)
      await choose(GUESSABLE)
      const field = screen.getByLabelText('新しいパスワード')
      await screen.findByText(GUESSABLE_SAID)
      const focused = document.activeElement

      // Act
      await userEvent.clear(field)
      await choose(PASSWORD)

      // Assert
      expect(focused).toBe(field)
      expect(await heading('パスワードを変更しました')).toBeVisible()
    })

    it('should not send a password that is too short', async () => {
      // Arrange
      await askForResetThroughApi(CUSTOMER)
      await openMailedLink(CUSTOMER)
      await screen.findByLabelText('新しいパスワード')
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await choose('mijikai')

      // Assert
      expect(
        screen.getByLabelText('新しいパスワード'),
      ).toHaveAccessibleDescription(expect.stringContaining(TOO_SHORT))
      expect(fetched).not.toHaveBeenCalled()
    })

    it.each([
      [
        'was used',
        async () => {
          await ask('/auth/reset-password', {
            token: await tokenOf(CUSTOMER),
            newPassword: PASSWORD,
          })
        },
      ],
      [
        'ran out',
        async () => {
          await testApi().query(
            `update users set "passwordResetExpiry" = now() - interval '1 minute' where email = $1`,
            [CUSTOMER],
          )
        },
      ],
    ])(
      'should ask for no password with a link that %s, and lead to a new one',
      async (_case, spoil) => {
        // Arrange
        await askForResetThroughApi(CUSTOMER)
        const link = await mailedPath(CUSTOMER)
        await spoil()

        // Act
        renderAt(link)

        // Assert
        expect(await heading('このリンクは使えません')).toBeVisible()
        expect(
          screen.queryByLabelText('新しいパスワード'),
        ).not.toBeInTheDocument()
        expect(
          screen.getByRole('link', { name: '再設定のメールをもう一度送る' }),
        ).toHaveAttribute('href', '/forgot-password')
        expect(await findAccessibilityViolations()).toEqual([])
      },
    )

    it('should say that the link works no more when it ran out while the password was chosen', async () => {
      // Arrange
      await askForResetThroughApi(CUSTOMER)
      await openMailedLink(CUSTOMER)
      await screen.findByLabelText('新しいパスワード')
      await testApi().query(
        `update users set "passwordResetExpiry" = now() - interval '1 minute' where email = $1`,
        [CUSTOMER],
      )

      // Act
      await choose(PASSWORD)

      // Assert
      expect(await heading('このリンクは使えません')).toHaveFocus()
      expect(await signInWith(CUSTOMER, PASSWORD)).toEqual({
        type: 'wrongCredentials',
      })
    })

    it('should lead somebody who opens the page without a link to a new one, and ask the API nothing', async () => {
      // Arrange
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      renderAt('/reset-password')

      // Assert
      expect(await heading('このリンクは使えません')).toBeVisible()
      expect(
        screen.getByRole('link', { name: '再設定のメールをもう一度送る' }),
      ).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])
      expect(fetched).not.toHaveBeenCalled()
    })
  })

  describe('taking an invitation to the staff of a salon', () => {
    it('should show whom the invitation is for, and make the account with the password that is chosen', async () => {
      // Arrange
      await invite(STAFF_WITHOUT_ACCOUNT, await accessTokenOf(OWNER))
      const fetched = vi.spyOn(globalThis, 'fetch')
      await openMailedLink(STAFF_WITHOUT_ACCOUNT)
      const user = userEvent.setup()
      const password = await screen.findByLabelText('パスワード')
      const shown = {
        address,
        // Asking what the invitation is is all that opening the link does
        asked: operationsAsked(fetched),
        email: emailField().getAttribute('value'),
        readOnly: emailField().hasAttribute('readonly'),
        role: main().getByText('スタッフ').tagName,
        violations: await findAccessibilityViolations(),
      }

      // Act: sent with the Enter key in its control
      await user.type(password, `${PASSWORD}{Enter}`)

      // Assert
      expect(await heading('アカウントを作りました')).toHaveFocus()
      expect(shown).toEqual({
        address: '/accept-staff-invitation',
        asked: ['/auth/staff-invitation/verify'],
        email: STAFF_WITHOUT_ACCOUNT,
        readOnly: true,
        role: 'DD',
        violations: [],
      })
      expect(
        screen.getByRole('link', { name: '店舗向けの画面を開く' }),
      ).toHaveAttribute('href', ADMIN_APP)
      expect(await findAccessibilityViolations()).toEqual([])
      expect(
        await testApi().query(
          'select role::text, status::text from users where email = $1',
          [STAFF_WITHOUT_ACCOUNT],
        ),
      ).toEqual([{ role: 'staff', status: 'active' }])
      expect(await signInWith(STAFF_WITHOUT_ACCOUNT, PASSWORD)).toEqual({
        type: 'signedIn',
      })
    })

    it('should say at the password what the API says about one that is easy to guess, and leave the invitation open', async () => {
      // Arrange
      await invite(STAFF_WITHOUT_ACCOUNT, await accessTokenOf(OWNER))
      await openMailedLink(STAFF_WITHOUT_ACCOUNT)
      const user = userEvent.setup()

      // Act
      await user.type(await screen.findByLabelText('パスワード'), GUESSABLE)
      await user.click(button('アカウントを作る'))

      // Assert
      expect(await screen.findByText(GUESSABLE_SAID)).toBeVisible()
      expect(screen.getByLabelText('パスワード')).toHaveFocus()
      expect(
        await testApi().query('select 1 as open from staff_invitations'),
      ).toEqual([{ open: 1 }])
    })

    it('should ask somebody who has an account of the staff to sign in with it, and tie that account to the salon', async () => {
      // Arrange: the account of a stylist is taken from the salon, and the stylist is invited again
      const owner = await accessTokenOf(OWNER)
      const unlinked = await ask(
        `${await staffPath(STAFF_WITH_ACCOUNT)}/account`,
        {},
        { method: 'DELETE', accessToken: owner },
      )
      await invite(STAFF_WITH_ACCOUNT, owner)
      await openMailedLink(STAFF_WITH_ACCOUNT)
      const user = userEvent.setup()
      await heading('サインイン')
      const asked = {
        statuses: statuses(),
        help: main()
          .getByRole('link', { name: 'パスワードを忘れた場合' })
          .getAttribute('href'),
        violations: await findAccessibilityViolations(),
      }

      // Act
      await user.type(emailField(), STAFF_WITH_ACCOUNT)
      await user.type(
        screen.getByLabelText('パスワード'),
        testApi().seedPassword,
      )
      await user.click(button('サインイン'))
      const join = await screen.findByRole('button', { name: '招待を受ける' })
      const invitation = main().getByText(STAFF_WITH_ACCOUNT).tagName
      await user.click(join)

      // Assert
      expect(await heading('招待を受けました')).toHaveFocus()
      expect(unlinked.status).toBe(204)
      expect(asked).toEqual({
        statuses: [
          `この招待は、${STAFF_WITH_ACCOUNT} のスタッフのアカウントで受けられます。そのアカウントでサインインしてください。`,
        ],
        help: '/forgot-password',
        violations: [],
      })
      expect(invitation).toBe('DD')
      expect(
        screen.getByRole('link', { name: '店舗向けの画面を開く' }),
      ).toHaveAttribute('href', ADMIN_APP)
      expect(await findAccessibilityViolations()).toEqual([])
      expect(
        await testApi().query(
          'select count(*)::int as linked from staff where email = $1 and "userId" is not null',
          [STAFF_WITH_ACCOUNT],
        ),
      ).toEqual([{ linked: 1 }])
    })

    it('should say to somebody who signed in with another account that the invitation is not for it', async () => {
      // Arrange
      const owner = await accessTokenOf(OWNER)
      await ask(
        `${await staffPath(STAFF_WITH_ACCOUNT)}/account`,
        {},
        { method: 'DELETE', accessToken: owner },
      )
      await invite(STAFF_WITH_ACCOUNT, owner)
      await signInWith(CUSTOMER, testApi().seedPassword)
      await openMailedLink(STAFF_WITH_ACCOUNT)

      // Act
      await userEvent.click(
        await screen.findByRole('button', { name: '招待を受ける' }),
      )

      // Assert
      expect(await main().findByRole('alert')).toHaveTextContent(
        `サインインしているアカウントでは、この招待を受けられません。${STAFF_WITH_ACCOUNT} のスタッフのアカウントでサインインし直してください。`,
      )
      expect(await findAccessibilityViolations()).toEqual([])
      expect(
        await testApi().query('select 1 as open from staff_invitations'),
      ).toEqual([{ open: 1 }])
    })

    it('should say that the invitation cannot be used when its address has an account of another kind', async () => {
      // Arrange: the address in the ledger of the staff is that of a customer
      const owner = await accessTokenOf(OWNER)
      const corrected = await ask(
        await staffPath(STAFF_WITHOUT_ACCOUNT),
        { email: CUSTOMER },
        { method: 'PATCH', accessToken: owner },
      )
      await invite(CUSTOMER, owner)

      // Act
      await openMailedLink(CUSTOMER)

      // Assert
      expect(await heading('このリンクは使えません')).toBeVisible()
      expect(corrected.status).toBe(200)
      expect(
        main().getByText(/すでにアカウントがあり、この招待は使えません/),
      ).toBeVisible()
      expect(screen.queryByLabelText('パスワード')).not.toBeInTheDocument()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say that an invitation that was withdrawn works no more', async () => {
      // Arrange
      const owner = await accessTokenOf(OWNER)
      await invite(STAFF_WITHOUT_ACCOUNT, owner)
      const withdrawn = await ask(
        `${await staffPath(STAFF_WITHOUT_ACCOUNT)}/invitation`,
        {},
        { method: 'DELETE', accessToken: owner },
      )

      // Act
      await openMailedLink(STAFF_WITHOUT_ACCOUNT)

      // Assert
      expect(await heading('このリンクは使えません')).toBeVisible()
      expect(withdrawn.status).toBe(204)
      expect(main().getByText(/取り消されています/)).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say to somebody who opens the page without a link where the link is', async () => {
      // Act
      renderAt('/accept-staff-invitation')

      // Assert
      expect(await heading('このリンクは使えません')).toBeVisible()
      expect(
        main().getByText(
          'このページは、招待のメールのリンクから開いてください。',
        ),
      ).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])
    })
  })
})
