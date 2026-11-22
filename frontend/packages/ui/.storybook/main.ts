import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'
import { defaultClientConditions, mergeConfig } from 'vite'

/** The directory of a package, which is how Storybook finds it in a pnpm workspace. */
const packageDirectory = (name: string): string =>
  dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)))

const config: StorybookConfig = {
  // One catalogue for the components of the whole frontend: those of this
  // package, those the screens of the session are made of, the form of the
  // preferences of a customer that two applications show, the tables and
  // the search that the screens of a salon share, the screen of an address
  // that is none of an application, and those that one application has for
  // itself
  stories: [
    '../src/**/*.stories.tsx',
    '../../session/src/**/*.stories.tsx',
    '../../preferences/src/**/*.stories.tsx',
    '../../salon-screens/src/**/*.stories.tsx',
    '../../app-frame/src/**/*.stories.tsx',
    '../../../apps/*/src/**/*.stories.tsx',
  ],
  addons: [
    packageDirectory('@storybook/addon-docs'),
    packageDirectory('@storybook/addon-a11y'),
  ],
  framework: {
    name: packageDirectory('@storybook/react-vite'),
    options: {},
  },
  core: {
    // Nothing about this repository leaves the machine
    disableTelemetry: true,
  },
  // A story of another package imports this one. It is read from source, as
  // the dev servers of the applications read it, so that nothing has to be
  // built before the catalogue shows a change
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        conditions: [
          '@beauty-salon-frontend/source',
          ...defaultClientConditions,
        ],
      },
    }),
}

export default config
