import { defineConfig } from 'taze'

export default defineConfig({
  // Always ask the registry instead of trusting the local cache
  force: true,

  // `pnpm update:check` only reports; `pnpm update:install` passes -w --install
  write: false,
  install: false,

  ignorePaths: ['**/node_modules/**', '**/dist/**', '**/build/**'],

  // The registry metadata of drizzle-orm is over 60 MB and does not arrive
  // within the default 5 seconds; a package that times out is not checked
  requestTimeout: 60_000,

  // packageManager is maintained by hand, together with the places that name
  // the pnpm version (README.md, docs/development-workflow.md, the bug report
  // template). The overrides of pnpm-workspace.yaml are checked like the
  // dependencies: their lower bounds move to the newest release
  depFields: {
    dependencies: true,
    devDependencies: true,
    peerDependencies: false,
    optionalDependencies: true,
    packageManager: false,
  },
})
