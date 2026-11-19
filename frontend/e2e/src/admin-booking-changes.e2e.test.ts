import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { bookThroughApi, HIROSHI, MIKA, openDay, salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, OWNER } from './sign-in'

/*
 * A booking the salon changes after it was put in: moved to another time
 * and another member of the staff, given another line, and a line taken
 * away. A member who is taken where the booking would be is found out
 * after the API refused it.
 */

const MOVE_TAKEN =
  '担当の時間が、ほかの予約と重なっているため、日時と担当を変えられませんでした。動かしたあとの明細ごとに、重なるほかの予約を確かめました。'

const ADDITION_TAKEN =
  '担当の時間が、ほかの予約と重なっているため、施術明細を足せませんでした。足す明細に重なる、ほかの予約を確かめました。'

const linesSchema = z.array(
  z.object({
    service: z.string(),
    staff: z.string().nullable(),
    startTime: z.string(),
  }),
)

/** The lines of a booking as the database of the API has them, in their order; the beginnings on Tokyo's clock. */
const storedLines = async (api: TestApi, id: string) =>
  linesSchema.parse(
    await api.query(
      `select services.name as service, staff."displayName" as staff,
              to_char(booking_services."startTime" at time zone 'Asia/Tokyo', 'HH24:MI') as "startTime"
       from booking_services
       join services on services.id = booking_services."serviceId"
       left join staff on staff.id = booking_services."staffId"
       where booking_services."bookingId" = $1
       order by booking_services."sortOrder"`,
      [id],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const combobox = (page: Page, name: string): Locator =>
  page.getByRole('combobox', { name })

/** The services of the lines of the page of a booking, in their order. */
const linesShown = (page: Page): Locator =>
  page.getByRole('table', { name: '施術明細' }).getByRole('rowheader')

/**
 * The day of the tests, Mika Suzuki taken from 10:00 until 11:00, and the
 * booking that is changed: Hiroshi Tanaka's, from 11:00 until 12:00.
 */
const arrangeBookings = async (
  api: TestApi,
  request: Parameters<typeof bookThroughApi>[0],
) => {
  const date = await openDay(api, { [MIKA]: '10:00', [HIROSHI]: '10:00' })
  const taken = await bookThroughApi(request, api, {
    date,
    time: '10:00',
    staff: MIKA,
  })
  const changed = await bookThroughApi(request, api, {
    date,
    time: '11:00',
    staff: HIROSHI,
  })

  return { taken, changed }
}

test.describe('the bookings a salon changes, in a browser', () => {
  test('should move a booking past a member who is taken, add a line and take it away, with the keyboard', async ({
    page,
    api,
    request,
  }) => {
    // Arrange
    const { taken, changed } = await arrangeBookings(api, request)
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/bookings/${changed.id}`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '予約の内容')).toBeFocused()

    // Act: to Mika Suzuki, at a time she is taken
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '日時と担当を変える' }),
    )
    await expect(heading(page, '日時と担当を変える')).toBeFocused()
    await combobox(page, '担当スタッフ').selectOption({ label: MIKA })
    await page.getByLabel('開始の時刻').fill('10:30')

    // Assert: where the line would be
    await expect(
      page.getByRole('region', { name: '動かしたあとの明細' }),
    ).toContainText(`明細 1 Ladies Cut10:30〜11:30 担当 ${MIKA}`)

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '日時と担当を変える' }),
    )

    // Assert
    await expect(page.getByText(MOVE_TAKEN)).toBeVisible()
    await expect(
      page.getByText(`${taken.bookingNumber} 10:00〜11:00`),
    ).toBeVisible()
    await expectSoundPage(page)
    expect(await storedLines(api, changed.id)).toEqual([
      { service: 'Ladies Cut', staff: HIROSHI, startTime: '11:00' },
    ])

    // Act: after she is free
    await page.getByLabel('開始の時刻').fill('11:30')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '日時と担当を変える' }),
    )

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText('予約の日時と担当を変えました。')).toBeVisible()
    expect(await storedLines(api, changed.id)).toEqual([
      { service: 'Ladies Cut', staff: MIKA, startTime: '11:30' },
    ])

    // Act: another line, that nobody does
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '施術明細を追加する' }),
    )
    await expect(heading(page, '施術明細を追加する')).toBeFocused()
    await combobox(page, 'メニュー').selectOption({
      label: 'Mens Cut（45 分）',
    })
    await combobox(page, '担当').selectOption({ label: '決めない' })
    await page.getByLabel('開始の時刻').fill('12:30')
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '施術明細を追加する' }),
    )

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText('施術明細を追加しました。')).toBeVisible()
    await expect(linesShown(page)).toHaveText(['Ladies Cut', 'Mens Cut'])

    // Act: the line, taken away after asking
    await pressWithTheKeyboard(
      page
        .getByRole('table', { name: '施術明細' })
        .getByRole('link', { name: 'Mens Cut' }),
    )
    await expect(heading(page, '施術明細の内容')).toBeFocused()
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'この明細を外す' }),
    )
    const removal = page.getByRole('dialog', { name: '施術明細を外しますか？' })
    await expect(removal).toBeVisible()
    await expectSoundPage(page)
    await pressWithTheKeyboard(removal.getByRole('button', { name: '外す' }))

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText('施術明細を外しました。')).toBeVisible()
    await expect(linesShown(page)).toHaveText(['Ladies Cut'])
    expect(await storedLines(api, changed.id)).toEqual([
      { service: 'Ladies Cut', staff: MIKA, startTime: '11:30' },
    ])
  })
})

test.describe('the bookings a salon changes, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the moved lines, the line that is added with a member who is taken, the removal of a line and the last line into the width', async ({
    page,
    api,
    request,
  }) => {
    // Arrange
    const { taken, changed } = await arrangeBookings(api, request)
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/bookings/${changed.id}`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '予約の内容')).toBeFocused()

    // Act, Assert: a move to a member who is taken
    await page.getByRole('link', { name: '日時と担当を変える' }).click()
    await combobox(page, '担当スタッフ').selectOption({ label: MIKA })
    await page.getByLabel('開始の時刻').fill('10:30')
    await page.getByRole('button', { name: '日時と担当を変える' }).click()
    await expect(page.getByText(MOVE_TAKEN)).toBeVisible()
    await expect(
      page.getByText(`${taken.bookingNumber} 10:00〜11:00`),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: a line whose member is taken
    await page.getByRole('link', { name: 'やめる' }).click()
    await page.getByRole('link', { name: '施術明細を追加する' }).click()
    await combobox(page, 'メニュー').selectOption({
      label: 'Mens Cut（45 分）',
    })
    await combobox(page, '担当').selectOption({ label: MIKA })
    await page.getByLabel('開始の時刻').fill('11:00')
    await page.getByRole('button', { name: '施術明細を追加する' }).click()
    await expect(page.getByText(ADDITION_TAKEN)).toBeVisible()
    await expect(
      page.getByText(`${taken.bookingNumber} 10:00〜11:00`),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: the line, that nobody does, added and taken away after asking
    await combobox(page, '担当').selectOption({ label: '決めない' })
    await page.getByRole('button', { name: '施術明細を追加する' }).click()
    await expect(page.getByText('施術明細を追加しました。')).toBeVisible()
    await page
      .getByRole('table', { name: '施術明細' })
      .getByRole('link', { name: 'Mens Cut' })
      .click()
    await expect(heading(page, '施術明細の内容')).toBeFocused()
    await expectSoundPage(page)
    await page.getByRole('button', { name: 'この明細を外す' }).click()
    const removal = page.getByRole('dialog', { name: '施術明細を外しますか？' })
    await expect(removal).toBeVisible()
    await expectSoundPage(page)
    await removal.getByRole('button', { name: '外す' }).click()
    await expect(page.getByText('施術明細を外しました。')).toBeVisible()

    // Act, Assert: the last line, which stays
    await page
      .getByRole('table', { name: '施術明細' })
      .getByRole('link', { name: 'Ladies Cut' })
      .click()
    await expect(heading(page, '施術明細の内容')).toBeFocused()
    await expect(
      page.getByText(
        '予約に残る最後の明細は、外せません。行われない来店は、予約をキャンセルしてください。',
      ),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
