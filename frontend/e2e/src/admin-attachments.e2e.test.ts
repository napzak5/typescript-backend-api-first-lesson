import { readFile } from 'node:fs/promises'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { part, salonId } from './bookings'
import { expectSoundPage } from './checks'
import { PDF, PNG } from './files'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, MANAGER, OWNER } from './sign-in'

/*
 * The files of the salon in Tokyo, in a browser: its manager, with the
 * keyboard alone, uploads a PDF a customer signed, which the browser sends
 * to the object storage of the test server at the URL the API signed, and
 * saves it again from the screen of the file under the name it was
 * uploaded with. The files, an image the browser shows from the storage
 * and the dialog of its removal are shown on a screen as narrow as a phone
 * as well. The seed data has no file.
 */

const CONSENT = 'カラー同意書_田中様.pdf'

const storedSchema = z.array(
  z.object({
    filename: z.string(),
    size: z.number(),
    status: z.string(),
    uploadedBy: z.string(),
  }),
)

/** The files of the salon in Tokyo, as the database of the API has them */
const stored = async (api: TestApi, salon: string) =>
  storedSchema.parse(
    await api.query(
      `select a.filename, a.size, a.status::text, u.email as "uploadedBy"
       from attachments a join users u on u.id = a."uploadedBy"
       where a."salonId" = $1 and a."deletedAt" is null
       order by a."createdAt"`,
      [salon],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const fileControl = (page: Page): Locator =>
  part(page, 'ファイルをアップロードする').getByLabel('ファイル', {
    exact: true,
  })

test.describe('the files of a salon, in a browser', () => {
  test('should let a manager upload a PDF with the keyboard, and save it from the storage under its name', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/files`)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, 'ファイル')).toBeVisible()
    await expect(page.getByText('ファイルはありません')).toBeVisible()

    // Act
    const choosing = page.waitForEvent('filechooser')
    await fileControl(page).focus()
    await page.keyboard.press('Space')
    await (await choosing).setFiles({
      name: CONSENT,
      mimeType: 'application/pdf',
      buffer: PDF,
    })
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'アップロードする' }),
    )

    // Assert
    await expect(
      page.getByText(`「${CONSENT}」をアップロードしました。`),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'ファイルをアップロードする' }),
    ).toBeFocused()
    expect(await stored(api, salon)).toEqual([
      {
        filename: CONSENT,
        size: PDF.length,
        status: 'uploaded',
        uploadedBy: MANAGER,
      },
    ])

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: CONSENT }))

    // Assert
    await expect(heading(page, CONSENT)).toBeFocused()

    // Act
    const downloading = page.waitForEvent('download')
    await pressWithTheKeyboard(page.getByRole('link', { name: '保存する' }))
    const download = await downloading

    // Assert
    expect(download.suggestedFilename()).toBe(CONSENT)
    expect(await readFile(await download.path())).toEqual(PDF)
  })
})

test.describe('the files of a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the files, an image shown from the storage and the dialog of its removal into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/files`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(page.getByText('ファイルはありません')).toBeVisible()
    await fileControl(page).setInputFiles({
      name: '施術前のスタイル_正面から見たところ.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    await page.getByRole('button', { name: 'アップロードする' }).click()
    const link = page.getByRole('link', {
      name: '施術前のスタイル_正面から見たところ.png',
    })
    await expect(link).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await link.click()
    const image = page.getByRole('img', {
      name: '施術前のスタイル_正面から見たところ.png',
    })

    // Assert
    await expect(image).toHaveJSProperty('naturalWidth', 1)
    await expectSoundPage(page)

    // Act
    await page.getByRole('button', { name: 'ファイルを削除する' }).click()

    // Assert
    await expect(
      page.getByRole('dialog', { name: 'ファイルを削除しますか？' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
