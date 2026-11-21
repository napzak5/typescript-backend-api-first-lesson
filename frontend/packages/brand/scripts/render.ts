import { readFile, writeFile } from 'node:fs/promises'
import { chromium, type Page } from '@playwright/test'

/*
 * Draws the images in `public/` from the drawings in `sources/`, with the
 * browser of the browser tests (`pnpm test:e2e:install` installs it):
 *
 *   pnpm --filter @beauty-salon-frontend/brand render
 *
 * The drawings are the sources. Their text is outlines, so that every
 * machine draws the same image. The icon of 16 pixels has a drawing of its
 * own, on a grid of 16, so that its lines fall on whole pixels.
 */

const SOURCES = new URL('../sources/', import.meta.url)
const PUBLIC = new URL('../public/', import.meta.url)

type Size = { width: number; height: number }

/** Draws a drawing as a PNG of a size, keeping what it leaves transparent. */
const draw = async (
  page: Page,
  drawing: string,
  { width, height }: Size,
): Promise<Buffer> => {
  const svg = await readFile(new URL(drawing, SOURCES))
  await page.setViewportSize({ width, height })
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${width}px;height:${height}px}</style><img alt="" src="data:image/svg+xml;base64,${svg.toString('base64')}">`,
  )

  return page.locator('img').screenshot({ omitBackground: true })
}

/** One image of an icon: a square PNG of fewer than 256 pixels a side */
type IconImage = { size: number; png: Buffer }

/** The entry of an image in the directory of an ICO file, which says where its PNG is. */
const directoryEntry = ({ size, png }: IconImage, offset: number): Buffer => {
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size, 0)
  entry.writeUInt8(size, 1)
  // No palette, the reserved byte, one plane, 32 bits a pixel
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(offset, 12)

  return entry
}

/** An ICO file that holds PNG images as they are, which every browser reads. */
const icoOf = (images: IconImage[]): Buffer => {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  // The images follow the directory, one after the other
  const { entries } = images.reduce<{ entries: Buffer[]; offset: number }>(
    ({ entries, offset }, image) => ({
      entries: [...entries, directoryEntry(image, offset)],
      offset: offset + image.png.length,
    }),
    { entries: [], offset: header.length + 16 * images.length },
  )

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)])
}

/** The images of the icon of the tab: the sizes a browser asks for, and the drawing of each */
const ICON_IMAGES: [size: number, drawing: string][] = [
  [16, 'icon-16.svg'],
  [32, 'icon.svg'],
  [48, 'icon.svg'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })

await writeFile(
  new URL('og-image.png', PUBLIC),
  await draw(page, 'og-image.svg', { width: 1200, height: 630 }),
)
await writeFile(
  new URL('apple-touch-icon.png', PUBLIC),
  await draw(page, 'apple-touch-icon.svg', { width: 180, height: 180 }),
)
const icons: IconImage[] = []
for (const [size, drawing] of ICON_IMAGES) {
  icons.push({
    size,
    png: await draw(page, drawing, { width: size, height: size }),
  })
}
await writeFile(new URL('favicon.ico', PUBLIC), icoOf(icons))

await browser.close()
