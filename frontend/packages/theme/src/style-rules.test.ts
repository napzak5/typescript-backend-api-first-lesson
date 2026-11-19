import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkStyleRules,
  findStyleRuleViolations,
  readSourceFiles,
  type SourceFile,
  themeTokens,
} from './style-rules'

const TOKENS: SourceFile = {
  path: 'theme/tokens.css',
  content:
    ':root { --palette-plum-600: #833a70; --color-accent: var(--palette-plum-600); --space-2: 0.5rem; }',
}

const rulesBrokenBy = (...files: SourceFile[]): string[] =>
  checkStyleRules([TOKENS, ...files]).map(
    ({ path, rule }) => `${path}: ${rule}`,
  )

const component = (path: string, content: string): SourceFile => ({
  path,
  content,
})

describe('checkStyleRules', () => {
  it('should accept a grid layout that reads tokens, with every class in use', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'card/card.module.css',
        '.card { display: grid; gap: var(--space-2); color: var(--color-accent); } .card[data-raised] { border: 1px solid currentColor; }',
      ),
      component(
        'card/card.tsx',
        "import styles from './card.module.css'\nexport const Card = () => <div className={styles['card']} />",
      ),
    )

    // Assert
    expect(broken).toEqual([])
  })

  it.each([
    'display: flex',
    'display: inline-flex',
    'flex: 1',
    'flex-direction: column',
    'flex-wrap: wrap',
    'flex-grow: 1',
  ])('should report "%s" as flex', (declaration) => {
    // Act
    const broken = rulesBrokenBy(
      component('page.css', `main { ${declaration}; }`),
    )

    // Assert
    expect(broken).toEqual(['page.css: no-flex'])
  })

  it('should report a flex container in an inline style', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'row.tsx',
        "export const Row = () => <div style={{ display: 'flex' }} />",
      ),
    )

    // Assert
    expect(broken).toEqual(['row.tsx: no-flex'])
  })

  it.each([
    'color: #fff',
    'color: #1F1C1A',
    'background-color: rgb(0 0 0 / 50%)',
    'border-color: hsl(0 0% 0%)',
    'color: oklch(0.5 0.1 300)',
    'background: color-mix(in srgb, red, blue)',
  ])('should report "%s" as a colour that is not a token', (declaration) => {
    // Act
    const broken = rulesBrokenBy(
      component('page.css', `main { ${declaration}; }`),
    )

    // Assert
    expect(broken).toEqual(['page.css: no-raw-color'])
  })

  it.each([
    'color: white',
    'border: 1px solid Black',
    'background: linear-gradient(to right, red, blue)',
    'box-shadow: 0 1px 2px gray',
    '--card-surface: rebeccapurple',
  ])('should report "%s" as a colour written by its name', (declaration) => {
    // Act
    const broken = rulesBrokenBy(
      component('page.css', `main { ${declaration}; }`),
    )

    // Assert
    expect(broken).toEqual(['page.css: no-raw-color'])
  })

  it.each([
    'color: currentColor',
    'background-color: transparent',
    'border: 1px solid transparent',
    'transition: background-color 120ms ease',
    'white-space: nowrap',
    'background-image: url("red.png")',
    '--mark-red: var(--color-accent); border-color: var(--mark-red)',
  ])('should not take "%s" for a colour', (declaration) => {
    // Act
    const broken = rulesBrokenBy(
      component('page.css', `main { ${declaration}; }`),
    )

    // Assert
    expect(broken).toEqual([])
  })

  it('should let tokens.css write colours out and read the palette', () => {
    // Act
    const broken = checkStyleRules([TOKENS])

    // Assert
    expect(broken).toEqual([])
  })

  it('should report a palette token that a component reads', () => {
    // Act
    const broken = rulesBrokenBy(
      component('page.css', 'main { color: var(--palette-plum-600); }'),
    )

    // Assert
    expect(broken).toEqual(['page.css: no-palette-token'])
  })

  it('should report a token that is not defined', () => {
    // Act
    const broken = rulesBrokenBy(
      component('page.css', 'main { color: var(--color-acent); }'),
    )

    // Assert
    expect(broken).toEqual(['page.css: unknown-token'])
  })

  it('should accept a custom property the stylesheet declares itself', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'page.css',
        'main { --tone: var(--color-accent); color: var(--tone); }',
      ),
    )

    // Assert
    expect(broken).toEqual([])
  })

  it('should accept a custom property a component sets in a style', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'grid/grid.module.css',
        '.grid { display: grid; grid-template-columns: repeat(var(--columns), minmax(0, 1fr)); }',
      ),
      component(
        'grid/grid.tsx',
        "import styles from './grid.module.css'\nexport const Grid = () => <div className={styles.grid} style={{ '--columns': 3 }} />",
      ),
    )

    // Assert
    expect(broken).toEqual([])
  })

  it.each([
    '@tailwind base;',
    '@import "tailwindcss";',
    '@config "../tailwind.config.js";',
    '.button { @apply px-4; }',
    '@theme { --color-brand: var(--color-accent); }',
  ])('should report "%s" as Tailwind', (css) => {
    // Act
    const broken = rulesBrokenBy(component('index.css', css))

    // Assert
    expect(broken).toEqual(['index.css: no-tailwind'])
  })

  it('should report a class a component reads that its CSS Module does not define', () => {
    // Act
    const broken = rulesBrokenBy(
      component('card/card.module.css', '.card { display: grid; }'),
      component(
        'card/card.tsx',
        "import styles from './card.module.css'\nexport const Card = () => <div className={styles['card']}><p className={styles['titel']} /></div>",
      ),
    )

    // Assert
    expect(broken).toEqual(['card/card.tsx: unknown-class'])
  })

  it('should report a class a CSS Module defines that no component reads', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'card/card.module.css',
        '.card { display: grid; } @media (width >= 40rem) { .wide { gap: var(--space-2); } }',
      ),
      component(
        'card/card.tsx',
        "import styles from './card.module.css'\nexport const Card = () => <div className={styles['card']} />",
      ),
    )

    // Assert
    expect(broken).toEqual(['card/card.module.css: unused-class'])
  })

  it('should count the classes that several components read from one CSS Module', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'field/field.module.css',
        '.field { display: grid; } .label { color: var(--color-accent); }',
      ),
      component(
        'field/field.tsx',
        "import styles from './field.module.css'\nexport const Field = () => <div className={styles['field']} />",
      ),
      component(
        'field/label.tsx',
        "import styles from './field.module.css'\nexport const Label = () => <label className={styles['label']} />",
      ),
    )

    // Assert
    expect(broken).toEqual([])
  })

  it('should report a class name written as a string in the markup', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'page.tsx',
        "export const Page = () => <main className='mx-auto p-4' />",
      ),
    )

    // Assert
    expect(broken).toEqual(['page.tsx: no-literal-class-name'])
  })
})

describe('the styles of the frontend', () => {
  // frontend/, from frontend/packages/theme/src
  const frontend = path.join(import.meta.dirname, '../../..')

  it('should define the tokens the components read', () => {
    // Act
    const tokens = themeTokens()

    // Assert
    expect(tokens).toContain('--color-surface')
    expect(tokens).toContain('--space-4')
    expect(tokens).toContain('--font-family')
  })

  it('should find the stylesheets and the components of the packages and the apps', () => {
    // Act
    const paths = readSourceFiles(frontend).map((file) => file.path)

    // Assert
    expect(paths).toEqual(
      expect.arrayContaining([
        'packages/theme/src/tokens.css',
        'packages/ui/src/components/button/button.module.css',
        'packages/ui/src/components/button/button.tsx',
        'apps/portal-app/src/App.module.css',
        'apps/admin-app/src/App.tsx',
      ]),
    )
    expect(paths.filter((file) => /node_modules|dist/.test(file))).toEqual([])
  })

  it('should follow the style rules, in every package and every app', () => {
    // Act
    const violations = findStyleRuleViolations(frontend)

    // Assert
    expect(violations).toEqual([])
  })
})
