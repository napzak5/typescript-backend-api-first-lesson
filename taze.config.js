import { defineConfig } from 'taze'

export default defineConfig({
  // Always ask the registry instead of trusting the local cache
  force: true,

  // `pnpm update:check` only reports; `pnpm update:install` passes -w --install
  write: false,
  install: false,

  ignorePaths: ['**/node_modules/**', '**/dist/**', '**/build/**'],

  // packageManager and the pnpm overrides are maintained by hand
  depFields: {
    dependencies: true,
    devDependencies: true,
    peerDependencies: false,
    optionalDependencies: true,
    packageManager: false,
    overrides: false,
  },
})
