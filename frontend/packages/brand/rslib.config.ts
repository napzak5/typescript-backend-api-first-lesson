import { defineConfig } from '@rslib/core'

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
const isStaging = process.env.NODE_ENV === 'staging'
const isLocalhost = process.env.NODE_ENV === 'localhost'

/*
 * Two modules: the names of the applications, which their pages read, and
 * the plugin of Vite, which their builds run in Node. The plugin finds the
 * images of `public/` next to `dist/`, as it finds them next to `src/`.
 */
export default defineConfig({
  lib: [
    {
      source: {
        entry: {
          index: 'src/index.ts',
          vite: 'src/vite.ts',
        },
        tsconfigPath: './tsconfig.build.json',
      },
      format: 'esm',
      syntax: 'esnext',
      dts: true,
      bundle: true,
      output: {
        minify: isProduction,
        sourceMap: isDevelopment || isTest || isStaging || isLocalhost,
        target: 'node',
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
          console.log('✅ @beauty-salon-frontend/brand built successfully!')
        })
      },
    },
  ],
})
