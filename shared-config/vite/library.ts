import { spawnSync } from 'node:child_process'
import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dirname, relative } from 'node:path/posix'
import type { BuildOptions, Plugin, UserConfig, UserConfigFnObject } from 'vite'

/*
 * How the packages are built into `dist`: by Vite, in library mode. A
 * package states its shape in its `vite.config.ts`, by calling one of the
 * two functions at the end of this file.
 */

/** The `package.json` of a package, and what a build reads of it. */
export type Manifest = {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  [property: string]: unknown
}

/** Where the code of a library that is bundled runs. */
type RunsIn = 'browser' | 'node'

/** What lies under `src` and is not built: tests, stories, and what only they use. */
export const NOT_BUILT = [
  '**/*.test.{ts,tsx}',
  '**/*.stories.tsx',
  '**/*.d.ts',
  '**/__tests__/**',
  '**/__stories__/**',
]

/** The modules of a package that are built. */
const modulesOf = (root: string): string[] =>
  globSync('src/**/*.{ts,tsx}', { cwd: root, exclude: NOT_BUILT })

/**
 * Whether an import of a library of modules stays an import: one that names
 * a package does, and one that names a file of the library is the module
 * that is written for that file.
 */
const namesAPackage = (id: string): boolean => /^[@\w]/.test(id)

/**
 * Whether an import of a library that is bundled stays an import: what the
 * package depends on is installed with it. Everything else a module imports
 * is written into the output.
 */
const leftOut = (manifest: Manifest) => {
  const dependencies = Object.keys({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
  })

  return (id: string): boolean =>
    dependencies.some(
      (dependency) => id === dependency || id.startsWith(`${dependency}/`),
    )
}

/**
 * What the modules read of the environment of an application
 * (`import.meta.env.MODE`), each read left as it is written. Vite would put
 * in the values of the moment the library is built; they are those of the
 * application that is built with the library.
 */
const environmentLeftToTheApplication = (
  root: string,
): Record<string, string> =>
  Object.fromEntries(
    modulesOf(root)
      .flatMap(
        (module) =>
          readFileSync(join(root, module), 'utf8').match(
            /\bimport\.meta\.env\.\w+/g,
          ) ?? [],
      )
      .map((read) => [read, read]),
  )

/**
 * A module imports the stylesheets that were written for it. Vite writes
 * the stylesheet of a library next to the module and leaves the import
 * out, so an application that imports a component would not get its
 * styles. The import is the last statement of the module: its stylesheets
 * come after those of the modules it imports, and no line of the module
 * moves in its source map.
 */
const importsOwnStyles = (): Plugin => ({
  name: 'imports-own-styles',
  // After the plugin of Vite that writes the stylesheets of a module
  enforce: 'post',
  renderChunk(code, chunk) {
    const imports = [...(chunk.viteMetadata?.importedCss ?? [])].map(
      (stylesheet) =>
        `import "./${relative(dirname(chunk.fileName), stylesheet)}";\n`,
    )

    return { code: `${code}${imports.join('')}`, map: null }
  },
})

/**
 * The declarations of the package, emitted by `tsc` from
 * `tsconfig.build.json` once the modules are written: Vite emits none. A
 * package whose types are wrong is not built.
 */
const emitsDeclarations = (root: string): Plugin => ({
  name: 'emits-declarations',
  writeBundle() {
    const emitted = spawnSync(
      'tsc',
      ['--emitDeclarationOnly', '--project', 'tsconfig.build.json'],
      { cwd: root, encoding: 'utf8' },
    )
    if (emitted.status !== 0) {
      this.error(
        [
          'The declarations were not emitted.',
          emitted.stdout,
          emitted.stderr,
          emitted.error?.message,
        ].join('\n'),
      )
    }
  },
})

/**
 * What a library is built with, whatever its shape.
 *
 * - The syntax is left as it is written: the application that is built with
 *   the library decides what it is lowered to.
 * - Only a build for production is made small; every other build can be
 *   read, and has its source maps.
 * - What a package keeps in `public` stays there: its code reads it there.
 * - An element is built with what React builds one with in an application
 *   for production (`react/jsx-runtime`), whatever `NODE_ENV` says when the
 *   library is built: what it builds one with in development is not there
 *   in an application for production.
 */
const library = (
  root: string,
  mode: string,
  plugins: Plugin[],
  build: BuildOptions,
): UserConfig => ({
  root,
  define: environmentLeftToTheApplication(root),
  oxc: { jsx: { development: false } },
  plugins: [...plugins, emitsDeclarations(root)],
  build: {
    target: 'esnext',
    minify: mode === 'production',
    sourcemap: mode !== 'production',
    copyPublicDir: false,
    ...build,
  },
})

/**
 * The configuration of a build, and of nothing else. Vitest reads
 * `vite.config.ts` too, in a package that has no configuration of its own
 * for its tests: they run as they would without this file.
 */
const whenBuilt =
  (configuration: (mode: string) => UserConfig): UserConfigFnObject =>
  ({ command, mode }) =>
    command === 'build' ? configuration(mode) : {}

/**
 * A library with one output file for each module under `src`: a component
 * keeps the import of its own stylesheet, so an application that imports a
 * component gets its styles and no others. It runs in a browser.
 *
 * A stylesheet that is built is no CSS Module any more. Under that name
 * (`*.module.css`) the bundler of an application would name its classes a
 * second time, and the names the built module holds would name nothing.
 */
export const moduleLibrary = (root = process.cwd()): UserConfigFnObject =>
  whenBuilt((mode) =>
    library(root, mode, [importsOwnStyles()], {
      lib: { entry: modulesOf(root), formats: ['es'] },
      rolldownOptions: {
        external: namesAPackage,
        output: {
          preserveModules: true,
          preserveModulesRoot: join(root, 'src'),
          entryFileNames: '[name].js',
          assetFileNames: '[name].built[extname]',
        },
      },
      cssCodeSplit: true,
    }),
  )

/**
 * A library with one output file for each entry (`src/index.ts`, unless
 * the package has more than one), for a browser or for Node.js. What
 * Node.js brings stays an import of a library that runs in it.
 */
export const bundledLibrary = (
  manifest: Manifest,
  runsIn: RunsIn,
  entry: Record<string, string> = { index: 'src/index.ts' },
  root = process.cwd(),
): UserConfigFnObject =>
  whenBuilt((mode) => ({
    ...library(root, mode, [], {
      ssr: runsIn === 'node',
      lib: { entry, formats: ['es'] },
      rolldownOptions: { external: leftOut(manifest) },
    }),
    ssr: { noExternal: true },
  }))
