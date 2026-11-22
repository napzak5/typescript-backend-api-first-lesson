import { readFile } from 'node:fs/promises'
import type { ShareLinkCrudCreate201 } from '@beauty-salon-frontend/api-client'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { PORTAL } from '../support/applications'
import { expectSoundPage } from '../support/checks'
import { asTheOwner, PDF, PNG, uploadThroughApi } from '../support/files'
import { expect, type TestApi, test } from '../support/fixtures'
import { pressWithTheKeyboard, typeInto } from '../support/screen'
import { heading } from '../support/sign-in'

/*
 * A share link, in a browser: the owner of the salon in Tokyo uploads a
 * file to the object storage of the test server and shares it through the
 * API, and somebody who has no account opens the link the owner gave,
 * with the keyboard alone: types the password, loads the file into the
 * page from the storage, and saves it under its name. An image the page
 * holds is shown, and opened in a tab of its own, on a screen as narrow as
 * a phone as well. The seed data has no file and no share link.
 */

const CONSENT = 'カラー同意書_田中様.pdf'
const PHOTO = '施術後のスタイル_正面から見たところ.png'

/** The password of the link of the consent: the owner tells it apart from the link */
const PASSWORD = 'umi no mieru heya'

type Shared = ShareLinkCrudCreate201['data']

/** What a test reads of a link it made: the link and its token */
const sharedSchema = z.object({
  data: z.object({
    shareLink: z.object({ id: z.string() }),
    token: z.string(),
  }),
}) satisfies z.ZodType<{
  data: Pick<Shared, 'token'> & { shareLink: Pick<Shared['shareLink'], 'id'> }
}>

/**
 * A file the owner of the salon in Tokyo uploads and shares for a day, as
 * the screens of the salon do it, through the API and the storage: the ID
 * of the link, and the address of the portal it is given as.
 */
const shareThroughApi = async (
  request: APIRequestContext,
  api: TestApi,
  file: { name: string; mimeType: string; buffer: Buffer },
  password: string | null,
): Promise<{ id: string; address: string }> => {
  const attachmentId = await uploadThroughApi(request, api, file)
  const shared = await request.post(
    `${api.origin}/api/v1/attachments/${attachmentId}/share-links`,
    {
      headers: await asTheOwner(request, api),
      data: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        maxDownloads: 3,
        password,
      },
    },
  )
  expect(shared.status()).toBe(201)
  const { shareLink, token } = sharedSchema.parse(await shared.json()).data

  return { id: shareLink.id, address: `${PORTAL.origin}/share#token=${token}` }
}

const countSchema = z.tuple([z.object({ downloadCount: z.number() })])

/** How often the link gave its file */
const downloadsOf = async (api: TestApi, shareLinkId: string) =>
  countSchema.parse(
    await api.query('select "downloadCount" from share_links where id = $1', [
      shareLinkId,
    ]),
  )[0].downloadCount

const filePart = (page: Page): Locator =>
  page.getByRole('region', { name: 'ファイル', exact: true })

test.describe('a share link, in a browser', () => {
  test('should let somebody without an account open a file with its password, load it and save it under its name, with the keyboard alone', async ({
    page,
    request,
    api,
  }) => {
    // Arrange
    const link = await shareThroughApi(
      request,
      api,
      { name: CONSENT, mimeType: 'application/pdf', buffer: PDF },
      PASSWORD,
    )

    // Act
    await page.goto(link.address)

    // Assert
    const password = page.getByLabel('パスワード', { exact: true })
    await expect(password).toBeVisible()
    await expect(page).toHaveURL(`${PORTAL.origin}/share`)

    // Act
    await typeInto(password, PASSWORD)
    await page.keyboard.press('Enter')

    // Assert
    await expect(heading(page, CONSENT)).toBeFocused()

    // Act
    await pressWithTheKeyboard(
      filePart(page).getByRole('button', { name: 'ファイルを読み込む' }),
    )

    // Assert
    await expect(
      filePart(page).getByRole('heading', { name: 'ファイル', exact: true }),
    ).toBeFocused()

    // Act
    const downloading = page.waitForEvent('download')
    await pressWithTheKeyboard(
      filePart(page).getByRole('link', { name: '保存する' }),
    )
    const download = await downloading

    // Assert
    expect(download.suggestedFilename()).toBe(CONSENT)
    expect(await readFile(await download.path())).toEqual(PDF)
    expect(await downloadsOf(api, link.id)).toBe(1)
  })
})

test.describe('a share link, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the file into the width, show the image the page loaded, and open it in a tab of its own without another download', async ({
    page,
    request,
    api,
  }) => {
    // Arrange
    const link = await shareThroughApi(
      request,
      api,
      { name: PHOTO, mimeType: 'image/png', buffer: PNG },
      null,
    )

    // Act
    await page.goto(link.address)

    // Assert
    await expect(heading(page, PHOTO)).toBeVisible()
    await expectSoundPage(page)

    // Act
    await filePart(page)
      .getByRole('button', { name: 'ファイルを読み込む' })
      .click()

    // Assert
    await expect(
      filePart(page).getByRole('img', { name: PHOTO }),
    ).toHaveJSProperty('naturalWidth', 1)
    await expectSoundPage(page)

    // Act
    const opening = page.context().waitForEvent('page')
    await filePart(page).getByRole('link', { name: '新しいタブで開く' }).click()
    const tab = await opening

    // Assert
    await expect(tab.locator('img')).toHaveJSProperty('naturalWidth', 1)
    expect(await downloadsOf(api, link.id)).toBe(1)
  })
})
