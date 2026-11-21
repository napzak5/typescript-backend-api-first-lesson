import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * The typefaces are packages whose stylesheets `styles.css` imports. No
 * script imports them, so the check of unused dependencies cannot see
 * whether they are used (knip.json leaves them out): these tests can.
 */

const read = (file: string): string =>
  fs.readFileSync(path.join(import.meta.dirname, file), 'utf8')

/** The typeface packages the theme depends on */
const packages = Array.from(
  read('../package.json').matchAll(/"(@fontsource-variable\/[\w-]+)"/g),
  ([, name = '']) => name,
)

/** The typeface packages whose weights the stylesheet of the theme loads */
const loaded = Array.from(
  read('styles.css').matchAll(
    /@import "(@fontsource-variable\/[\w-]+)\/wght\.css";/g,
  ),
  ([, name = '']) => name,
)

/** The families the page is drawn in, in the order they are tried */
const families = (
  /--font-family:\s*([^;]+);/.exec(read('tokens.css'))?.[1] ?? ''
)
  .split(',')
  .map((family) => family.trim())

/** The family a typeface package declares its files as */
const familyOf = (name: string): string =>
  /font-family:\s*'([^']+)'/.exec(
    read(path.join('../node_modules', name, 'wght.css')),
  )?.[1] ?? ''

describe('the typefaces', () => {
  it('should be one for Latin letters and figures and one for Japanese', () => {
    // Assert
    expect(packages).toEqual([
      '@fontsource-variable/inter',
      '@fontsource-variable/noto-sans-jp',
    ])
  })

  it('should be loaded by the stylesheet of the theme, each of them and no other', () => {
    // Assert
    expect(loaded).toEqual(packages)
  })

  it.each(packages)(
    'should draw the page in the family %s declares, before the typefaces of the system',
    (name) => {
      // Act
      const family = familyOf(name)
      const place = families.indexOf(`"${family}"`)

      // Assert: a family that is misspelled is not an error, the page is
      // then drawn in the typeface of the system
      expect(family).not.toBe('')
      expect(place).toBeGreaterThanOrEqual(0)
      expect(place).toBeLessThan(families.indexOf('system-ui'))
    },
  )

  it('should try the typeface of Latin letters first, so that the figures and the letters in Japanese text are its own', () => {
    // Assert
    expect(families.slice(0, 2)).toEqual([
      '"Inter Variable"',
      '"Noto Sans JP Variable"',
    ])
  })
})
