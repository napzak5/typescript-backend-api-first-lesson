import { execFileSync } from 'node:child_process'

/**
 * Fails when the given paths differ from what is committed.
 *
 * Run it right after regenerating checked-in artifacts: a non-empty result
 * means a spec or schema change was committed without its generated files.
 *
 * Usage: node ./scripts/check-clean.ts <path>...
 */
const paths = process.argv.slice(2)

const changes = execFileSync('git', ['status', '--porcelain', '--', ...paths], {
  encoding: 'utf8',
}).trimEnd()

if (changes === '') {
  console.log(`Up to date: ${paths.join(', ')}`)
} else {
  console.error(
    'Generated files are out of date. Regenerate them and commit the result:',
  )
  console.error(changes)
  process.exitCode = 1
}
