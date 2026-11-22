import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { build, type UserConfigFnObject } from 'vite'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { bundledLibrary, type Manifest, moduleLibrary } from './library'

/*
 * The libraries of `__fixtures__` are built as a package builds itself, and
 * the tests read what lies in their `dist`. `installed` holds the packages
 * that are installed next to them: one the library depends on
 * (`a-dependency`), one the application brings (`a-peer`), one that only
 * the build of the library has (`a-tool`), and what stands in for React.
 */

const FIXTURES = join(import.meta.dirname, '__fixtures__')
const MODULES = join(FIXTURES, 'modules')
const BUNDLED = join(FIXTURES, 'bundled')
const UNSOUND = join(FIXTURES, 'unsound')

const MANIFEST: Manifest = {
  dependencies: { 'a-dependency': '1.0.0' },
  peerDependencies: { 'a-peer': '1.0.0' },
}

/** Builds a library as `vite build --mode <mode>` builds it in its package. */
const built = async (
  library: UserConfigFnObject,
  mode: string,
): Promise<void> => {
  await build({
    configFile: false,
    logLevel: 'silent',
    mode,
    ...library({ command: 'build', mode }),
  })
}

/** The files a build wrote, by their paths below `dist`. */
const filesOf = (root: string): string[] => {
  const dist = join(root, 'dist')

  return readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dist, join(entry.parentPath, entry.name)))
    .toSorted()
}

/** One file a build wrote. */
const written = (root: string, file: string): string =>
  readFileSync(join(root, 'dist', file), 'utf8')

beforeAll(() => {
  cpSync(join(FIXTURES, 'installed'), join(FIXTURES, 'node_modules'), {
    recursive: true,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('a library of modules', () => {
  it('should write a file for each module, with its declarations and its stylesheet, and none for a test, a story or what lies in `public`', async () => {
    // Act
    await built(moduleLibrary(MODULES), 'production')

    // Assert
    expect(filesOf(MODULES)).toEqual([
      'about.js',
      'badge/badge.d.ts',
      'badge/badge.js',
      'badge/badge.module.built.css',
      'badge/badge.module.js',
      'index.d.ts',
      'index.js',
      'label.d.ts',
      'label.js',
      'words.d.ts',
      'words.js',
    ])
  })

  it('should write a module where it lies below `src`, also when it reads a file of the package that lies outside `src`', async () => {
    // Act
    await built(moduleLibrary(MODULES), 'production')

    // Assert
    expect(written(MODULES, 'words.js')).toContain('from "./about.js"')
  })

  it.each<[string]>([['production'], ['development']])(
    'should let a module import the stylesheet that was written for it: %s',
    async (mode) => {
      // Act
      await built(moduleLibrary(MODULES), mode)

      // Assert
      expect(written(MODULES, 'badge/badge.module.js')).toContain(
        ';\nimport "./badge.module.built.css";\n',
      )
    },
  )

  it('should name the classes of a stylesheet once, as the module names them', async () => {
    // Act
    await built(moduleLibrary(MODULES), 'production')

    // Assert
    const [, name] =
      /"(_badge_\w+)"/.exec(written(MODULES, 'badge/badge.module.js')) ?? []
    expect(written(MODULES, 'badge/badge.module.built.css')).toBe(
      `.${name}{color:red}\n`,
    )
  })

  it('should leave the import of a package an import, whether the library depends on it or not', async () => {
    // Act
    await built(moduleLibrary(MODULES), 'production')

    // Assert
    expect(written(MODULES, 'words.js').match(/from "[^."][^"]*"/g)).toEqual([
      'from "@a-scope/a-package"',
      'from "a-dependency"',
      'from "a-dependency/part"',
      'from "a-peer"',
      'from "a-tool"',
    ])
  })

  it.each<[string]>([['production'], ['development'], ['test']])(
    'should build an element with what React builds one with in an application for production, whatever the environment says: NODE_ENV=%s',
    async (environment) => {
      // Arrange
      vi.stubEnv('NODE_ENV', environment)

      // Act
      await built(moduleLibrary(MODULES), 'development')

      // Assert
      expect(written(MODULES, 'label.js').match(/from "[^"]+"/g)).toEqual([
        'from "react/jsx-runtime"',
      ])
    },
  )

  it('should leave what a module reads of the environment of an application as it is written', async () => {
    // Act
    await built(moduleLibrary(MODULES), 'production')

    // Assert
    expect(written(MODULES, 'words.js')).toContain('import.meta.env.MODE')
  })

  it.each<[string, boolean]>([
    ['development', true],
    ['test', true],
    ['staging', true],
    ['production', false],
  ])(
    'should write a build that can be read, with its source maps, unless it is for production: %s',
    async (mode, readable) => {
      // Act
      await built(moduleLibrary(MODULES), mode)

      // Assert
      expect([
        written(MODULES, 'words.js').includes('var words = '),
        existsSync(join(MODULES, 'dist', 'words.js.map')),
      ]).toEqual([readable, readable])
    },
  )
})

describe('a library that is bundled', () => {
  it.each<[string, 'browser' | 'node']>([
    ['a browser', 'browser'],
    ['Node.js', 'node'],
  ])(
    'should write one file for `src/index.ts`, with the declarations of every module, and none for what lies in `public`: for %s',
    async (_, runsIn) => {
      // Act
      await built(
        bundledLibrary(MANIFEST, runsIn, undefined, BUNDLED),
        'production',
      )

      // Assert
      expect(filesOf(BUNDLED)).toEqual([
        'host.d.ts',
        'index.d.ts',
        'index.js',
        'inner.d.ts',
        'parts.d.ts',
      ])
    },
  )

  it('should write one file for each entry a package names', async () => {
    // Act
    await built(
      bundledLibrary(
        MANIFEST,
        'node',
        { index: 'src/index.ts', host: 'src/host.ts' },
        BUNDLED,
      ),
      'production',
    )

    // Assert
    expect(filesOf(BUNDLED)).toEqual([
      'host.d.ts',
      'host.js',
      'index.d.ts',
      'index.js',
      'inner.d.ts',
      'parts.d.ts',
    ])
  })

  it.each<[string, 'browser' | 'node']>([
    ['a browser', 'browser'],
    ['Node.js', 'node'],
  ])(
    'should leave the import of what the package depends on an import, and write everything else into the file: for %s',
    async (_, runsIn) => {
      // Act
      await built(
        bundledLibrary(MANIFEST, runsIn, undefined, BUNDLED),
        'production',
      )

      // Assert
      const file = written(BUNDLED, 'index.js')
      expect([
        file.match(/from "[^"]+"/g),
        file.includes('what only the build of the library has'),
        file.includes('what the package holds itself'),
      ]).toEqual([['from "a-dependency"'], true, true])
    },
  )

  it('should leave the import of a part of a dependency, and of what an application brings, an import, and no import of a package that is only named like one', async () => {
    // Act
    await built(
      bundledLibrary(
        {
          dependencies: { 'a-tool': '1.0.0' },
          peerDependencies: { 'a-dependency': '1.0.0' },
        },
        'browser',
        { index: 'src/parts.ts' },
        BUNDLED,
      ),
      'production',
    )

    // Assert
    const file = written(BUNDLED, 'index.js')
    expect([
      file.match(/from "[^"]+"/g),
      file.includes('what is named like a dependency and is none'),
    ]).toEqual([['from "a-dependency/part"', 'from "a-tool"'], true])
  })

  it.each<[string, 'browser' | 'node', boolean]>([
    ['Node.js: it is there', 'node', true],
    ['a browser: it is not there', 'browser', false],
  ])(
    'should leave the import of what Node.js brings an import only in a library that runs in it: for %s',
    async (_, runsIn, imported) => {
      // Act
      await built(
        bundledLibrary(MANIFEST, runsIn, { host: 'src/host.ts' }, BUNDLED),
        'production',
      )

      // Assert
      expect(written(BUNDLED, 'host.js').includes('from "node:os"')).toBe(
        imported,
      )
    },
  )

  it('should leave what a module reads of the environment of an application as it is written', async () => {
    // Act
    await built(
      bundledLibrary(MANIFEST, 'browser', undefined, BUNDLED),
      'production',
    )

    // Assert
    expect(written(BUNDLED, 'index.js')).toContain('import.meta.env.MODE')
  })

  it.each<[string, 'browser' | 'node']>([
    ['a browser', 'browser'],
    ['Node.js', 'node'],
  ])(
    'should leave the syntax as it is written, also where an older browser does not read it: for %s',
    async (_, runsIn) => {
      // Act
      await built(
        bundledLibrary(MANIFEST, runsIn, { inner: 'src/inner.ts' }, BUNDLED),
        'production',
      )

      // Assert
      expect(written(BUNDLED, 'inner.js')).toContain('/^\\p{Letter}+$/v')
    },
  )

  it.each<[string, boolean]>([
    ['development', true],
    ['test', true],
    ['staging', true],
    ['production', false],
  ])(
    'should write a build that can be read, with its source maps, unless it is for production: %s',
    async (mode, readable) => {
      // Act
      await built(bundledLibrary(MANIFEST, 'node', undefined, BUNDLED), mode)

      // Assert
      expect([
        written(BUNDLED, 'index.js').includes('var outer = '),
        existsSync(join(BUNDLED, 'dist', 'index.js.map')),
      ]).toEqual([readable, readable])
    },
  )
})

describe('the declarations of a library', () => {
  it.each<[string, UserConfigFnObject]>([
    ['a library of modules', moduleLibrary(UNSOUND)],
    [
      'a library that is bundled',
      bundledLibrary({}, 'node', undefined, UNSOUND),
    ],
  ])(
    'should not build a library whose types are wrong, and say what is wrong: %s',
    async (_, library) => {
      // Act
      const building = built(library, 'production')

      // Assert
      await expect(building).rejects.toThrow(
        /The declarations were not emitted\.\nsrc\/index\.ts\(1,14\): error TS2322/,
      )
    },
  )

  it.each<[string, string, RegExp]>([
    [
      'a compiler that gives up',
      join(FIXTURES, 'a-compiler-that-gives-up'),
      /The declarations were not emitted\.\n\nThe compiler gave up\.\n/,
    ],
    [
      'no compiler',
      '',
      /The declarations were not emitted\.\n\n\nspawnSync tsc ENOENT/,
    ],
  ])(
    'should not build a library whose declarations are not emitted, and say why: %s',
    async (_, path, why) => {
      // Arrange
      vi.stubEnv('PATH', path)

      // Act
      const building = built(moduleLibrary(MODULES), 'production')

      // Assert
      await expect(building).rejects.toThrow(why)
    },
  )
})
