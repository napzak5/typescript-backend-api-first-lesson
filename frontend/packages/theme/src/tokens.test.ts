import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const tokensCss = fs.readFileSync(
  path.join(import.meta.dirname, 'tokens.css'),
  'utf8',
)

const declarations = new Map(
  Array.from(
    tokensCss.matchAll(/(--[\w-]+):\s*([^;]+);/g),
    ([, name = '', value = '']) => [name, value.trim()],
  ),
)

/** The colour a token stands for, following `var()` to the palette. */
const colourOf = (token: string): string => {
  const value = declarations.get(token) ?? ''
  const [, referenced] = /^var\((--[\w-]+)\)$/.exec(value) ?? []

  return referenced === undefined ? value : colourOf(referenced)
}

const channel = (hex: string, start: number): number => {
  const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** Relative luminance, WCAG 2.2 */
const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)

/** Contrast ratio, WCAG 2.2 */
const contrast = (foreground: string, background: string): number => {
  const [darker = 0, lighter = 0] = [
    luminance(colourOf(foreground)),
    luminance(colourOf(background)),
  ].sort((a, b) => a - b)

  return (lighter + 0.05) / (darker + 0.05)
}

const SURFACES = [
  '--color-surface',
  '--color-surface-subtle',
  '--color-surface-sunken',
]

describe('the colour tokens', () => {
  it('should all resolve to a colour of the palette', () => {
    // Act
    const unresolved = Array.from(declarations.keys())
      .filter(
        (name) => name.startsWith('--color-') && name !== '--color-overlay',
      )
      .filter((name) => !/^#[0-9a-f]{6}$/.test(colourOf(name)))

    // Assert
    expect(unresolved).toEqual([])
  })

  // WCAG 2.2, 1.4.3 Contrast (Minimum): 4.5:1 for text
  it.each([
    ...SURFACES.map((surface) => ['--color-text', surface]),
    ...SURFACES.map((surface) => ['--color-text-muted', surface]),
    ...SURFACES.map((surface) => ['--color-accent-text', surface]),
    ...SURFACES.map((surface) => ['--color-danger-text', surface]),
    ['--color-on-accent', '--color-accent'],
    ['--color-on-accent', '--color-accent-hover'],
    ['--color-on-danger', '--color-danger'],
    ['--color-on-danger', '--color-danger-hover'],
    ['--color-accent-text', '--color-accent-subtle'],
    ['--color-danger-text', '--color-danger-subtle'],
    ['--color-success-text', '--color-success-subtle'],
    ['--color-warning-text', '--color-warning-subtle'],
    ['--color-info-text', '--color-info-subtle'],
  ])('should let %s be read as text on %s', (foreground, background) => {
    // Act
    const ratio = contrast(foreground, background)

    // Assert
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  // WCAG 2.2, 1.4.11 Non-text Contrast: 3:1 for what identifies a control
  it.each([
    ...SURFACES.map((surface) => ['--color-border-control', surface]),
    ...SURFACES.map((surface) => ['--color-focus', surface]),
    ...SURFACES.map((surface) => ['--color-accent', surface]),
    ...SURFACES.map((surface) => ['--color-danger', surface]),
  ])(
    'should let %s be seen as part of a control on %s',
    (foreground, background) => {
      // Act
      const ratio = contrast(foreground, background)

      // Assert
      expect(ratio).toBeGreaterThanOrEqual(3)
    },
  )
})
