import { cpSync } from 'node:fs'
import { bundledLibrary } from '@beauty-salon-shared/config/vite'
import { defineConfig, mergeConfig, type Plugin } from 'vite'
import manifest from './package.json' with { type: 'json' }

/** The SQL of the package lies next to the bundle, where `sql-content.ts` reads it. */
const copiesSql = (): Plugin => ({
  name: 'copies-sql',
  writeBundle() {
    cpSync('sql', 'dist/sql', { recursive: true })
  },
})

export default defineConfig((environment) =>
  mergeConfig(bundledLibrary(manifest, 'node')(environment), {
    plugins: [copiesSql()],
  }),
)
