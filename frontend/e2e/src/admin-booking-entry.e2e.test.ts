import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { bookThroughApi, MIKA, openDay, salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { ADMIN_START, enterCredentials, heading, OWNER } from './sign-in'

/*
 * The bookings a salon puts into its ledger itself, for a customer who
 * called or came to the counter: the customer is searched for, the lines
 * are filled in and the members checked, and the booking is put in; what
 * the salon wrote down on it is changed later, and a booking put in by
 * mistake is removed.
 */

const CUSTOMER_NAME = 'Yamamoto Kenji'

const storedSchema = z.array(
  z.object({
    bookingNumber: z.string(),
    source: z.string().nullable(),
    depositAmount: z.number().nullable(),
    internalNotes: z.string().nullable(),
    lines: z.array(
      z.object({ service: z.string(), staff: z.string().nullable() }),
    ),
  }),
)

const idsSchema = z.array(z.object({ id: z.uuid() }))

/** The bookings there are: those of the seed data, before a test puts one in. */
const bookingIds = async (api: TestApi): Promise<string[]> =>
  idsSchema
    .parse(await api.query('select id::text from bookings'))
    .map(({ id }) => id)

/**
 * The bookings of the customer that are not among `before`, as the database
 * of the API has them, with their lines in order.
 */
const storedBookings = async (api: TestApi, before: string[]) =>
  storedSchema.parse(
    await api.query(
      `select bookings."bookingNumber", bookings.source, bookings."depositAmount", bookings."internalNotes",
              (select json_agg(json_build_object('service', services.name, 'staff', staff."displayName")
                               order by booking_services."sortOrder")
               from booking_services
               join services on services.id = booking_services."serviceId"
               left join staff on staff.id = booking_services."staffId"
               where booking_services."bookingId" = bookings.id) as lines
       from bookings
       join customers on customers.id = bookings."customerId"
       where customers.email = 'customer2@example.com'
         and bookings.id::text not in (select jsonb_array_elements_text($1::jsonb))
       order by bookings."createdAt"`,
      [JSON.stringify(before)],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const combobox = (page: Page, name: string): Locator =>
  page.getByRole('combobox', { name })

/** Searches the customers by a keyword, from the field of the keyword. */
const search = async (page: Page, keyword: string): Promise<void> => {
  await page.getByRole('searchbox', { name: 'キーワード' }).focus()
  await page.keyboard.type(keyword)
  await page.keyboard.press('Enter')
}

test.describe('the bookings a salon puts in, in a browser', () => {
  test('should lead the owner from the list of a day to a customer, put a booking of two lines in, change its notes and remove it', async ({
    page,
    api,
  }) => {
    // Arrange
    const tokyo = await salonId(api)
    const seeded = await bookingIds(api)
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeFocused()

    // Act: from the list of today to the customers that have a keyword
    await pressWithTheKeyboard(page.getByRole('link', { name: '予約を入れる' }))
    await expect(heading(page, '予約を入れる')).toBeFocused()
    await search(page, 'yamamoto')

    // Assert
    await expect(page).toHaveURL(
      new RegExp(
        `/salons/${tokyo}/bookings/new\\?date=[0-9-]+&search=yamamoto$`,
      ),
    )
    await expect(
      page.getByRole('table', { name: '見つかったお客様' }).getByRole('row'),
    ).toHaveCount(2)
    await expectSoundPage(page)

    // Act: the customer
    await pressWithTheKeyboard(page.getByRole('link', { name: CUSTOMER_NAME }))

    // Assert
    await expect(heading(page, '予約を入れる')).toBeFocused()
    await expect(page.getByRole('region', { name: 'お客様' })).toContainText(
      CUSTOMER_NAME,
    )

    // Act: two lines, the second without a member, and the check
    await combobox(page, '担当スタッフ').selectOption({ label: MIKA })
    await combobox(page, '明細 1 のメニュー').selectOption({
      label: 'Ladies Cut（60 分）',
    })
    await page.getByLabel('明細 1 の開始').fill('19:00')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '明細を追加する' }),
    )
    await expect(combobox(page, '明細 2 のメニュー')).toBeFocused()
    await combobox(page, '明細 2 のメニュー').selectOption({
      label: 'Deep Conditioning Treatment（30 分）',
    })
    await combobox(page, '明細 2 の担当').selectOption({ label: '決めない' })
    await page.getByLabel('明細 2 の開始').fill('20:00')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '担当の空きを確かめる' }),
    )

    // Assert
    await expect(
      page.getByText('担当の空きを確かめました。重なる予約はありません。'),
    ).toBeVisible()
    await expect(page.getByText('空いています', { exact: true })).toBeVisible()
    await expectSoundPage(page)

    // Act: put in
    await combobox(page, '受付の経路').selectOption({ label: '電話' })
    await page.getByLabel('予約金').fill('1000')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '予約を入れる' }),
    )

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText('予約を入れました。')).toBeVisible()
    const [created] = await storedBookings(api, seeded)
    expect(created).toEqual({
      bookingNumber: expect.any(String),
      source: 'phone',
      depositAmount: 1000,
      internalNotes: null,
      lines: [
        { service: 'Ladies Cut', staff: MIKA },
        { service: 'Deep Conditioning Treatment', staff: null },
      ],
    })
    await expectSoundPage(page)

    // Act: the notes
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '要望とメモを変える' }),
    )
    await expect(heading(page, '要望とメモを変える')).toBeFocused()
    await page.getByLabel('サロン内のメモ').fill('次回はカラーも')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText('予約の記録を変えました。')).toBeVisible()
    await expect(
      page.getByRole('region', { name: '予約' }).getByText('次回はカラーも'),
    ).toBeVisible()
    expect((await storedBookings(api, seeded))[0]?.internalNotes).toBe(
      '次回はカラーも',
    )

    // Act: removed, after asking
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '予約を削除する' }),
    )
    const removal = page.getByRole('dialog', { name: '予約を削除しますか？' })
    await expect(removal).toBeVisible()
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      removal.getByRole('button', { name: '削除する' }),
    )

    // Assert
    await expect(heading(page, ADMIN_START)).toBeFocused()
    await expect(page.getByText('予約を削除しました。')).toBeVisible()
    expect(await storedBookings(api, seeded)).toEqual([])
  })
})

test.describe('the bookings a salon puts in, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the customers, the lines with a member who is taken, and the notes into the width, and put nothing in for a member who is taken', async ({
    page,
    api,
    request,
  }) => {
    // Arrange: Mika is taken from 10:00 until 11:00
    const date = await openDay(api, { [MIKA]: '10:00' })
    const taken = await bookThroughApi(request, api, {
      date,
      time: '10:00',
      staff: MIKA,
    })
    const seeded = await bookingIds(api)
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/bookings/new?date=${date}&search=yamamoto`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act, Assert: the customers
    await expect(heading(page, '予約を入れる')).toBeFocused()
    await expect(page.getByRole('link', { name: CUSTOMER_NAME })).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: a line whose member is taken
    await page.getByRole('link', { name: CUSTOMER_NAME }).click()
    await combobox(page, '担当スタッフ').selectOption({ label: MIKA })
    await combobox(page, '明細 1 のメニュー').selectOption({
      label: 'Mens Cut（45 分）',
    })
    await page.getByLabel('明細 1 の開始').fill('10:30')
    await page.getByRole('button', { name: '明細を追加する' }).click()
    await combobox(page, '明細 2 のメニュー').selectOption({
      label: 'Ladies Cut（60 分）',
    })
    await combobox(page, '明細 2 の担当').selectOption({ label: '決めない' })
    await page.getByLabel('明細 2 の開始').fill('12:00')
    await page.getByRole('button', { name: '担当の空きを確かめる' }).click()
    await expect(
      page.getByText('重なる予約があります', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(`${taken.bookingNumber} 10:00〜11:00`),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: the API refuses it as well
    await page.getByRole('button', { name: '明細 2 を外す' }).click()
    await page.getByRole('button', { name: '予約を入れる' }).click()
    await expect(
      page.getByText(
        '担当の時間が、ほかの予約と重なっているため、予約を入れられませんでした。明細ごとに、担当の空きを確かめ直しました。',
      ),
    ).toBeVisible()
    await expect(
      page.getByText('重なる予約があります', { exact: true }),
    ).toBeVisible()
    expect(await storedBookings(api, seeded)).toEqual([])

    // Act, Assert: another time
    await page.getByLabel('明細 1 の開始').fill('11:30')
    await page.getByRole('button', { name: '予約を入れる' }).click()
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expectSoundPage(page)

    // Act, Assert: the notes, and the removal
    await page.getByRole('link', { name: '要望とメモを変える' }).click()
    await expect(heading(page, '要望とメモを変える')).toBeFocused()
    await expectSoundPage(page)
    await page.getByRole('link', { name: 'やめる' }).click()
    await page.getByRole('button', { name: '予約を削除する' }).click()
    await expect(
      page.getByRole('dialog', { name: '予約を削除しますか？' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
