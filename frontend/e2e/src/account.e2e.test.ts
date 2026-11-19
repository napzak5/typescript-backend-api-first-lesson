import * as z from 'zod'
import { ADMIN, PORTAL } from './applications'
import { expectSoundPage } from './checks'
import { expect, test } from './fixtures'
import {
  accessTokenOf,
  emailField,
  enterCredentials,
  heading,
  OWNER,
  passwordField,
} from './sign-in'

/** An address that has no account, and a member of the staff of the seed data who has none */
const VISITOR = 'first.visit@example.com'
const INVITED = 'yui.watanabe@beautysalon.jp'

const PASSWORD = 'kirei na kami de dekakeru'

const WRONG_CREDENTIALS =
  'メールアドレスまたはパスワードが正しくありません。続けて 5 回誤ると、15 分間サインインできなくなります。'

const staffSchema = z.tuple([z.object({ id: z.string(), salonId: z.string() })])

test.describe('the account of a visitor, in a browser', () => {
  test('should register an account, confirm its address with the mailed link and sign in with it', async ({
    page,
    api,
  }) => {
    // Arrange: from the sign-in screen to the registration, and what it says after
    await page.goto(`${PORTAL.origin}/sign-in`)
    await page.getByRole('link', { name: 'アカウントを登録' }).click()
    await expect(heading(page, 'アカウントの登録')).toBeFocused()
    await expectSoundPage(page)
    await emailField(page).fill(VISITOR)
    await passwordField(page).fill(PASSWORD)
    await page.getByRole('button', { name: '登録する' }).click()
    await expect(heading(page, '確認メールを送りました')).toBeFocused()
    await expectSoundPage(page)

    // Act: the link of the mail, the button of its page, and the sign-in
    await page.goto(await api.mailedLink(VISITOR))
    const confirm = page.getByRole('button', {
      name: 'メールアドレスを確認する',
    })
    await expect(confirm).toBeVisible()
    const address = page.url()
    await expectSoundPage(page)
    await confirm.click()
    await expect(heading(page, 'メールアドレスを確認しました')).toBeFocused()
    await page.getByRole('link', { name: 'サインインする' }).click()
    await enterCredentials(page, VISITOR, PASSWORD)

    // Assert
    await expect(page.getByText('サインインしました。')).toBeVisible()
    await expect(page.getByRole('banner')).toContainText(VISITOR)
    await expect(page).toHaveURL(`${PORTAL.origin}/`)
    // The token is gone from the address once the page has read it
    expect(address).toBe(`${PORTAL.origin}/verify-email`)
  })

  test('should not show the password until its owner asks to see it', async ({
    page,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/register`)
    await passwordField(page).fill(PASSWORD)
    const hidden = await passwordField(page).getAttribute('type')

    // Act
    await page.getByLabel('パスワードを表示する').check()

    // Assert
    await expect(passwordField(page)).toHaveAttribute('type', 'text')
    await expect(passwordField(page)).toHaveValue(PASSWORD)
    expect(hidden).toBe('password')
    await expectSoundPage(page)
  })

  test('should set a new password with the mailed link: the old one signs in no more', async ({
    page,
    api,
  }) => {
    // Arrange: the sign-in screen of the admin application leads to the portal
    await page.goto(ADMIN.origin)
    await page.getByRole('link', { name: 'パスワードを忘れた場合' }).click()
    await expect(heading(page, 'パスワードの再設定')).toBeVisible()
    await expect(page).toHaveURL(`${PORTAL.origin}/forgot-password`)
    await expectSoundPage(page)
    await emailField(page).fill(OWNER)
    await page.getByRole('button', { name: '再設定のメールを送る' }).click()
    await expect(heading(page, '再設定のメールを送りました')).toBeFocused()
    await expectSoundPage(page)

    // Act
    await page.goto(await api.mailedLink(OWNER))
    const newPassword = page.getByLabel('新しいパスワード', { exact: true })
    await expect(newPassword).toBeVisible()
    const address = page.url()
    await expectSoundPage(page)
    await newPassword.fill(PASSWORD)
    await page.getByRole('button', { name: 'パスワードを変更する' }).click()
    await expect(heading(page, 'パスワードを変更しました')).toBeFocused()

    // Assert
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(page.getByText(WRONG_CREDENTIALS)).toBeVisible()
    await enterCredentials(page, OWNER, PASSWORD)
    await expect(heading(page, ADMIN.title)).toBeFocused()
    await expect(page.getByRole('banner')).toContainText(OWNER)
    expect(address).toBe(`${PORTAL.origin}/reset-password`)
  })

  test('should say that a link works no more once it was used, and lead to a new one', async ({
    page,
    request,
    api,
  }) => {
    // Arrange
    await request.post(`${api.origin}/api/v1/auth/forgot-password`, {
      data: { email: OWNER },
    })
    const link = await api.mailedLink(OWNER)
    await request.post(`${api.origin}/api/v1/auth/reset-password`, {
      data: {
        token: new URL(link).hash.replace('#token=', ''),
        newPassword: PASSWORD,
      },
    })

    // Act
    await page.goto(link)

    // Assert
    await expect(heading(page, 'このリンクは使えません')).toBeVisible()
    await expect(
      page.getByRole('link', { name: '再設定のメールをもう一度送る' }),
    ).toHaveAttribute('href', '/forgot-password')
    await expectSoundPage(page)
  })
})

test.describe('the invitation of a member of the staff, in a browser', () => {
  test('should make the account of the invited person, who then signs in to the admin application', async ({
    page,
    request,
    api,
  }) => {
    // Arrange: the owner invites a member of the staff who has no account
    const [{ id, salonId }] = staffSchema.parse(
      await api.query(
        'select id::text, "salonId"::text from staff where email = $1',
        [INVITED],
      ),
    )
    const invited = await request.post(
      `${api.origin}/api/v1/salons/${salonId}/staff/${id}/invitation`,
      {
        headers: {
          Authorization: `Bearer ${await accessTokenOf(request, api, OWNER)}`,
        },
        data: { role: 'staff' },
      },
    )

    // Act: the link of the mail, a password, and on to the admin application
    await page.goto(await api.mailedLink(INVITED))
    await expect(heading(page, 'スタッフアカウントへの招待')).toBeVisible()
    await expect(emailField(page)).toHaveValue(INVITED)
    const address = page.url()
    await expectSoundPage(page)
    await passwordField(page).fill(PASSWORD)
    await page.getByRole('button', { name: 'アカウントを作る' }).click()
    await expect(heading(page, 'アカウントを作りました')).toBeFocused()
    await expectSoundPage(page)
    await page.getByRole('link', { name: '店舗向けの画面を開く' }).click()
    await enterCredentials(page, INVITED, PASSWORD)

    // Assert
    await expect(heading(page, ADMIN.title)).toBeFocused()
    await expect(page).toHaveURL(`${ADMIN.origin}/`)
    await expect(page.getByRole('banner')).toContainText(INVITED)
    expect(invited.status()).toBe(201)
    expect(address).toBe(`${PORTAL.origin}/accept-staff-invitation`)
  })
})

test.describe('the screens of an account, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the registration and what it says about the values into the width', async ({
    page,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/register`)

    // Act
    await page.getByRole('button', { name: '登録する' }).click()

    // Assert
    await expect(page.getByText('パスワードを入力してください。')).toBeVisible()
    await expect(emailField(page)).toBeFocused()
    await expectSoundPage(page)
  })
})
