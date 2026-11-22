import { OWNER, SAKURA, VIP } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * The photos of a treatment record and the statistics of the records, as a
 * member of the staff keeps them after a visit: a photo added to the
 * record of Sato Sakura, which has none, and taken away again, then the
 * records of the salon counted, with the keyboard alone. The photo of the
 * test is at an address of example.com, as the API takes only addresses of
 * domain names, and the browser of the test answers it with an image of
 * its own. The seed data has three
 * records, which are counted, and the record of Nakamura Hiroshi has two
 * photos, which are shown on a screen as narrow as a phone.
 */

/** The photo of the test, and the image the browser shows for it */
const PHOTO = 'https://photos.example.com/sakura/after.svg'
const IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30"/></svg>'

/** The treatment record of a customer of the seed data. */
const treatmentOf = (api: TestApi, email: string): Promise<string> =>
  api.idOf(
    `select records.id::text
       from treatment_records records
       join customers on customers.id = records."customerId"
       where customers.email = $1`,
    [email],
  )

const photosSchema = z.array(
  z.object({
    photoType: z.string(),
    photoUrl: z.string(),
    customerConsent: z.boolean(),
    sortOrder: z.number(),
  }),
)

/** The photos of a record as the database of the API has them, in their order. */
const storedPhotos = async (api: TestApi, treatmentId: string) =>
  photosSchema.parse(
    await api.query(
      `select "photoType"::text as "photoType", "photoUrl", "customerConsent", "sortOrder"
       from treatment_photos where "treatmentRecordId" = $1 order by "sortOrder"`,
      [treatmentId],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const photosPart = (page: Page): Locator =>
  page.getByRole('region', { name: '施術写真', exact: true })

test.describe('the photos and the statistics of the treatment records, in a browser', () => {
  test('should add a photo to a record and take it away, then count the records of the salon, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const treatmentId = await treatmentOf(api, SAKURA.email)
    await page.route(PHOTO, (route) =>
      route.fulfill({ contentType: 'image/svg+xml', body: IMAGE }),
    )
    await page.goto(`${ADMIN.origin}/salons/${salon}/treatments/${treatmentId}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(photosPart(page)).toContainText('施術写真はありません。')

    // Act: the form, from the record
    await pressWithTheKeyboard(
      photosPart(page).getByRole('link', { name: '写真を足す' }),
    )
    await expect(heading(page, '施術写真を足す')).toBeFocused()
    const row = page.getByRole('group', { name: '1 枚目の写真' })
    await row.getByRole('combobox', { name: '区分' }).focus()
    await row.getByRole('combobox', { name: '区分' }).selectOption('after')
    await row.getByRole('textbox', { name: '写真の URL', exact: true }).focus()
    await page.keyboard.type(PHOTO)
    await row
      .getByRole('checkbox', {
        name: 'お客様が、写真の撮影と利用に同意している',
      })
      .focus()
    await page.keyboard.press('Space')
    await pressWithTheKeyboard(page.getByRole('button', { name: '写真を足す' }))

    // Assert
    await expect(page.getByText('施術写真を 1 枚足しました。')).toBeVisible()
    await expect(heading(page, '施術記録の内容')).toBeFocused()
    const figure = photosPart(page).getByRole('figure')
    await expect(figure).toContainText('1 枚目：施術後の写真')
    await expect(figure).toContainText(
      'お客様の同意あり。サロンの中だけで使います。',
    )
    // The photo is shown from its address
    await expect
      .poll(() =>
        figure
          .locator('img')
          .evaluate((image) =>
            image instanceof HTMLImageElement ? image.naturalWidth : 0,
          ),
      )
      .toBeGreaterThan(0)
    expect(await storedPhotos(api, treatmentId)).toEqual([
      {
        photoType: 'after',
        photoUrl: PHOTO,
        customerConsent: true,
        sortOrder: 0,
      },
    ])

    // Act: the photo taken away again
    await pressWithTheKeyboard(
      photosPart(page).getByRole('button', { name: '1 枚目の写真を外す' }),
    )
    const dialog = page.getByRole('dialog', {
      name: '1 枚目：施術後の写真を外しますか？',
    })
    await expect(dialog).toBeVisible()
    await pressWithTheKeyboard(
      dialog.getByRole('button', { name: '外す', exact: true }),
    )

    // Assert
    await expect(
      page.getByText('施術後の写真を外しました。', { exact: true }),
    ).toBeVisible()
    await expect(
      photosPart(page).getByRole('heading', { name: '施術写真' }),
    ).toBeFocused()
    await expect(photosPart(page)).toContainText('施術写真はありません。')
    expect(await storedPhotos(api, treatmentId)).toEqual([])

    // Act: the statistics, from the list of the salon
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '施術記録', exact: true }),
    )
    await expect(heading(page, '施術記録')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('link', { name: '施術の統計' }))

    // Assert
    await expect(heading(page, '施術の統計')).toBeFocused()
    const counted = page.getByRole('region', { name: '施術記録の数' })
    await expect(counted).toContainText('施術記録3 件')
    await expect(
      page
        .getByRole('table', { name: '施術記録の多いサービス' })
        .getByRole('row')
        .nth(1),
    ).toContainText('1 位Ladies Cut2 件')

    // Act: days before the salon wrote anything
    await page.getByLabel('集計する期間（から）').fill('2020-01-01')
    await page.getByLabel('集計する期間（まで）').fill('2020-01-31')
    await pressWithTheKeyboard(page.getByRole('button', { name: '集計する' }))

    // Assert
    await expect(
      page.getByText('この期間に書いた施術記録はありません'),
    ).toBeVisible()
    expect(new URL(page.url()).searchParams.toString()).toBe(
      'from=2020-01-01&to=2020-01-31',
    )
  })
})

test.describe('the photos and the statistics, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the photos of a record, the dialog of a removal, the form and the statistics into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const treatmentId = await treatmentOf(api, VIP.email)
    await page.goto(`${ADMIN.origin}/salons/${salon}/treatments/${treatmentId}`)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act
    await expect(photosPart(page).getByRole('figure')).toHaveCount(2)

    // Assert
    await expectSoundPage(page)

    // Act
    await photosPart(page)
      .getByRole('button', { name: '2 枚目の写真を外す' })
      .click()

    // Assert
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectSoundPage(page)

    // Act
    await page.keyboard.press('Escape')
    await photosPart(page).getByRole('link', { name: '写真を足す' }).click()
    await page.getByRole('button', { name: '写真の欄を足す' }).click()
    await expect(
      page.getByRole('group', { name: '2 枚目の写真' }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.goto(`${ADMIN.origin}/salons/${salon}/treatments/statistics`)
    await expect(
      page.getByRole('table', { name: '施術記録の多いサービス' }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)
  })
})
