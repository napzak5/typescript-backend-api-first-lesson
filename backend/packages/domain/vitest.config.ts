import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Workspace packages are tested from source, not from their last build.
  // Every other package is resolved as Node resolves it when the server
  // runs: without `module`, which names a build that is meant for a bundler.
  ssr: {
    resolve: {
      conditions: [
        '@beauty-salon-backend/source',
        'node',
        'development|production',
      ],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Every file imports much the same modules: they are evaluated once per
    // worker instead of once per file. No test leaves behind what another
    // file could see (`vitest doctor` runs the files in a shuffled order
    // with this setting, twice)
    isolate: false,
  },
})
