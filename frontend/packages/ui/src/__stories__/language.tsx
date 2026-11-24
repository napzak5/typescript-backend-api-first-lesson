import { languageStore } from '@beauty-salon-frontend/io'
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@beauty-salon-shared/i18n'
import type { Preview } from '@storybook/react-vite'
import { type ReactNode, useEffect } from 'react'

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
 * What the catalogue gives every story for the language of the page: the
 * toolbar that names one, and the choice of the one it names. The texts of
 * a story stay as they are written; what the components say themselves
 * changes.
 */
export const languageOfTheCatalogue: Pick<
  Preview,
  'globalTypes' | 'decorators'
> = {
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
}
