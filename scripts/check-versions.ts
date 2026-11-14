/**
 * Verifies that every place that pins the Node.js version agrees with
 * `.node-version`, the single source of truth for local tooling and CI.
 *
 * Dockerfiles cannot read `.node-version`, so they repeat it as
 * `ARG NODE_VERSION=...`; `package.json#engines.node` repeats it as a lower bound.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')
const read = (file: string): string =>
  readFileSync(resolve(rootDir, file), 'utf8')

const nodeVersion = read('.node-version').trim()

const dockerfileMismatches = readdirSync(rootDir)
  .filter((file) => file.startsWith('Dockerfile'))
  .flatMap((file) => {
    const pinned = /^ARG NODE_VERSION=(.+)$/m.exec(read(file))?.[1]
    return pinned === nodeVersion
      ? []
      : [`${file}: ARG NODE_VERSION=${pinned ?? '(missing)'}`]
  })

const enginesNode: unknown = JSON.parse(read('package.json')).engines?.node
const enginesMismatches =
  enginesNode === `>=${nodeVersion}`
    ? []
    : [`package.json: engines.node=${String(enginesNode)}`]

const mismatches = [...dockerfileMismatches, ...enginesMismatches]

if (mismatches.length > 0) {
  console.error(
    `Node.js version drift detected (.node-version is ${nodeVersion}):`,
  )
  for (const mismatch of mismatches) {
    console.error(`  - ${mismatch}`)
  }
  process.exitCode = 1
} else {
  console.log(`Node.js ${nodeVersion} is pinned consistently.`)
}
