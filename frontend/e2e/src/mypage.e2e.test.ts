import { CUSTOMER, YUKI } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import { PORTAL } from './applications'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { mainMenuLink } from './main-menu'
import { box, saveButton, text, value } from './mypage'
import { chooseWithTheKeyboard, pressWithTheKeyboard } from './screen'
import {
  enterCredentials,
  heading,
  NEWCOMER,
  NEWCOMER_PASSWORD,
  registerNewcomer,
} from './sign-in'

/*
 * The customer is the first of the seed data: Yuki Tanaka, a member of the
 * rank gold with 2,500 points, who has said everything about herself but a
 * second phone number.
 */

/**
 * What somebody writes who has a lot to say: the name of a building that a
 * line cannot be broken in (a browser breaks a line at a space and after a
 * hyphen, and not at an underscore), and two paragraphs for the salons.
 */
const LONG_BUILDING =
  'The_Garden_Residence_At_Meguro_North_Wing_Annex_Building_Number_Three_Room_1204'
const LONG_NOTES =
  '頭皮が敏感なので、刺激の少ない薬剤でお願いします。\n\n使っている製品の一覧: https://products.example.com/organic_shampoo_and_treatment_for_sensitive_scalp_autumn_2026'

const changeLink = (page: Page): Locator =>
  page.getByRole('link', { name: 'お客様の情報を変更する' })

/** A customer as the database has them. */
const stored = (api: TestApi, email: string) =>
  api.query(
    `select "lastName", "firstName", "phoneNumber", occupation, building, preferences, "allowSms"
     from customers where email = $1 and "deletedAt" is null`,
    [email],
  )

test.describe('the page and the profile of a customer, in a browser', () => {
  test('should show what the salons know of the customer, and change the profile with the keyboard alone', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/mypage`)
    await expect(
      page.getByText('マイページを見るには、サインインしてください。'),
    ).toBeVisible()
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert
    await expect(value(page, '会員の情報', '会員ランク')).toHaveText('ゴールド')
    await expect(value(page, '会員の情報', 'ポイント')).toHaveText(
      '2,500 ポイント',
    )
    await expect(value(page, 'お客様の情報', 'お名前')).toHaveText(YUKI.name)
    await expect(mainMenuLink(page, 'マイページ')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expectSoundPage(page)

    // Act: to the form, by its link and the Enter key
    await pressWithTheKeyboard(changeLink(page))

    // Assert
    await expect(heading(page, 'お客様の情報')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/mypage/profile`)
    await expect(text(page, '姓')).toHaveValue('Tanaka')
    await expectSoundPage(page)
    // Where there is room, the two parts of a name stand side by side
    const lastName = await text(page, '姓').boundingBox()
    const firstName = await text(page, '名').boundingBox()
    expect(lastName).not.toBeNull()
    expect(firstName?.y).toBe(lastName?.y)
    expect(firstName?.x).toBeGreaterThan(
      lastName?.x ?? Number.POSITIVE_INFINITY,
    )

    // Act: the controls follow each other as they are read
    await page.keyboard.press('Tab')
    await expect(text(page, '姓')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(text(page, '名')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(text(page, '姓（フリガナ）')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(text(page, '名（フリガナ）')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(text(page, '電話番号')).toBeFocused()

    // Act: another occupation, one kind of service more, no SMS, and the
    // Enter key in a control sends the form
    await chooseWithTheKeyboard(box(page, 'スパ'))
    await chooseWithTheKeyboard(box(page, 'SMS での連絡を受け取る'))
    await text(page, '職業').focus()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('Illustrator')
    await page.keyboard.press('Enter')

    // Assert
    await expect(page.getByText('お客様の情報を変更しました。')).toBeVisible()
    await expect(heading(page, 'マイページ')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/mypage`)
    await expect(value(page, 'お客様の情報', '職業')).toHaveText('Illustrator')
    await expect(value(page, 'お客様の情報', '好みのメニュー')).toHaveText(
      'カット、カラー、スパ',
    )
    await expect(value(page, 'お客様の情報', '受け取る連絡')).toHaveText(
      'メールでの連絡、キャンペーンなどのお知らせ',
    )
    await expectSoundPage(page)
    expect(await stored(api, CUSTOMER)).toEqual([
      {
        lastName: 'Tanaka',
        firstName: 'Yuki',
        phoneNumber: '+81-90-1234-5678',
        occupation: 'Illustrator',
        building: 'Meguro Heights 301',
        preferences: {
          preferredServices: ['cut', 'color', 'spa'],
          notes: 'Prefers organic products',
        },
        allowSms: false,
      },
    ])
  })

  test('should lead an account that has no profile from its page to the form that makes one, and show the profile it made', async ({
    page,
    api,
    request,
  }) => {
    // Arrange
    await registerNewcomer(request, api)
    await page.goto(`${PORTAL.origin}/mypage`)
    await enterCredentials(page, NEWCOMER, NEWCOMER_PASSWORD)
    const register = page.getByRole('link', {
      name: 'お客様の情報を登録する',
    })

    // Assert
    await expect(register).toBeVisible()
    await expectSoundPage(page)

    // Act
    await register.click()

    // Assert
    await expect(heading(page, 'お客様の情報')).toBeFocused()
    const send = page.getByRole('button', { name: '登録する' })
    await expect(send).toBeVisible()
    await expectSoundPage(page)

    // Act: nothing is filled in
    await send.click()

    // Assert
    await expect(text(page, '姓')).toBeFocused()
    await expect(page.getByText('電話番号を入力してください。')).toBeVisible()
    await expectSoundPage(page)

    // Act
    await text(page, '姓').fill('山田')
    await text(page, '名').fill('花子')
    await text(page, '電話番号').fill('090-5550-0199')
    await page.getByLabel('生年月日').fill('1990-05-15')
    await page.getByRole('combobox', { name: '性別' }).selectOption('女性')
    await box(page, 'カット').check()
    await send.click()

    // Assert
    await expect(page.getByText('お客様の情報を登録しました。')).toBeVisible()
    await expect(heading(page, 'マイページ')).toBeFocused()
    await expect(value(page, 'お客様の情報', 'お名前')).toHaveText('山田 花子')
    await expect(value(page, 'お客様の情報', '生年月日')).toHaveText(
      '1990年5月15日',
    )
    await expect(value(page, '会員の情報', '会員ランク')).toHaveText(
      'レギュラー',
    )
    await expectSoundPage(page)
    expect(await stored(api, NEWCOMER)).toEqual([
      {
        lastName: '山田',
        firstName: '花子',
        phoneNumber: '090-5550-0199',
        occupation: null,
        building: null,
        preferences: { preferredServices: ['cut'], notes: null },
        allowSms: false,
      },
    ])
  })
})

test.describe('the page and the profile of a customer, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the page with long values and the form with what is wrong into the width', async ({
    page,
    api,
  }) => {
    // Arrange: a building whose name no line is broken in, and a lot to
    // tell the salons
    await api.query(
      `update customers
       set building = $2, preferences = jsonb_build_object('preferredServices', $3::jsonb, 'notes', $4::text)
       where email = $1`,
      [
        CUSTOMER,
        LONG_BUILDING,
        JSON.stringify([
          'cut',
          'color',
          'perm',
          'treatment',
          'spa',
          'styling',
          'extension',
          'other',
        ]),
        LONG_NOTES,
      ],
    )
    await page.goto(`${PORTAL.origin}/mypage`)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert
    await expect(value(page, 'お客様の情報', '住所')).toContainText(
      LONG_BUILDING,
    )
    await expect(value(page, 'お客様の情報', '好みのメニュー')).toHaveText(
      'カット、カラー、パーマ、トリートメント、スパ、スタイリング、エクステンション、その他',
    )
    await expectSoundPage(page)

    // Act
    await changeLink(page).click()

    // Assert: at this width, the two parts of a name stand one below the
    // other
    await expect(heading(page, 'お客様の情報')).toBeFocused()
    await expect(text(page, '建物名・部屋番号')).toHaveValue(LONG_BUILDING)
    const lastName = await text(page, '姓').boundingBox()
    const firstName = await text(page, '名').boundingBox()
    expect(lastName).not.toBeNull()
    expect(firstName?.x).toBe(lastName?.x)
    expect(firstName?.y).toBeGreaterThan(
      lastName?.y ?? Number.POSITIVE_INFINITY,
    )
    await expectSoundPage(page)

    // Act: what cannot be right
    await text(page, '名').fill('')
    await text(page, '予備の電話番号').fill('090-1234')
    await page.getByLabel('生年月日').fill('1899-12-31')
    await saveButton(page).click()

    // Assert
    await expect(text(page, '名')).toBeFocused()
    await expect(page.getByText('名を入力してください。')).toBeVisible()
    await expect(
      page.getByText(
        '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
      ),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
