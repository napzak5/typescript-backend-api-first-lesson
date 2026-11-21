import type { Locator, Page } from '@playwright/test'
import { PORTAL } from './applications'
import {
  bookThroughApi,
  dateControl,
  details,
  HIROSHI,
  MIKA,
  openDay,
  part,
  salonId,
  serviceId,
  staffControl,
  staffId,
  time,
  times,
} from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { CUSTOMER, enterCredentials, heading, PORTAL_START } from './sign-in'

/*
 * The seed data gives the customer two bookings to come and three visits
 * that were. The tests add one to come, on a day they arrange: a cut with
 * Mika from 11:30, at a salon where Hiroshi works as well.
 */

/**
 * What a customer writes when they cancel: a sentence, and an address of
 * the web, which a line cannot be broken in before its first slash.
 */
const LONG_REASON =
  '急な出張が入りました。詳しい日程は、こちらにあります: https://calendar.example.com/business_trip_to_fukuoka_and_kagoshima_from_november_to_december_2026'

const mainMenu = (page: Page): Locator =>
  page.getByRole('navigation', { name: 'メインメニュー' })

const whichList = (page: Page): Locator =>
  page.getByRole('navigation', { name: '予約の時期' })

const bookingsIn = (page: Page, name: string): Locator =>
  part(page, name).getByRole('listitem')

const moveLink = (page: Page): Locator =>
  page.getByRole('link', { name: '日時を変更する' })

const cancelButton = (page: Page): Locator =>
  page.getByRole('button', { name: '予約をキャンセルする' })

const dialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: '予約をキャンセルしますか？' })

const reasonControl = (page: Page): Locator =>
  dialog(page).getByRole('textbox', { name: 'キャンセルの理由' })

/** A booking as the database has it. */
const stored = (api: TestApi, id: string) =>
  api.query(
    `select bookings.status::text, staff."displayName" as staff, bookings."cancellationReason",
            to_char(bookings."startTime" at time zone 'Asia/Tokyo', 'HH24:MI') as time
     from bookings join staff on staff.id = bookings."staffId"
     where bookings.id = $1`,
    [id],
  )

test.describe('the bookings of a customer, in a browser', () => {
  test('should list a booking that was just made, move it to another time with another member of the staff, and cancel it with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange: a cut with Mika from 11:30, booked on the screen
    const date = await openDay(api, { [MIKA]: '10:00', [HIROSHI]: '10:00' })
    await page.goto(
      `${PORTAL.origin}/salons/${await salonId(api)}/services/${await serviceId(api)}/booking?staffId=${await staffId(api, MIKA)}&date=${date}`,
    )
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await time(page, '11:30').check()
    await page.getByRole('button', { name: 'この内容で予約する' }).click()
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/)
    const id = new URL(page.url()).pathname.replace('/bookings/', '')

    // Act: to the bookings, by the link of the header
    await mainMenu(page).getByRole('link', { name: '予約の一覧' }).click()

    // Assert: the visits to come with the new one, the earliest first
    await expect(heading(page, '予約の一覧')).toBeFocused()
    await expect(bookingsIn(page, 'これからの予約')).toHaveCount(3)
    const booked = part(page, 'これからの予約').getByRole('link', {
      name: /11:30〜12:30$/,
    })
    // The link is underlined as a whole: its day and its hours, each a box
    // of its own, as well as the space between them
    await expect(booked).toHaveCSS('text-decoration-line', 'underline')
    await expect(booked.getByText('11:30〜12:30')).toHaveCSS(
      'text-decoration-line',
      'underline',
    )
    await expect(
      mainMenu(page).getByRole('link', { name: '予約の一覧' }),
    ).toHaveAttribute('aria-current', 'page')
    await expectSoundPage(page)

    // Act
    await booked.click()

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/bookings/${id}`)
    await expect(details(page).nth(3)).toHaveText(MIKA)
    await expectSoundPage(page)

    // Act
    await moveLink(page).click()

    // Assert: the screen opens with the member of the staff and the day of
    // the booking, and she has one time left beside the booking
    await expect(heading(page, '日時の変更')).toBeFocused()
    await expect(staffControl(page)).toHaveValue(await staffId(api, MIKA))
    await expect(dateControl(page)).toHaveValue(date)
    await expect(times(page)).toHaveCount(1)
    await expectSoundPage(page)

    // Act: with somebody else
    await staffControl(page).selectOption(HIROSHI)
    await expect(times(page)).toHaveCount(5)

    // Assert: a choice replaces the entry of the screen, so one step back
    // leads out of it, and the step forward to the choice
    await page.goBack()
    await expect(heading(page, '予約の内容')).toBeVisible()
    await page.goForward()
    await expect(staffControl(page)).toHaveValue(await staffId(api, HIROSHI))
    await expect(times(page)).toHaveCount(5)

    // Act: at noon
    await time(page, '12:00').check()
    await page.getByRole('button', { name: 'この日時に変更する' }).click()

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText('予約の日時を変更しました。')).toBeVisible()
    await expect(details(page).nth(3)).toHaveText(HIROSHI)
    await expect(details(page).nth(4)).toHaveText(/日 12:00〜13:00（1 時間）$/)
    expect(await stored(api, id)).toEqual([
      {
        status: 'pending',
        staff: HIROSHI,
        cancellationReason: null,
        time: '12:00',
      },
    ])

    // Act: the dialog is opened with the keyboard
    await cancelButton(page).focus()
    await page.keyboard.press('Enter')

    // Assert: it takes the focus, at its first control
    await expect(dialog(page)).toBeVisible()
    await expect(reasonControl(page)).toBeFocused()
    await expectSoundPage(page)

    // Act
    await page.keyboard.press('Escape')

    // Assert: nothing is cancelled, and the focus is back on the button
    await expect(dialog(page)).toBeHidden()
    await expect(cancelButton(page)).toBeFocused()
    await expect(details(page).first()).toContainText('確定待ち')

    // Act: once more, with a reason, through the buttons in their order
    await page.keyboard.press('Enter')
    await expect(reasonControl(page)).toBeFocused()
    await page.keyboard.type('都合が悪くなりました')
    await page.keyboard.press('Tab')
    await expect(
      dialog(page).getByRole('button', { name: '戻る' }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      dialog(page).getByRole('button', { name: 'キャンセルを確定する' }),
    ).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert: the buttons went with the dialog, so the heading has the focus
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText('予約をキャンセルしました。')).toBeVisible()
    await expect(details(page).first()).toHaveText('キャンセル')
    await expect(cancelButton(page)).toBeHidden()
    await expect(moveLink(page)).toBeHidden()
    await expectSoundPage(page)
    expect(await stored(api, id)).toEqual([
      {
        status: 'cancelled',
        staff: HIROSHI,
        cancellationReason: '都合が悪くなりました',
        time: '12:00',
      },
    ])

    // Act: back to the list, which is read again
    await page.getByRole('link', { name: '予約の一覧へ' }).click()

    // Assert
    await expect(heading(page, '予約の一覧')).toBeFocused()
    await expect(bookingsIn(page, 'これからの予約').last()).toContainText(
      'キャンセル',
    )
  })

  test('should keep which list is shown in the address: through a reload, on the way back from a booking, and from the header', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/bookings`)
    await expect(
      page.getByText('予約を確認するには、サインインしてください。'),
    ).toBeVisible()
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(bookingsIn(page, 'これからの予約')).toHaveCount(2)
    const past = whichList(page).getByRole('link', { name: 'これまでの予約' })

    // Act
    await past.click()

    // Assert: another list of the same screen, so the link keeps the focus
    await expect(bookingsIn(page, 'これまでの予約')).toHaveCount(3)
    await expect(page).toHaveURL(`${PORTAL.origin}/bookings?when=past`)
    await expect(past).toBeFocused()
    await expect(past).toHaveAttribute('aria-current', 'page')
    await expectSoundPage(page)

    // Act
    await page.reload()

    // Assert
    await expect(bookingsIn(page, 'これまでの予約')).toHaveCount(3)

    // Act: into a visit that was, and back
    await part(page, 'これまでの予約').getByRole('link').first().click()
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(cancelButton(page)).toBeHidden()
    await expectSoundPage(page)
    await page.goBack()

    // Assert
    await expect(bookingsIn(page, 'これまでの予約')).toHaveCount(3)

    // Act: the header leads to the search, and from there to the bookings
    await mainMenu(page).getByRole('link', { name: 'サロンを探す' }).click()
    await expect(heading(page, PORTAL_START)).toBeFocused()
    await mainMenu(page).getByRole('link', { name: '予約の一覧' }).click()

    // Assert: the list without a query is the one of the visits to come
    await expect(heading(page, '予約の一覧')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/bookings`)
    await expect(bookingsIn(page, 'これからの予約')).toHaveCount(2)
  })
})

test.describe('the bookings of a customer, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the list, what can be done with a booking, the dialog with a long reason and the times of a long day into the width', async ({
    page,
    api,
    request,
  }) => {
    // Arrange: two members of the staff work from 10:00 to 20:00
    const date = await openDay(
      api,
      { [MIKA]: '10:00', [HIROSHI]: '10:00' },
      '20:00',
    )
    await bookThroughApi(request, api, { date, time: '11:30', staff: MIKA })
    await page.goto(`${PORTAL.origin}/bookings`)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert
    await expect(bookingsIn(page, 'これからの予約')).toHaveCount(3)
    await expectSoundPage(page)

    // Act
    await part(page, 'これからの予約')
      .getByRole('link', { name: /11:30〜12:30$/ })
      .click()

    // Assert: at this width, what can be done stands one below the other
    await expect(heading(page, '予約の内容')).toBeFocused()
    const move = await moveLink(page).boundingBox()
    const cancel = await cancelButton(page).boundingBox()
    expect(move).not.toBeNull()
    expect(cancel?.x).toBe(move?.x)
    expect(cancel?.y).toBeGreaterThan(move?.y ?? Number.POSITIVE_INFINITY)
    await expectSoundPage(page)

    // Act: the dialog, with a reason that has a word no line is broken in
    await cancelButton(page).click()
    await reasonControl(page).fill(LONG_REASON)

    // Assert
    await expect(dialog(page)).toBeVisible()
    await expectSoundPage(page)

    // Act: out of the dialog
    await dialog(page).getByRole('button', { name: '戻る' }).click()

    // Assert: the focus is back on the button that opened it
    await expect(dialog(page)).toBeHidden()
    await expect(cancelButton(page)).toBeFocused()

    // Act: to the screen that moves the booking
    await moveLink(page).click()
    await expect(heading(page, '日時の変更')).toBeFocused()
    await staffControl(page).selectOption(HIROSHI)

    // Assert: a time every half hour, the last an hour before the salon
    // closes
    await expect(times(page)).toHaveCount(19)
    await expectSoundPage(page)
  })
})
