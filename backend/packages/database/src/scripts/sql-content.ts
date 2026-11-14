// Reads the SQL of the package from the `sql` directory, which the build
// copies next to the bundle.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Determine if we're running from dist or src
const isBuilt = __dirname.endsWith('/dist') || __dirname.includes('/dist/')

// Set SQL directory based on where we're running from
const sqlDir = isBuilt
  ? join(__dirname, 'sql') // In dist: dist/sql (sql is at same level as index.js after bundling)
  : join(__dirname, '..', '..', 'sql') // In src: go up to package root from src/scripts/

export const SETUP_SQL = (() => {
  try {
    return readFileSync(join(sqlDir, 'setup.sql'), 'utf-8')
  } catch (error) {
    console.error('Failed to load setup.sql from:', join(sqlDir, 'setup.sql'))
    console.error('Current directory:', __dirname)
    console.error('Is built:', isBuilt)
    console.error('Error:', error)
    return ''
  }
})()
