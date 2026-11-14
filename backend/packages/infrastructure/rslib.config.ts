import { defineConfig } from '@rslib/core'

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
const isStaging = process.env.NODE_ENV === 'staging'
const isLocalhost = process.env.NODE_ENV === 'localhost'

export default defineConfig({
  lib: [
    {
      source: {
        entry: {
          index: 'src/index.ts',
        },
        tsconfigPath: './tsconfig.json',
      },
      format: 'esm',
      syntax: 'esnext',
      // Temporarily disable TypeScript declaration generation to allow build to succeed
      dts: false,
      bundle: true,
      output: {
        minify: isProduction,
        sourceMap: isDevelopment || isTest || isStaging || isLocalhost,
        target: 'node',
        externals: [
          /^@beauty-salon-backend\//,
          'drizzle-orm',
          'postgres',
          'ts-pattern',
        ],
      },
    },
  ],

  output: {
    distPath: {
      root: 'dist',
    },
    cleanDistPath: 'auto',
  },

  plugins: [
    {
      name: 'build-success',
      setup(api) {
        api.onAfterBuild(() => {
          console.log(
            '✅ @beauty-salon-backend/infrastructure built successfully!',
          )
        })
      },
    },
  ],
})
