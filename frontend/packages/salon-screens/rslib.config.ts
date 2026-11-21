import { defineConfig } from '@rslib/core'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'esnext',
      dts: true,
      // One output file per source file: a component keeps the import of its
      // own stylesheet, so an app that imports a component gets its styles
      bundle: false,
      output: {
        minify: isProduction,
        sourceMap: !isProduction,
      },
    },
  ],
  source: {
    entry: {
      index: [
        './src/**',
        '!./src/**/*.test.{ts,tsx}',
        '!./src/**/*.stories.tsx',
        '!./src/__stories__/**',
      ],
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    // Without it Rslib builds for Node.js and does not handle stylesheets
    target: 'web',
    externals: [
      /^@beauty-salon-frontend\//,
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'react-router',
      'ts-pattern',
      /^zod/,
    ],
    distPath: {
      root: 'dist',
    },
    cleanDistPath: 'auto',
  },
  tools: {
    swc: {
      jsc: {
        transform: {
          react: {
            runtime: 'automatic',
            importSource: 'react',
          },
        },
      },
    },
  },
})
