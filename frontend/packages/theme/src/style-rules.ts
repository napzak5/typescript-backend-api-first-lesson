import fs from 'node:fs'
import path from 'node:path'
import postcss, { type Root } from 'postcss'

/**
 * The rules every stylesheet and component of the frontend follows, as a
 * check that `style-rules.test.ts` runs over the packages and the apps.
 *
 * CSS has no compiler: a misspelt token or class name is not an error, the
 * style is just not applied. These rules turn such mistakes into failures.
 */
type StyleRule =
  /** Layout is CSS Grid: no flex container and no flex item property */
  | 'no-flex'
  /** A colour is a token: no colour written out outside `tokens.css`, as a value or by its name */
  | 'no-raw-color'
  /** The raw scales (`--palette-*`) are read by `tokens.css` only */
  | 'no-palette-token'
  /** `var(--x)` names a token, or a property the same stylesheet or its component sets */
  | 'unknown-token'
  /** Styles are CSS Modules: no Tailwind directive */
  | 'no-tailwind'
  /** A class a component reads from its CSS Module is defined there */
  | 'unknown-class'
  /** A class a CSS Module defines is read by a component */
  | 'unused-class'
  /** A class name comes from a CSS Module, not from a string in the markup */
  | 'no-literal-class-name'

export type StyleRuleViolation = {
  path: string
  rule: StyleRule
  detail: string
}

export type SourceFile = {
  path: string
  content: string
}

const TOKENS_FILE = 'tokens.css'
const RAW_COLOR =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i
/** The colour keywords of CSS; `transparent` and `currentColor` are no colour of their own. */
const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
    'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan ' +
    'darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid ' +
    'darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
    'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ' +
    'ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow ' +
    'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
    'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise ' +
    'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab ' +
    'orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru ' +
    'pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
    'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
)
/** The properties whose value can hold a colour, and every custom property */
const COLOR_PROPERTY =
  /^--|color|background|border|outline|shadow|fill|stroke|decoration|column-rule/
const CUSTOM_PROPERTY_NAME = /--[\w-]+/g
const QUOTED = /"[^"]*"|'[^']*'/g
const TAILWIND_AT_RULES = new Set([
  'tailwind',
  'apply',
  'config',
  'theme',
  'plugin',
  'source',
  'utility',
  'variant',
  'custom-variant',
])
const CUSTOM_PROPERTY_REFERENCE = /var\(\s*(--[\w-]+)/g
const CLASS_SELECTOR = /\.(-?[_a-zA-Z][\w-]*)/g
const STYLES_IMPORT = /import\s+(\w+)\s+from\s+['"](\.[^'"]*\.module\.css)['"]/g
const LITERAL_CLASS_NAME = /className=(?:'[^']*'|"[^"]*")/g
const INLINE_FLEX = /display:\s*['"](?:inline-)?flex['"]/g
const INLINE_CUSTOM_PROPERTY = /['"](--[\w-]+)['"]\s*:/g
const SET_CUSTOM_PROPERTY = /\.setProperty\(\s*['"](--[\w-]+)['"]/g

const isStylesheet = (file: SourceFile): boolean => file.path.endsWith('.css')
const isComponent = (file: SourceFile): boolean => file.path.endsWith('.tsx')
const isTokensFile = (file: SourceFile): boolean =>
  path.basename(file.path) === TOKENS_FILE

const matchesOf = (text: string, pattern: RegExp): string[] =>
  Array.from(text.matchAll(pattern), (match) => match[1] ?? match[0])

const namesColor = (property: string, value: string): boolean =>
  COLOR_PROPERTY.test(property) &&
  value
    .replace(QUOTED, ' ')
    .replace(CUSTOM_PROPERTY_NAME, ' ')
    .toLowerCase()
    .split(/[^a-z-]+/)
    .some((word) => NAMED_COLORS.has(word))

const declaredProperties = (root: Root): Set<string> => {
  const names = new Set<string>()
  root.walkDecls(/^--/, (declaration) => {
    names.add(declaration.prop)
  })
  return names
}

const definedClasses = (root: Root): Set<string> => {
  const names = new Set<string>()
  root.walkRules((rule) => {
    for (const name of matchesOf(rule.selector, CLASS_SELECTOR)) {
      names.add(name)
    }
  })
  return names
}

/** The classes a component reads from the CSS Module it imports as `binding`. */
const readClasses = (component: string, binding: string): Set<string> =>
  new Set([
    ...matchesOf(component, new RegExp(`\\b${binding}\\.([A-Za-z_]\\w*)`, 'g')),
    ...matchesOf(
      component,
      new RegExp(`\\b${binding}\\[\\s*['"]([\\w-]+)['"]\\s*\\]`, 'g'),
    ),
  ])

const checkStylesheet = (
  file: SourceFile,
  root: Root,
  tokens: Set<string>,
  propertiesSetByComponents: Set<string>,
): StyleRuleViolation[] => {
  const violations: StyleRuleViolation[] = []
  const report = (rule: StyleRule, detail: string): void => {
    violations.push({ path: file.path, rule, detail })
  }
  const local = declaredProperties(root)

  root.walkAtRules((atRule) => {
    if (
      TAILWIND_AT_RULES.has(atRule.name) ||
      (atRule.name === 'import' && atRule.params.includes('tailwindcss'))
    ) {
      report('no-tailwind', `@${atRule.name} ${atRule.params}`.trim())
    }
  })

  root.walkDecls((declaration) => {
    const text = `${declaration.prop}: ${declaration.value}`

    if (
      (declaration.prop === 'display' && declaration.value.includes('flex')) ||
      /^flex(?:-|$)/.test(declaration.prop)
    ) {
      report('no-flex', text)
    }

    if (isTokensFile(file)) {
      return
    }

    if (
      RAW_COLOR.test(declaration.value) ||
      namesColor(declaration.prop, declaration.value)
    ) {
      report('no-raw-color', text)
    }

    for (const name of matchesOf(
      declaration.value,
      CUSTOM_PROPERTY_REFERENCE,
    )) {
      if (name.startsWith('--palette-')) {
        report('no-palette-token', text)
      } else if (
        !tokens.has(name) &&
        !local.has(name) &&
        !propertiesSetByComponents.has(name)
      ) {
        report('unknown-token', text)
      }
    }
  })

  return violations
}

const checkComponent = (
  file: SourceFile,
  classesOf: (modulePath: string) => Set<string> | undefined,
): { violations: StyleRuleViolation[]; read: Map<string, Set<string>> } => {
  const violations: StyleRuleViolation[] = []
  const read = new Map<string, Set<string>>()

  for (const literal of matchesOf(file.content, LITERAL_CLASS_NAME)) {
    violations.push({
      path: file.path,
      rule: 'no-literal-class-name',
      detail: literal,
    })
  }
  for (const inline of matchesOf(file.content, INLINE_FLEX)) {
    violations.push({ path: file.path, rule: 'no-flex', detail: inline })
  }

  for (const [, binding = '', specifier = ''] of file.content.matchAll(
    STYLES_IMPORT,
  )) {
    const modulePath = path.join(path.dirname(file.path), specifier)
    const defined = classesOf(modulePath)
    const names = readClasses(file.content, binding)
    read.set(modulePath, new Set([...(read.get(modulePath) ?? []), ...names]))

    for (const name of names) {
      if (defined !== undefined && !defined.has(name)) {
        violations.push({
          path: file.path,
          rule: 'unknown-class',
          detail: `${binding}.${name} is not defined in ${specifier}`,
        })
      }
    }
  }

  return { violations, read }
}

/**
 * Checks the files against the rules. `tokens` are the custom properties the
 * theme defines; a `tokens.css` among the files adds its own.
 */
export const checkStyleRules = (
  files: SourceFile[],
  tokens: ReadonlySet<string> = new Set(),
): StyleRuleViolation[] => {
  const stylesheets = files
    .filter(isStylesheet)
    .map((file) => ({ file, root: postcss.parse(file.content) }))
  const components = files.filter(isComponent)

  const knownTokens = new Set(tokens)
  for (const { file, root } of stylesheets) {
    if (isTokensFile(file)) {
      for (const name of declaredProperties(root)) {
        knownTokens.add(name)
      }
    }
  }
  const propertiesSetByComponents = new Set(
    components.flatMap((file) => [
      ...matchesOf(file.content, INLINE_CUSTOM_PROPERTY),
      ...matchesOf(file.content, SET_CUSTOM_PROPERTY),
    ]),
  )
  const classesByModule = new Map(
    stylesheets
      .filter(({ file }) => file.path.endsWith('.module.css'))
      .map(({ file, root }) => [file.path, definedClasses(root)]),
  )

  const violations = stylesheets.flatMap(({ file, root }) =>
    checkStylesheet(file, root, knownTokens, propertiesSetByComponents),
  )

  const readByModule = new Map<string, Set<string>>()
  for (const component of components) {
    const checked = checkComponent(component, (modulePath) =>
      classesByModule.get(modulePath),
    )
    violations.push(...checked.violations)
    for (const [modulePath, names] of checked.read) {
      readByModule.set(
        modulePath,
        new Set([...(readByModule.get(modulePath) ?? []), ...names]),
      )
    }
  }

  for (const [modulePath, defined] of classesByModule) {
    const read = readByModule.get(modulePath) ?? new Set<string>()
    for (const name of defined) {
      if (!read.has(name)) {
        violations.push({
          path: modulePath,
          rule: 'unused-class',
          detail: `.${name} is not read by a component`,
        })
      }
    }
  }

  return violations
}

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'storybook-static',
  'coverage',
])

/** The stylesheets and components below `directory`, with paths relative to it. */
export const readSourceFiles = (directory: string): SourceFile[] =>
  fs
    .readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter(
      (relative) =>
        (relative.endsWith('.css') || relative.endsWith('.tsx')) &&
        !relative.split(path.sep).some((part) => SKIPPED_DIRECTORIES.has(part)),
    )
    .map((relative) => ({
      path: relative,
      content: fs.readFileSync(path.join(directory, relative), 'utf8'),
    }))

/** The custom properties the theme defines. */
export const themeTokens = (): Set<string> =>
  declaredProperties(
    postcss.parse(
      fs.readFileSync(path.join(import.meta.dirname, TOKENS_FILE), 'utf8'),
    ),
  )

/** What breaks the rules among the stylesheets and components below `directory`. */
export const findStyleRuleViolations = (
  directory: string,
): StyleRuleViolation[] =>
  checkStyleRules(readSourceFiles(directory), themeTokens())
