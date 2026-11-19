import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'

/** The directory of a package, which is how Storybook finds it in a pnpm workspace. */
const packageDirectory = (name: string): string =>
  dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)))

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
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
}

export default config
