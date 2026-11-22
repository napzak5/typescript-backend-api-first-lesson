import {
  KENJI,
  OWNER,
  SAKURA,
  STYLIST,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage, sidewaysScrollOf } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { ADMIN_START, enterCredentials, heading } from './sign-in'

/*
 * A customer the ledger does not have yet, who calls for a booking: the
 * search of the booking finds nobody, the customer is registered, and the
 * booking is entered from their page; later the ledger finds them and is
 * put right.
 */

const EMAIL = 'hanako.yamada@example.com'

const NAME = '山田 花子'

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
    await enterCredentials(page, STYLIST, api.seedPassword)
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

/** The ID of a customer of the seed data, by their address of mail. */
const customerIdOf = async (api: TestApi, email: string): Promise<string> =>
  api.idOf('select id::text from customers where email = $1', [email])

const referrerSchema = z.array(
  z.object({
    referredBy: z.string().nullable(),
    preferredStaff: z.string().nullable(),
    communicationStyle: z.string().nullable(),
  }),
)

/** Who referred a customer, and what they wish for, as the database of the API has it. */
const storedReferrerAndWishes = async (api: TestApi, email: string) =>
  referrerSchema.parse(
    await api.query(
      `select customers."referredBy"::text, staff."displayName" as "preferredStaff",
              stored."communicationStyle"
       from customers
         left join customer_preferences stored on stored."customerId" = customers.id
         left join staff on staff.id = stored."preferredStaffId"
       where customers.email = $1`,
      [email],
    ),
  )

test.describe('the referrer and the preferences of a customer, in a browser', () => {
  test('should choose the customer who referred another in a dialog that keeps the focus and gives it back, and change what the customer wishes for, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const tokyo = await salonId(api)
    const [sakura, yuki] = await Promise.all([
      customerIdOf(api, SAKURA.email),
      customerIdOf(api, YUKI.email),
    ])
    await page.goto(`${ADMIN.origin}/salons/${tokyo}/customers/${sakura}`)
    await enterCredentials(page, STYLIST, api.seedPassword)
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('link', { name: '台帳を直す' }))
    await expect(heading(page, '台帳を直す')).toBeFocused()
    await expect(textbox(page, '紹介元')).toHaveValue('なし')
    const choose = page.getByRole('button', { name: '紹介元を選ぶ' })
    const dialog = page.getByRole('dialog', { name: '紹介元を選ぶ' })

    // Act: the choice opened, and given up with the Escape key
    await pressWithTheKeyboard(choose)

    // Assert: the focus is on the keyword, and comes back to the button
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('searchbox', { name: 'キーワード' }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(choose).toBeFocused()
    await expect(textbox(page, '紹介元')).toHaveValue('なし')

    // Act: the ledger searched in the dialog, and a customer chosen
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await page.keyboard.type('tanaka')
    await page.keyboard.press('Enter')
    const found = dialog.getByRole('button', { name: YUKI.name })
    await expect(found).toBeVisible()
    await expect(
      dialog.getByRole('search', { name: '紹介元を探す' }),
    ).toBeVisible()
    await expectSoundPage(page)
    // A wide screen shows every column of what was found, with nothing to scroll
    expect(
      await sidewaysScrollOf(
        dialog.getByRole('table', { name: '見つかったお客様' }),
      ),
    ).toBeLessThanOrEqual(1)
    await pressWithTheKeyboard(found)

    // Assert
    await expect(dialog).toBeHidden()
    await expect(choose).toBeFocused()
    await expect(textbox(page, '紹介元')).toHaveValue(`${YUKI.name} 様`)

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert: the page names the referrer and leads to their page
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await expect(
      recorded(page, '紹介元').getByRole('link', { name: `${YUKI.name} 様` }),
    ).toHaveAttribute('href', `/salons/${tokyo}/customers/${yuki}`)

    // Act: the preferences, from the page
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '好み設定を直す' }),
    )
    await expect(heading(page, '好み設定を直す')).toBeFocused()
    await page
      .getByRole('combobox', { name: '指名したいスタッフ' })
      .selectOption({ label: 'Mika Suzuki（Beauty Studio Tokyo）' })
    await textbox(page, '接客の好み').fill('静かに過ごしたい')
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await expect(page.getByText('好み設定を直しました。')).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: '好み設定' })
        .getByText('静かに過ごしたい'),
    ).toBeVisible()
    expect(await storedReferrerAndWishes(api, SAKURA.email)).toEqual([
      {
        referredBy: yuki,
        preferredStaff: 'Mika Suzuki',
        communicationStyle: '静かに過ごしたい',
      },
    ])
  })
})

/** Lets the bookings of a customer that are not finished have been cancelled: the customer may be removed. */
const finishBookingsOf = (api: TestApi, email: string): Promise<unknown> =>
  api.query(
    `update bookings set status = 'cancelled', "cancelledAt" = now(), "updatedAt" = now()
     where "customerId" = (select id from customers where email = $1 and "deletedAt" is null)
       and status in ('draft', 'pending', 'confirmed', 'in_progress')`,
    [email],
  )

const presenceSchema = z.tuple([z.object({ present: z.boolean() })])

/** Whether a customer is in the ledger: there, and not removed. */
const isInLedger = async (api: TestApi, id: string): Promise<boolean> =>
  presenceSchema.parse(
    await api.query(
      'select exists (select 1 from customers where id = $1 and "deletedAt" is null) as present',
      [id],
    ),
  )[0].present

/** The rows of the history: the version, what made it and who, as the table shows them */
const versionsShown = async (page: Page): Promise<string[][]> => {
  const rows = await page
    .getByRole('table', { name: '版の一覧' })
    .getByRole('row')
    .all()

  return Promise.all(
    rows.slice(1).map(async (row) => {
      const [operation = '', , changer = ''] = await row
        .getByRole('cell')
        .allTextContents()

      return [
        (await row.getByRole('rowheader').textContent()) ?? '',
        operation,
        changer,
      ]
    }),
  )
}

test.describe('the removal and the history of a customer, in a browser', () => {
  test('should remove a customer after a dialog that keeps the focus and gives it back, read their history and a version, and bring them back, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const tokyo = await salonId(api)
    await finishBookingsOf(api, KENJI.email)
    const kenji = await customerIdOf(api, KENJI.email)
    await page.goto(`${ADMIN.origin}/salons/${tokyo}/customers/${kenji}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    const remove = page.getByRole('button', { name: '台帳から削除する' })
    const dialog = page.getByRole('dialog', {
      name: `${KENJI.name} 様を台帳から削除しますか？`,
    })

    // Act: the dialog opened, and given up with the Escape key
    await pressWithTheKeyboard(remove)

    // Assert: the focus is in the dialog, and comes back to the button
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: '戻る' })).toBeFocused()
    await expectSoundPage(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(remove).toBeFocused()

    // Act: the removal confirmed
    await page.keyboard.press('Enter')
    await pressWithTheKeyboard(dialog.getByRole('button', { name: '削除する' }))

    // Assert: the page shows the customer as the ledger kept them, with the focus on its heading
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await expect(
      page.getByText(`${KENJI.name} 様を台帳から削除しました。`),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: '削除されたときの台帳' }),
    ).toBeVisible()
    await expectSoundPage(page)
    expect(await isInLedger(api, kenji)).toBe(false)

    // Act: the history, and the version of the removal
    await pressWithTheKeyboard(page.getByRole('link', { name: '変更履歴' }))

    // Assert
    await expect(heading(page, '変更履歴')).toBeFocused()
    await expect(page).toHaveURL(
      `${ADMIN.origin}/salons/${tokyo}/customers/${kenji}/history`,
    )
    await expect(page.getByRole('table', { name: '版の一覧' })).toBeVisible()
    expect(await versionsShown(page)).toEqual([
      ['版 2', '削除', 'あなた'],
      ['版 1', '記録の開始', ''],
    ])
    await expectSoundPage(page)

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: '版 2' }))

    // Assert
    await expect(heading(page, '台帳の版')).toBeFocused()
    await expect(page.getByText(/^版 2・削除・.+・あなた$/)).toBeVisible()
    await expectSoundPage(page)

    // Act: back to the page of the customer, and the customer brought back
    await pressWithTheKeyboard(page.getByRole('link', { name: '変更履歴へ' }))
    await expect(heading(page, '変更履歴')).toBeFocused()
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'お客様の台帳へ' }),
    )
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('button', { name: '台帳に戻す' }))

    // Assert
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await expect(
      page.getByText(`${KENJI.name} 様を台帳に戻しました。`),
    ).toBeVisible()
    await expect(recorded(page, 'お名前')).toHaveText(KENJI.name)
    expect(await isInLedger(api, kenji)).toBe(true)
  })
})

/** A text that has nowhere to break: an address, as somebody pastes it */
const UNBROKEN = `https://example.com/${'a'.repeat(120)}`

/**
 * Lets a customer of the seed data have long values that do not break:
 * a tag, a note and a picture they want to look like.
 */
const arrangeLongValues = async (api: TestApi): Promise<string> => {
  const id = await api.idOf(
    `update customers
       set tags = array['treatment-focus', $2::text], notes = $2::text, "internalNotes" = $2::text
       where email = $1
       returning id::text`,
    [SAKURA.email, UNBROKEN],
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

  test('should fit the ledger, the form with what is wrong in it, the choice of a referrer, the page of a customer with long values and the form of the preferences into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const tokyo = await salonId(api)
    const sakura = await arrangeLongValues(api)
    await page.goto(`${ADMIN.origin}/salons/${tokyo}/customers`)
    await enterCredentials(page, STYLIST, api.seedPassword)

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

    // Act, Assert: the choice of a referrer, with what it found
    await page.getByRole('button', { name: '紹介元を選ぶ' }).click()
    const dialog = page.getByRole('dialog', { name: '紹介元を選ぶ' })
    await dialog.getByRole('searchbox', { name: 'キーワード' }).fill('example')
    await dialog.getByRole('button', { name: '探す' }).click()
    await expect(
      dialog.getByRole('table', { name: '見つかったお客様' }).getByRole('row'),
    ).toHaveCount(5)
    await expectSoundPage(page)
    await dialog.getByRole('button', { name: 'やめる' }).click()
    await expect(dialog).toBeHidden()

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

    // Act, Assert: the form of the preferences, with the long values
    await page.getByRole('link', { name: '好み設定を直す' }).click()
    await expect(heading(page, '好み設定を直す')).toBeFocused()
    await expect(textbox(page, '特別な要望')).toHaveValue(UNBROKEN)
    await expectSoundPage(page)
  })

  test('should fit the dialog of a removal, the page of a customer who left the ledger, their history and a version with what it changed into the width', async ({
    page,
    api,
  }) => {
    // Arrange: the telephone number changed, so that a version changed something
    const tokyo = await salonId(api)
    await finishBookingsOf(api, KENJI.email)
    const kenji = await customerIdOf(api, KENJI.email)
    await page.goto(`${ADMIN.origin}/salons/${tokyo}/customers/${kenji}/edit`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '台帳を直す')).toBeVisible()
    await textbox(page, '電話番号').fill('080-3333-4444')
    await page.getByRole('button', { name: '変更を保存する' }).click()
    await expect(recorded(page, '電話番号')).toHaveText('080-3333-4444')

    // Act, Assert: the dialog of the removal
    await page.getByRole('button', { name: '台帳から削除する' }).click()
    const dialog = page.getByRole('dialog', {
      name: `${KENJI.name} 様を台帳から削除しますか？`,
    })
    await expect(dialog).toBeVisible()
    await expectSoundPage(page)
    await dialog.getByRole('button', { name: '削除する' }).click()

    // Act, Assert: the page of the customer who left the ledger
    await expect(
      page.getByRole('region', { name: '削除されたときの台帳' }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: the history
    await page.getByRole('link', { name: '変更履歴' }).click()
    await expect(page.getByRole('table', { name: '版の一覧' })).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: the version that changed the telephone number
    await page.getByRole('link', { name: '版 2' }).click()
    await expect(
      page.getByRole('table', { name: '前の版から変えた項目' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
