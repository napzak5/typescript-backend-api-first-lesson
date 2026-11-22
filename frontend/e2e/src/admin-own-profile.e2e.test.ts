import { STYLIST } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN, PORTAL } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { mainMenuLink } from './main-menu'
import { ADMIN_START, enterCredentials, heading } from './sign-in'

/*
 * The profile of a member of the staff, as the member keeps it with the
 * keyboard alone: Hiroshi Tanaka (the account stylist1) opens it from the
 * navigation, writes his specialties and his introduction anew, and reads them
 * on the page of the salon that the customers read. The profile is shown
 * on a screen as narrow as a phone as well.
 */

const SPECIALTIES = ['カット', 'メンズカット', 'ヘッドスパ']
const BIO =
  '週末は指名のお客様が中心です。平日の夕方は、ご予約が取りやすくなっています。'

const RECORD = 'お客様に見せるプロフィール'

const storedSchema = z.array(
  z.object({ specialties: z.array(z.string()), bio: z.string().nullable() }),
)

/** The specialties and the introduction of the member of an address, as the database of the API has them. */
const storedIntroductionOf = async (api: TestApi, email: string) =>
  storedSchema.parse(
    await api.query(
      'select specialties, bio from staff where email = $1 and "deletedAt" is null',
      [email],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Writes a control anew with the keyboard: what it held is selected and written over. */
const writeOver = async (control: Locator, text: string): Promise<void> => {
  await control.focus()
  await control.press('ControlOrMeta+a')
  await control.pressSequentially(text)
}

const recordHeading = (page: Page): Locator =>
  page.getByRole('heading', { level: 2, name: RECORD, exact: true })

test.describe('the own profile, in a browser', () => {
  test('should let a stylist write his introduction anew from the navigation, and show it to the customers, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(ADMIN.origin)
    await enterCredentials(page, STYLIST, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeFocused()

    // Act: from the navigation to the profile
    await pressWithTheKeyboard(mainMenuLink(page, 'プロフィール'))

    // Assert
    await expect(heading(page, 'プロフィール')).toBeVisible()
    await expect(page).toHaveURL(`${ADMIN.origin}/account/profile`)
    await expect(
      page.getByRole('region', { name: RECORD, exact: true }),
    ).toContainText('Hiroshi Tanaka')

    // Act: the specialties and the introduction, written over and saved
    await writeOver(
      page.getByRole('textbox', { name: '専門' }),
      SPECIALTIES.join('、'),
    )
    await writeOver(page.getByRole('textbox', { name: '紹介文' }), BIO)
    await pressWithTheKeyboard(page.getByRole('button', { name: '保存する' }))

    // Assert
    await expect(recordHeading(page)).toBeFocused()
    await expect(
      page.getByText(
        'プロフィールを保存しました。お客様の画面に、すぐに出ます。',
      ),
    ).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: RECORD, exact: true })
        .getByRole('list', { name: '専門' })
        .getByRole('listitem'),
    ).toHaveText(SPECIALTIES)
    expect(await storedIntroductionOf(api, STYLIST)).toEqual([
      { specialties: SPECIALTIES, bio: BIO },
    ])

    // Act: to the page of the salon the customers read
    await pressWithTheKeyboard(
      page.getByRole('link', {
        name: 'お客様からの見え方を、サロンのページで見る',
      }),
    )

    // Assert
    await expect(page).toHaveURL(`${PORTAL.origin}/salons/${salon}`)
    await expect(
      page
        .getByRole('list', { name: 'Hiroshi Tanakaの得意な施術' })
        .getByRole('listitem'),
    ).toHaveText(SPECIALTIES)
    await expect(page.getByText(BIO)).toBeVisible()
  })
})

test.describe('the own profile, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the profile, its form and what was refused at it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/account/profile`)
    await enterCredentials(page, STYLIST, api.seedPassword)

    // Act
    await expect(recordHeading(page)).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await writeOver(
      page.getByRole('textbox', { name: '写真の URL' }),
      'photos.example.com/tanaka.jpg',
    )
    await page.getByRole('button', { name: '保存する' }).click()

    // Assert
    await expect(
      page.getByRole('textbox', { name: '写真の URL' }),
    ).toHaveAccessibleDescription(
      /ドメイン名（example\.com など）の URL を、500 文字以内で入力してください。/,
    )
    await expectSoundPage(page)
  })
})
