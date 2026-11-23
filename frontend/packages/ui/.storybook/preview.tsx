import { languageStore } from '@beauty-salon-frontend/io'
import { LOCALES, type Locale } from '@beauty-salon-shared/i18n'
import type { Preview } from '@storybook/react-vite'
import { type ReactNode, useEffect } from 'react'
import '@beauty-salon-frontend/theme/styles.css'

/** The name of each language in that language, as the toolbar of the catalogue offers it */
const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
}

type InLanguageProps = {
  /** The language the toolbar names, and none before anybody chose one */
  language: Locale | undefined
  children: ReactNode
}

/**
 * Chooses the language the toolbar names, as the visitor of an application
 * chooses one: the choice is kept where the applications keep it, and
 * every component that says a text says it anew. Without a choice of the
 * toolbar nothing is chosen, so a test that composes a story decides the
 * language of the page by itself.
 */
const InLanguage = ({ language, children }: InLanguageProps) => {
  useEffect(() => {
    if (language !== undefined) {
      languageStore.choose(language)
    }
  }, [language])

  return children
}

/**
 * What every story is rendered with, in the catalogue and in the tests
 * (`vitest.setup.ts` gives this file to `setProjectAnnotations`).
 */
const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    language: {
      description: 'The language the components say their texts in',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: LOCALES.map((language) => ({
          value: language,
          title: LANGUAGE_NAMES[language],
        })),
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, { globals }) => (
      <InLanguage
        language={LOCALES.find((language) => language === globals['language'])}
      >
        <Story />
      </InLanguage>
    ),
  ],
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
