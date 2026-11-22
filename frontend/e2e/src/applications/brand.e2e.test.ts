import { applications, PRODUCT_NAME } from '@beauty-salon-frontend/brand'
import type { Page } from '@playwright/test'
import { APPLICATIONS, type Application, PORTAL } from '../support/applications'
import { edgesOf } from '../support/checks'
import { expect, test } from '../support/fixtures'
import { heading, PORTAL_START } from '../support/sign-in'

/*
 * The brand, as the built applications serve it. The icons and the image of
 * a shared link are files of their own, of their type and of their size:
 * the server of an application answers an address it does not know with
 * its page, so a file that is missing would come back as HTML. The head of
 * the page names the application and points at them, in the page as it is
 * sent, which is what a service that shows a link reads: it runs no script.
 */

/** The first bytes of every PNG */
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** The size of a PNG, which its header gives */
const sizeOfPng = (png: Buffer): { width: number; height: number } => {
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE)

  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

/** The sizes of the images of an ICO file whose images are PNGs */
const sizesOfIco = (ico: Buffer): number[] => {
  // Two bytes that are 0, then 1 for an icon, then the number of images
  expect(ico.readUInt16LE(2)).toBe(1)

  return Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + 16 * index
    const start = ico.readUInt32LE(entry + 12)
    const { width, height } = sizeOfPng(
      ico.subarray(start, start + ico.readUInt32LE(entry + 8)),
    )
    expect(height).toBe(width)

    return width
  })
}

/** A file the application serves at an address below its root, with its type */
const fileOf = async (
  page: Page,
  { origin }: Application,
  path: string,
): Promise<{ type: string; body: Buffer }> => {
  const response = await page.request.get(`${origin}${path}`)
  expect(response.ok()).toBe(true)

  return {
    type: response.headers()['content-type'] ?? '',
    body: await response.body(),
  }
}

for (const application of APPLICATIONS) {
  test.describe(`the brand of the ${application.name}`, () => {
    test('should serve its icons and the image of a link as images of their size', async ({
      page,
    }) => {
      // Act
      const [icon, touchIcon, image] = await Promise.all([
        fileOf(page, application, '/favicon.ico'),
        fileOf(page, application, '/apple-touch-icon.png'),
        fileOf(page, application, '/og-image.png'),
      ])

      // Assert
      expect(icon.type).toMatch(/^image\/(x-icon|vnd\.microsoft\.icon)$/)
      expect(sizesOfIco(icon.body)).toEqual([16, 32, 48])
      expect(touchIcon.type).toBe('image/png')
      expect(sizeOfPng(touchIcon.body)).toEqual({ width: 180, height: 180 })
      expect(image.type).toBe('image/png')
      expect(sizeOfPng(image.body)).toEqual({ width: 1200, height: 630 })
    })

    test('should name the application, its icons and the image of a link in the page it sends', async ({
      page,
    }) => {
      // Arrange
      const { name, description } = applications[application.key]

      // Act
      const { body } = await fileOf(page, application, '/')

      // Assert: an address of a screen is sent the same page
      const sent = body.toString('utf8')
      for (const tag of [
        `<title>${name}</title>`,
        `<meta name="description" content="${description}">`,
        '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        `<meta property="og:site_name" content="${PRODUCT_NAME}">`,
        `<meta property="og:title" content="${name}">`,
        `<meta property="og:url" content="${application.origin}/">`,
        `<meta property="og:image" content="${application.origin}/og-image.png">`,
        '<meta name="twitter:card" content="summary_large_image">',
      ]) {
        expect(sent).toContain(tag)
      }
      expect((await fileOf(page, application, '/sign-in')).body).toEqual(body)
    })

    test('should show the mark and the name in the header, side by side, as a link to its first screen', async ({
      page,
    }) => {
      // Act
      await page.goto(`${application.origin}/sign-in`)

      // Assert: the mark is as high as a line and a half, beside the middle of the name
      const brand = page
        .getByRole('banner')
        .getByRole('link', { name: application.title, exact: true })
      await expect(brand).toHaveAttribute('href', '/')
      const [link, mark] = await Promise.all([
        edgesOf(brand),
        edgesOf(brand.locator('svg')),
      ])
      expect(mark.bottom - mark.top).toBe(24)
      expect(mark.left).toBe(link.left)
      expect(
        Math.abs((mark.top + mark.bottom) / 2 - (link.top + link.bottom) / 2),
      ).toBeLessThanOrEqual(1)
      await expect(brand.locator('svg')).toHaveAttribute('aria-hidden', 'true')
    })
  })
}

test('should lead from the name in the header to the first screen of the portal', async ({
  page,
}) => {
  // Arrange
  await page.goto(`${PORTAL.origin}/register`)

  // Act
  await page
    .getByRole('banner')
    .getByRole('link', { name: PORTAL.title, exact: true })
    .click()

  // Assert
  await expect(heading(page, PORTAL_START)).toBeVisible()
  await expect(page).toHaveTitle(`${PORTAL_START} | ${PORTAL.title}`)
})
