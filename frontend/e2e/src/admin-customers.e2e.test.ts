import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { ADMIN_START, enterCredentials, heading, STAFF } from './sign-in'

/*
 * A customer the ledger does not have yet, who calls for a booking: the
 * search of the booking finds nobody, the customer is registered, and the
 * booking is entered from their page; later the ledger finds them and is
 * put right.
 */

const EMAIL = 'hanako.yamada@example.com'

const NAME = '山田 花子'

/** A customer of the seed data */
const SAKURA = 'customer3@example.com'

const storedSchema = z.array(
  z.object({
    lastNameKana: z.string().nullable(),
    phoneNumber: z.string(),
    tags: z.array(z.string()),
    allowEmail: z.boolean(),
  }),
)

/** The customer of the test as the database of the API has them, if it has them. */
const storedCustomer = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select "lastNameKana", "phoneNumber", tags, "allowEmail"
       from customers where email = $1`,
      [EMAIL],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const textbox = (page: Page, name: string): Locator =>
  page.getByRole('textbox', { name, exact: true })

/** What the part 「台帳」 of the page of the customer gives for a term */
const recorded = (page: Page, term: string): Locator =>
  page
    .getByRole('region', { name: '台帳', exact: true })
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::dd[1]')

test.describe('the ledger of the customers, in a browser', () => {
  test('should register a customer the booking search did not find, enter their booking from their page, and find and change them in the ledger, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const tokyo = await salonId(api)
    await page.goto(ADMIN.origin)
    await enterCredentials(page, STAFF, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeFocused()

    // Act: the booking search finds nobody
    await pressWithTheKeyboard(page.getByRole('link', { name: '予約を入れる' }))
    await expect(heading(page, '予約を入れる')).toBeFocused()
    await page.getByRole('searchbox', { name: 'キーワード' }).focus()
    await page.keyboard.type('ヤマダ')
    await page.keyboard.press('Enter')

    // Assert
    await expect(
      page.getByText('キーワードに合うお客様が見つかりませんでした'),
    ).toBeVisible()

    // Act: the customer registered
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'お客様を登録する' }),
    )
    await expect(heading(page, 'お客様を登録する')).toBeFocused()
    await expect(page).toHaveURL(
      `${ADMIN.origin}/salons/${tokyo}/customers/new`,
    )
    await textbox(page, '姓').fill('山田')
    await textbox(page, '名').fill('花子')
    await textbox(page, '姓（フリガナ）').fill('ヤマダ')
    await textbox(page, '名（フリガナ）').fill('ハナコ')
    await textbox(page, 'メールアドレス').fill(EMAIL)
    await textbox(page, '電話番号').fill('090-1234-5678')
    await page.getByRole('checkbox', { name: 'メールでの連絡' }).check()
    await expectSoundPage(page)
    await pressWithTheKeyboard(page.getByRole('button', { name: '登録する' }))

    // Assert
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await expect(
      page.getByText(`${NAME} 様を台帳に登録しました。`),
    ).toBeVisible()
    await expect(recorded(page, 'フリガナ')).toHaveText('ヤマダ ハナコ')
    expect(await storedCustomer(api)).toEqual([
      {
        lastNameKana: 'ヤマダ',
        phoneNumber: '090-1234-5678',
        tags: [],
        allowEmail: true,
      },
    ])
    await expectSoundPage(page)

    // Act: the booking of the customer
    await pressWithTheKeyboard(page.getByRole('link', { name: '予約を入れる' }))

    // Assert: the customer is chosen
    await expect(heading(page, '予約を入れる')).toBeFocused()
    await expect(page.getByRole('region', { name: 'お客様' })).toContainText(
      NAME,
    )

    // Act: the ledger, from the header
    await pressWithTheKeyboard(page.getByRole('link', { name: '顧客' }))
    await expect(heading(page, '顧客台帳')).toBeFocused()
    await page.getByRole('searchbox', { name: 'キーワード' }).focus()
    await page.keyboard.type('ハナコ')
    await page.keyboard.press('Enter')

    // Assert
    const found = page.getByRole('table', { name: '条件に合うお客様' })
    await expect(found.getByRole('row')).toHaveCount(2)
    await expectSoundPage(page)

    // Act: the customer put right
    await pressWithTheKeyboard(found.getByRole('link', { name: NAME }))
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('link', { name: '台帳を直す' }))
    await expect(heading(page, '台帳を直す')).toBeFocused()
    await textbox(page, '電話番号').fill('080-9876-5432')
    await textbox(page, 'タグ').fill('電話予約')
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await expect(page.getByText('台帳を直しました。')).toBeVisible()
    await expect(recorded(page, '電話番号')).toHaveText('080-9876-5432')
    expect(await storedCustomer(api)).toEqual([
      {
        lastNameKana: 'ヤマダ',
        phoneNumber: '080-9876-5432',
        tags: ['電話予約'],
        allowEmail: true,
      },
    ])
  })
})

/** A text that has nowhere to break: an address, as somebody pastes it */
const UNBROKEN = `https://example.com/${'a'.repeat(120)}`

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

/**
 * Lets a customer of the seed data have long values that do not break:
 * a tag, a note and a picture they want to look like.
 */
const arrangeLongValues = async (api: TestApi): Promise<string> => {
  const [{ id }] = idsSchema.parse(
    await api.query(
      `update customers
       set tags = array['treatment-focus', $2::text], notes = $2::text, "internalNotes" = $2::text
       where email = $1
       returning id::text`,
      [SAKURA, UNBROKEN],
    ),
  )
  await api.query(
    `insert into customer_preferences ("customerId", "preferredTimeSlots", "avoidStaffIds",
                                       "stylePreferences", "specialRequests")
     values ($1, '[]'::jsonb, '{}', jsonb_build_object('preferredLength', null, 'preferredColors', '[]'::jsonb,
                                    'avoidStyles', '[]'::jsonb, 'inspirationImages', jsonb_build_array($2::text)),
             $2)`,
    [id, UNBROKEN],
  )

  return id
}

test.describe('the ledger of the customers, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the ledger, the form with what is wrong in it, and the page of a customer with long values into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const tokyo = await salonId(api)
    const sakura = await arrangeLongValues(api)
    await page.goto(`${ADMIN.origin}/salons/${tokyo}/customers`)
    await enterCredentials(page, STAFF, api.seedPassword)

    // Act, Assert: the ledger
    await expect(heading(page, '顧客台帳')).toBeFocused()
    await expect(
      page.getByRole('table', { name: '顧客台帳' }).getByRole('row'),
    ).toHaveCount(5)
    await expectSoundPage(page)

    // Act, Assert: the form, with what is wrong in it
    await page.getByRole('link', { name: 'お客様を登録する' }).click()
    await expect(heading(page, 'お客様を登録する')).toBeFocused()
    await textbox(page, 'メールアドレス').fill('an address')
    await textbox(page, '建物名・部屋番号').fill(UNBROKEN)
    await page.getByRole('button', { name: '登録する' }).click()
    await expect(textbox(page, '姓')).toBeFocused()
    await expect(textbox(page, 'メールアドレス')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expectSoundPage(page)

    // Act, Assert: the page of a customer
    await page.goto(`${ADMIN.origin}/salons/${tokyo}/customers/${sakura}`)
    await expect(heading(page, 'お客様の台帳')).toBeVisible()
    await expect(recorded(page, 'スタッフ間の申し送り')).toHaveText(UNBROKEN)
    await expect(
      page
        .getByRole('region', { name: '好み設定' })
        .getByText(UNBROKEN)
        .first(),
    ).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'よく受けたメニュー' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
