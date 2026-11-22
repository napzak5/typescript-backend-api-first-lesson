import { readFile } from 'node:fs/promises'
import { MANAGER, OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN, PORTAL } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { PDF, uploadThroughApi } from './files'
import { expect, type TestApi, test } from './fixtures'
import { pressWithTheKeyboard, typeInto } from './screen'
import { enterCredentials, heading } from './sign-in'

/*
 * The share links of a file of the salon in Tokyo, in a browser: its
 * manager, with the keyboard alone, issues a link with a limit and a
 * password and copies its address, which somebody who has no account
 * opens in the portal to save the file; the manager then sees the link
 * used up, and revokes it. The form, the link that was issued and the
 * dialog of the revocation are shown on a screen as narrow as a phone as
 * well. The seed data has no file: the owner uploads one through the API
 * and the storage of the test server.
 */

const CONSENT = 'カラー同意書_田中様.pdf'

/** The password of the link: the manager tells it apart from the link */
const PASSWORD = 'umi no mieru heya'

const storedSchema = z.array(
  z.object({ maxDownloads: z.number().nullable(), downloadCount: z.number() }),
)

/** The links of a file, as the database of the API has them */
const storedLinksOf = async (api: TestApi, attachmentId: string) =>
  storedSchema.parse(
    await api.query(
      `select "maxDownloads", "downloadCount" from share_links
       where "attachmentId" = $1`,
      [attachmentId],
    ),
  )

/** What the screen of a link says, term by term */
const detailsOf = (page: Page) =>
  page
    .getByRole('region', { name: '共有リンク', exact: true })
    .getByRole('definition')
    .allTextContents()

/** The consent the owner of the salon in Tokyo uploaded, and the address of its screen in the admin application */
const consentOf = async (
  request: Parameters<typeof uploadThroughApi>[0],
  api: TestApi,
) => {
  const attachmentId = await uploadThroughApi(request, api, {
    name: CONSENT,
    mimeType: 'application/pdf',
    buffer: PDF,
  })

  return {
    attachmentId,
    address: `${ADMIN.origin}/salons/${await salonId(api)}/files/${attachmentId}`,
  }
}

test.describe('the share links of a file, in a browser', () => {
  test('should let a manager issue a link with the keyboard, copy it, see it used in the portal and revoke it', async ({
    page,
    request,
    api,
  }) => {
    // Arrange
    const file = await consentOf(request, api)
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: ADMIN.origin,
      })
    await page.goto(file.address)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, CONSENT)).toBeVisible()
    await expect(page.getByText('共有リンクはありません')).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '共有リンクを発行する' }),
    )
    await expect(heading(page, '共有リンクを発行する')).toBeFocused()
    await page.getByRole('combobox', { name: '有効期間' }).focus()
    await page.getByRole('combobox', { name: '有効期間' }).selectOption('3')
    await typeInto(
      page.getByRole('textbox', { name: 'ダウンロードの回数の上限' }),
      '1',
    )
    await typeInto(page.getByLabel('パスワード', { exact: true }), PASSWORD)
    await page.keyboard.press('Enter')

    // Assert
    await expect(
      page.getByRole('heading', { name: '発行した共有リンク' }),
    ).toBeFocused()
    const given = await page
      .getByRole('textbox', { name: '共有リンク' })
      .inputValue()
    expect(given).toMatch(
      new RegExp(`^${PORTAL.origin}/share#token=[A-Za-z0-9_-]{43}$`),
    )
    expect(await storedLinksOf(api, file.attachmentId)).toEqual([
      { maxDownloads: 1, downloadCount: 0 },
    ])

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'リンクをコピーする' }),
    )

    // Assert
    await expect(page.getByText('リンクをコピーしました。')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      given,
    )

    // Act: the person the link was given to opens it in the portal
    const viewer = await page.context().newPage()
    await viewer.goto(given)
    await typeInto(viewer.getByLabel('パスワード', { exact: true }), PASSWORD)
    await viewer.keyboard.press('Enter')
    await pressWithTheKeyboard(
      viewer.getByRole('button', { name: 'ファイルを読み込む' }),
    )
    const downloading = viewer.waitForEvent('download')
    await pressWithTheKeyboard(viewer.getByRole('link', { name: '保存する' }))
    const download = await downloading

    // Assert
    expect(download.suggestedFilename()).toBe(CONSENT)
    expect(await readFile(await download.path())).toEqual(PDF)

    // Act: the manager looks at the link
    await page.bringToFront()
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '共有リンクを見る' }),
    )

    // Assert
    await expect(
      page.getByRole('button', { name: '共有リンクを取り消す' }),
    ).toBeVisible()
    expect((await detailsOf(page)).slice(0, 4)).toEqual([
      '回数の上限に達した',
      expect.stringMatching(/^\d{4}年/),
      '1 回（上限 1 回）',
      'あり',
    ])

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '共有リンクを取り消す' }),
    )
    await pressWithTheKeyboard(
      page
        .getByRole('dialog', { name: '共有リンクを取り消しますか？' })
        .getByRole('button', { name: '取り消す' }),
    )

    // Assert
    await expect(page.getByText('共有リンクを取り消しました。')).toBeVisible()
    await expect(heading(page, CONSENT)).toBeVisible()
    await expect(page.getByText('共有リンクはありません')).toBeVisible()
    expect(await storedLinksOf(api, file.attachmentId)).toEqual([])

    // Act: the link is opened again, in a tab of its own
    const again = await page.context().newPage()
    await again.goto(given)

    // Assert
    await expect(heading(again, 'この共有リンクは開けません')).toBeVisible()
  })
})

test.describe('the share links of a file, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the links of a file, the form, the link that was issued and the dialog of its revocation into the width', async ({
    page,
    request,
    api,
  }) => {
    // Arrange
    const file = await consentOf(request, api)
    await page.goto(file.address)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(page.getByText('共有リンクはありません')).toBeVisible()
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: '共有リンクを発行する' }).click()

    // Assert
    await expect(page.getByRole('combobox', { name: '有効期間' })).toBeVisible()
    await expectSoundPage(page)

    // Act
    await page.getByLabel('パスワード', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: '共有リンクを発行する' }).click()

    // Assert
    await expect(
      page.getByRole('textbox', { name: '共有リンク' }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: 'ファイルへ戻る' }).click()

    // Assert
    await expect(
      page.getByRole('table', { name: '発行した共有リンク' }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act
    await page
      .getByRole('table', { name: '発行した共有リンク' })
      .getByRole('link')
      .click()
    await page.getByRole('button', { name: '共有リンクを取り消す' }).click()

    // Assert
    await expect(
      page.getByRole('dialog', { name: '共有リンクを取り消しますか？' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
