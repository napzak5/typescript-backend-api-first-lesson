import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { PORTAL } from './applications'
import { HIROSHI, MIKA, staffId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { box, saveButton, text, value } from './mypage'
import { accessTokenOf, CUSTOMER, enterCredentials, heading } from './sign-in'

/*
 * The customer is the first of the seed data: Yuki Tanaka, who has bookings
 * at both salons and has said nothing of what she wishes for.
 */

const PART = '好みの設定'

const OSAKA = 'Hair & Spa Osaka'
const YUI = 'Yui Watanabe'
const TAKESHI = 'Takeshi Ito'

/** How a screen names a member of the staff: with their salon. */
const named = (displayName: string, salon = TOKYO): string =>
  `${displayName}（${salon}）`

/*
 * What somebody writes who has a lot to say, in words that no line can be
 * broken in (a browser breaks a line at a space and after a hyphen, and not
 * at an underscore).
 */
const LONG_COLOR =
  'Ash_brown_with_a_hint_of_beige_and_very_fine_highlights_around_the_face_line'
const LONG_STYLE =
  'A_fringe_that_is_cut_shorter_than_the_eyebrows_or_thinned_out_at_its_ends'
const LONG_IMAGE =
  'https://images.example.com/styles/long_layered_cut_with_soft_curls_and_a_side_parted_fringe_for_autumn_2026.jpg'
const IMAGE = 'https://images.example.com/styles/bob.jpg'
const LONG_STYLE_OF_SERVICE =
  'As_little_talk_as_possible_and_a_word_before_each_step_of_the_treatment'
const LONG_REQUESTS =
  '首が疲れやすいので、シャンプーのときにタオルを入れてもらえると助かります。\n\n使っている製品の一覧: https://products.example.com/organic_shampoo_and_treatment_for_sensitive_scalp_autumn_2026'

const changeLink = (page: Page): Locator =>
  page.getByRole('link', { name: '好みの設定を変更する' })

const wished = (page: Page): Locator =>
  page.getByRole('combobox', { name: '指名したいスタッフ' })

const time = (page: Page, name: string): Locator =>
  page.getByLabel(name, { exact: true })

const addButton = (page: Page): Locator =>
  page.getByRole('button', { name: '時間帯を追加する' })

const removeButton = (page: Page, row: number): Locator =>
  page.getByRole('button', { name: `時間帯 ${row} を削除する` })

/**
 * The two times of a row stand side by side at every width, on one line
 * and as high as each other, also when something is said below one of them
 * alone; the button that takes the row away stands below them.
 */
const expectRowOnOneLine = async (page: Page, row: number): Promise<void> => {
  const start = await time(page, `時間帯 ${row} の開始`).boundingBox()
  const end = await time(page, `時間帯 ${row} の終了`).boundingBox()
  const remove = await removeButton(page, row).boundingBox()
  expect(start).not.toBeNull()
  expect(end?.y).toBe(start?.y)
  expect(end?.height).toBe(start?.height)
  expect(end?.x).toBeGreaterThan(start?.x ?? Number.POSITIVE_INFINITY)
  expect(remove?.y).toBeGreaterThan(start?.y ?? Number.POSITIVE_INFINITY)
}

/** The preferences of the customer as the database has them. */
const stored = (api: TestApi) =>
  api.query(
    `select stored."preferredStaffId"::text, stored."avoidStaffIds"::text[], stored."preferredTimeSlots",
            stored."stylePreferences", stored."communicationStyle", stored."specialRequests"
     from customer_preferences stored join customers on customers.id = stored."customerId"
     where customers.email = $1 and customers."deletedAt" is null`,
    [CUSTOMER],
  )

/**
 * What the customer said they wish for a while ago: asked of the API as a
 * client that is no screen does it.
 */
const prefer = async (
  request: APIRequestContext,
  api: TestApi,
  preferences: Record<string, unknown>,
): Promise<void> => {
  const answer = await request.patch(
    `${api.origin}/api/v1/customers/me/preferences`,
    {
      headers: {
        Authorization: `Bearer ${await accessTokenOf(request, api, CUSTOMER)}`,
      },
      data: preferences,
    },
  )
  expect(answer.status()).toBe(200)
}

test.describe('the preferences of a customer, in a browser', () => {
  test('should lead from the page to the form, take what the customer wishes for with the keyboard, and show it on the page, also after a reload', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/mypage`)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert
    await expect(value(page, PART, '指名したいスタッフ')).toHaveText('指定なし')
    await expect(value(page, PART, '希望する時間帯')).toHaveText('指定なし')
    await expectSoundPage(page)

    // Act: to the form, by its link and the Enter key
    await changeLink(page).focus()
    await page.keyboard.press('Enter')

    // Assert
    await expect(heading(page, '好みの設定')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/mypage/preferences`)
    await expect(wished(page)).toHaveValue('')
    await expectSoundPage(page)

    // Act: the controls follow each other as they are read
    await page.keyboard.press('Tab')
    await expect(wished(page)).toBeFocused()
    await wished(page).selectOption({ label: named(HIROSHI) })
    await page.keyboard.press('Tab')
    await expect(page.getByRole('checkbox').first()).toBeFocused()
    await box(page, named(MIKA)).focus()
    await page.keyboard.press('Space')

    // Act: a row for a time slot, by the Enter key on the button. The
    // focus goes to the row that is new
    await addButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(time(page, '時間帯 1 の開始')).toBeFocused()
    await time(page, '時間帯 1 の開始').fill('10:00')
    await time(page, '時間帯 1 の終了').fill('12:00')
    await addButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(time(page, '時間帯 2 の開始')).toBeFocused()
    await time(page, '時間帯 2 の開始').fill('18:00')
    await time(page, '時間帯 2 の終了').fill('20:30')

    // Assert
    await expectRowOnOneLine(page, 1)
    await expectRowOnOneLine(page, 2)
    await expectSoundPage(page)

    // Act: the first row is taken away. Its button is gone with it, and
    // the focus goes to the button that adds a row
    await removeButton(page, 1).focus()
    await page.keyboard.press('Enter')

    // Assert: the row that stays is the first now
    await expect(addButton(page)).toBeFocused()
    await expect(time(page, '時間帯 1 の開始')).toHaveValue('18:00')
    await expect(time(page, '時間帯 1 の終了')).toHaveValue('20:30')
    await expect(removeButton(page, 2)).toHaveCount(0)

    // Act: the Enter key begins a line where a list is written a line
    // each, and sends the form in a control of one line
    await text(page, '好きな色').focus()
    await page.keyboard.type('Ash brown')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Beige')
    await expect(text(page, '好きな色')).toHaveValue('Ash brown\nBeige')
    await text(page, '接客の好み').focus()
    await page.keyboard.type('Quiet')
    await page.keyboard.press('Enter')

    // Assert
    await expect(page.getByText('好みの設定を変更しました。')).toBeVisible()
    await expect(heading(page, 'マイページ')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/mypage`)
    await expect(value(page, PART, '指名したいスタッフ')).toHaveText(
      named(HIROSHI),
    )
    await expect(value(page, PART, '避けたいスタッフ')).toHaveText(named(MIKA))
    await expect(value(page, PART, '希望する時間帯')).toHaveText('18:00〜20:30')
    await expect(value(page, PART, '好きな色')).toHaveText('Ash brown、Beige')
    await expect(value(page, PART, '接客の好み')).toHaveText('Quiet')
    await expectSoundPage(page)
    expect(await stored(api)).toEqual([
      {
        preferredStaffId: await staffId(api, HIROSHI),
        avoidStaffIds: [await staffId(api, MIKA)],
        preferredTimeSlots: [{ startTime: '18:00', endTime: '20:30' }],
        stylePreferences: {
          preferredLength: null,
          preferredColors: ['Ash brown', 'Beige'],
          avoidStyles: [],
          inspirationImages: [],
        },
        communicationStyle: 'Quiet',
        specialRequests: null,
      },
    ])

    // Act
    await page.reload()

    // Assert: what the page shows is what the API has
    await expect(value(page, PART, '指名したいスタッフ')).toHaveText(
      named(HIROSHI),
    )
    await expect(value(page, PART, '希望する時間帯')).toHaveText('18:00〜20:30')
  })
})

test.describe('the preferences of a customer, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the page with long values and the form with what is wrong into the width', async ({
    page,
    api,
    request,
  }) => {
    // Arrange: somebody who avoids three members of the staff, comes at
    // three times of the day, and writes words no line is broken in
    await prefer(request, api, {
      preferredStaffId: await staffId(api, HIROSHI),
      avoidStaffIds: [
        await staffId(api, MIKA),
        await staffId(api, YUI),
        await staffId(api, TAKESHI),
      ],
      preferredTimeSlots: [
        { startTime: '10:00', endTime: '12:00' },
        { startTime: '13:30', endTime: '15:00' },
        { startTime: '18:00', endTime: '20:30' },
      ],
      stylePreferences: {
        preferredLength: 'Shoulder length',
        preferredColors: [LONG_COLOR, 'Beige'],
        avoidStyles: [LONG_STYLE],
        inspirationImages: [LONG_IMAGE, IMAGE],
      },
      communicationStyle: LONG_STYLE_OF_SERVICE,
      specialRequests: LONG_REQUESTS,
    })
    await page.goto(`${PORTAL.origin}/mypage`)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert
    await expect(value(page, PART, '避けたいスタッフ')).toHaveText(
      `${named(MIKA)}、${named(YUI)}、${named(TAKESHI, OSAKA)}`,
    )
    await expect(value(page, PART, '希望する時間帯')).toHaveText(
      '10:00〜12:00、13:30〜15:00、18:00〜20:30',
    )
    await expect(value(page, PART, '好きな色')).toContainText(LONG_COLOR)
    const images = value(page, PART, '参考の画像').getByRole('link')
    await expect(images).toHaveText([LONG_IMAGE, IMAGE])
    await expect(images.first()).toHaveAttribute('href', LONG_IMAGE)
    // Each address stands on a line of its own, below the one before
    const first = await images.first().boundingBox()
    const second = await images.last().boundingBox()
    expect(first).not.toBeNull()
    expect(second?.y).toBeGreaterThanOrEqual(
      (first?.y ?? Number.POSITIVE_INFINITY) + (first?.height ?? 0),
    )
    // What was written in paragraphs keeps its line breaks
    await expect(
      value(page, PART, '特別な要望').getByText(/首が疲れやすい/),
    ).toHaveCSS('white-space', 'pre-wrap')
    await expect(value(page, PART, '接客の好み')).toHaveText(
      LONG_STYLE_OF_SERVICE,
    )
    await expectSoundPage(page)

    // Act
    await changeLink(page).click()

    // Assert: the two times of a row share a line at this width, too
    await expect(heading(page, '好みの設定')).toBeFocused()
    await expect(text(page, '好きな色')).toHaveValue(`${LONG_COLOR}\nBeige`)
    await expectRowOnOneLine(page, 1)
    await expectRowOnOneLine(page, 3)
    await expectSoundPage(page)

    // Act: what cannot be right. A time slot inside the first, and a line
    // that is no address
    await addButton(page).click()
    await time(page, '時間帯 4 の開始').fill('10:30')
    await time(page, '時間帯 4 の終了').fill('11:30')
    await text(page, '参考の画像の URL').fill(`${LONG_IMAGE}\nno address`)
    await saveButton(page).click()

    // Assert
    await expect(time(page, '時間帯 4 の開始')).toBeFocused()
    await expect(
      page.getByText(
        'ほかの時間帯と重なっています。重ならない時刻にしてください。',
      ),
    ).toBeVisible()
    await expect(
      page.getByText(
        '2 行目を確かめてください。http:// または https:// で始まる URL を、500 文字以内で書いてください。',
      ),
    ).toBeVisible()
    await expect(page).toHaveURL(`${PORTAL.origin}/mypage/preferences`)
    // What is said below the one time does not move the other
    await expectRowOnOneLine(page, 4)
    await expectSoundPage(page)
  })
})
