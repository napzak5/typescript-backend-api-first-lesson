import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ApplicationKey, applications } from './index'
import { brand } from './vite'

/** The page of an application before the plugin, as `index.html` of an application is */
const PAGE = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

/** A directory of its own for each test: the page, and the build of it */
let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'brand-'))
  await writeFile(join(root, 'index.html'), PAGE)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

/** Builds the page with the plugin of an application, and answers the files of the build. */
const buildPage = async (key: ApplicationKey): Promise<string[]> => {
  const outDir = join(root, 'dist')
  await build({
    root,
    configFile: false,
    envDir: root,
    logLevel: 'silent',
    plugins: [brand(key)],
    build: { outDir },
  })

  return readdir(outDir)
}

/** The page of the build */
const builtPage = (): Promise<string> =>
  readFile(join(root, 'dist', 'index.html'), 'utf8')

describe('brand', () => {
  it.each<[ApplicationKey, string, string]>([
    ['portal', 'VITE_PORTAL_APP_URL', 'https://salon.example'],
    ['admin', 'VITE_ADMIN_APP_URL', 'https://admin.salon.example'],
    ['dashboard', 'VITE_DASHBOARD_APP_URL', 'http://127.0.0.1:4103'],
  ])(
    'should name the %s application, its icons and what a link to it shows in the head of its page',
    async (key, variable, origin) => {
      // Arrange
      vi.stubEnv(variable, origin)
      const { name, description } = applications[key]

      // Act
      await buildPage(key)

      // Assert
      const page = await builtPage()
      for (const tag of [
        `<title>${name}</title>`,
        `<meta name="description" content="${description}">`,
        '<meta name="theme-color" content="#ffffff">',
        '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Kushi">',
        `<meta property="og:title" content="${name}">`,
        `<meta property="og:description" content="${description}">`,
        `<meta property="og:url" content="${origin}/">`,
        `<meta property="og:image" content="${origin}/og-image.png">`,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="Kushi: サロンの予約と台帳">',
        '<meta property="og:locale" content="ja_JP">',
        '<meta name="twitter:card" content="summary_large_image">',
      ]) {
        expect(page).toContain(tag)
      }
    },
  )

  it('should put what it adds after what the page has in its head', async () => {
    // Arrange
    vi.stubEnv('VITE_ADMIN_APP_URL', 'https://admin.salon.example')

    // Act
    await buildPage('admin')

    // Assert
    const page = await builtPage()
    expect(page.indexOf('<meta name="viewport"')).toBeLessThan(
      page.indexOf('<title>'),
    )
    expect(page.indexOf('<title>')).toBeLessThan(page.indexOf('</head>'))
  })

  it('should serve the icons and the image of a link at the root of the application', async () => {
    // Arrange
    vi.stubEnv('VITE_PORTAL_APP_URL', 'https://salon.example')

    // Act
    const files = await buildPage('portal')

    // Assert
    expect(files).toEqual(
      expect.arrayContaining([
        'favicon.ico',
        'apple-touch-icon.png',
        'og-image.png',
      ]),
    )
  })

  it('should make an address that ends with a slash whole only once', async () => {
    // Arrange
    vi.stubEnv('VITE_PORTAL_APP_URL', 'https://salon.example/')

    // Act
    await buildPage('portal')

    // Assert
    expect(await builtPage()).toContain(
      '<meta property="og:image" content="https://salon.example/og-image.png">',
    )
  })

  it.each<[string, string | undefined]>([
    ['without the address of the application', undefined],
    ['with an empty address', ''],
    ['with an address that is not whole', 'salon.example'],
    ['with an address of another scheme', 'ftp://salon.example'],
  ])('should fail the build %s', async (_, origin) => {
    // Arrange
    vi.stubEnv('VITE_DASHBOARD_APP_URL', origin)

    // Act
    const built = buildPage('dashboard')

    // Assert
    await expect(built).rejects.toThrow(
      'VITE_DASHBOARD_APP_URL is not the address of the application',
    )
  })

  it("should not read the address of another application's variable", async () => {
    // Arrange: the address of the portal, which the admin application also knows
    vi.stubEnv('VITE_PORTAL_APP_URL', 'https://salon.example')
    vi.stubEnv('VITE_ADMIN_APP_URL', undefined)

    // Act
    const built = buildPage('admin')

    // Assert
    await expect(built).rejects.toThrow(
      'VITE_ADMIN_APP_URL is not the address of the application',
    )
  })
})
