import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
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

  it('should accept a custom property a component sets on an element of the page', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'sheet/sheet.module.css',
        '.sheet { padding-inline-end: var(--scrollbar-room, 0); }',
      ),
      component(
        'sheet/sheet.tsx',
        "import styles from './sheet.module.css'\nconst note = () => document.documentElement.style.setProperty('--scrollbar-room', '15px')\nexport const Sheet = () => <div className={styles.sheet} onClick={note} />",
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

  it('should count the classes that a module beside the components reads for them', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'tone.module.css',
        '.info { color: var(--color-accent); } .danger { color: var(--color-accent); }',
      ),
      component(
        'tone.ts',
        "import styles from './tone.module.css'\nexport const toneClass = { info: styles['info'], danger: styles['danger'] }",
      ),
    )

    // Assert
    expect(broken).toEqual([])
  })

  it.each<[declaration: string]>([
    ['margin: 0'],
    ['margin: 0 0'],
    ['list-style: none'],
    ['list-style-type: none'],
  ])(
    'should report "%s" in a CSS Module, which the reset does already',
    (declaration) => {
      // Act
      const broken = rulesBrokenBy(
        component('list.module.css', `.list { ${declaration}; }`),
        component(
          'list.tsx',
          "import styles from './list.module.css'\nexport const List = () => <ul className={styles['list']} />",
        ),
      )

      // Assert
      expect(broken).toEqual(['list.module.css: repeats-the-reset'])
    },
  )

  it('should accept a margin that is not 0, and the reset itself', () => {
    // Act
    const broken = rulesBrokenBy(
      component('reset.css', 'p { margin: 0; } ul { list-style: none; }'),
      component(
        'bullets.module.css',
        '.bullets { margin: 0 auto; list-style: disc; }',
      ),
      component(
        'bullets.tsx',
        "import styles from './bullets.module.css'\nexport const Bullets = () => <ul className={styles['bullets']} />",
      ),
    )

    // Assert
    expect(broken).toEqual([])
  })

  it.each<[query: string]>([
    ['(min-width: 48rem)'],
    ['(max-width: 40rem)'],
    ['(min-width: 40rem) and (max-width: 59rem)'],
  ])(
    'should report "@media %s", which no stylesheet is widened at',
    (query) => {
      // Act
      const broken = rulesBrokenBy(
        component(
          'page.css',
          `@media ${query} { main { gap: var(--space-2); } }`,
        ),
      )

      // Assert
      expect(broken).toEqual(['page.css: unknown-breakpoint'])
    },
  )

  it('should accept the two widths a stylesheet is widened at, and queries of no width', () => {
    // Act
    const broken = rulesBrokenBy(
      component(
        'page.css',
        '@media (min-width: 40rem) { main { gap: var(--space-2); } } @media (min-width: 60rem) { main { gap: 0; } } @media (hover: hover) { a { color: currentColor; } } @media print { main { gap: 0; } }',
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

describe('readSourceFiles', () => {
  const made: string[] = []
  const closed: string[] = []

  /** A directory with the files given, removed after the test. */
  const directoryWith = (files: Record<string, string>): string => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'style-rules-'))
    made.push(directory)
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(directory, relative)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, content)
    }

    return directory
  }

  /** Lets nobody read a directory: whoever enters it fails. */
  const close = (directory: string): void => {
    fs.chmodSync(directory, 0o000)
    closed.push(directory)
  }

  afterEach(() => {
    for (const directory of closed.splice(0)) {
      fs.chmodSync(directory, 0o755)
    }
    for (const directory of made.splice(0)) {
      fs.rmSync(directory, { recursive: true })
    }
  })

  it('should read the stylesheets, the components and the modules below a directory, however deep, with what they contain', () => {
    // Arrange
    const directory = directoryWith({
      'tokens.css': ':root {}',
      'packages/ui/src/components/button/button.module.css': '.root {}',
      'packages/ui/src/components/button/button.tsx': 'export {}',
      'packages/ui/src/utils/tone.ts': 'export const TONE = 1',
    })

    // Act
    const files = readSourceFiles(directory)

    // Assert
    expect(files.toSorted((a, b) => a.path.localeCompare(b.path))).toEqual([
      {
        path: 'packages/ui/src/components/button/button.module.css',
        content: '.root {}',
      },
      {
        path: 'packages/ui/src/components/button/button.tsx',
        content: 'export {}',
      },
      {
        path: 'packages/ui/src/utils/tone.ts',
        content: 'export const TONE = 1',
      },
      { path: 'tokens.css', content: ':root {}' },
    ])
  })

  it('should leave out the tests of the modules, which write rules down as text, and what is no stylesheet and no module', () => {
    // Arrange
    const directory = directoryWith({
      'src/page.tsx': 'export {}',
      'src/rules.test.ts': 'export {}',
      'src/page.test.tsx': 'export {}',
      'package.json': '{}',
      'README.md': '',
      'src/logo.svg': '<svg />',
    })

    // Act
    const paths = readSourceFiles(directory).map((file) => file.path)

    // Assert
    expect(paths.toSorted()).toEqual(['src/page.test.tsx', 'src/page.tsx'])
  })

  it.each<[directory: string]>([
    ['node_modules'],
    ['dist'],
    ['storybook-static'],
    ['coverage'],
  ])('should not enter %s, at the top or inside a package', (skipped) => {
    // Arrange: nobody may read the directories, so entering one fails
    const directory = directoryWith({
      'src/page.tsx': 'export {}',
      [`${skipped}/library/styles.css`]: '.a {}',
      [`packages/ui/${skipped}/index.ts`]: 'export {}',
      'packages/ui/src/utils/tone.ts': 'export {}',
    })
    close(path.join(directory, skipped))
    close(path.join(directory, 'packages/ui', skipped))

    // Act
    const paths = readSourceFiles(directory).map((file) => file.path)

    // Assert
    expect(paths.toSorted()).toEqual([
      'packages/ui/src/utils/tone.ts',
      'src/page.tsx',
    ])
  })

  it('should enter a directory whose name only begins like one it leaves out', () => {
    // Arrange
    const directory = directoryWith({
      'distribution/map.tsx': 'export {}',
      'coverage-notes/notes.css': '.a {}',
    })

    // Act
    const paths = readSourceFiles(directory).map((file) => file.path)

    // Assert
    expect(paths.toSorted()).toEqual([
      'coverage-notes/notes.css',
      'distribution/map.tsx',
    ])
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
        'packages/ui/src/utils/tone.ts',
        'packages/ui/src/components/app-shell/app-shell.module.css',
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
