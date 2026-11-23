import type { Preview } from '@storybook/react-vite'
import { languageOfTheCatalogue } from '../src/__stories__/language'
import '@beauty-salon-frontend/theme/styles.css'

/**
 * What every story is rendered with, in the catalogue and in the tests
 * (`vitest.setup.ts` gives this file to `setProjectAnnotations`).
 */
const preview: Preview = {
  ...languageOfTheCatalogue,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
