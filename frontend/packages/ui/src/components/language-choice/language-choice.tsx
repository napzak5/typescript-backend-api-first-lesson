import { LANGUAGE_NAMES, LOCALES, type Locale } from '@beauty-salon-shared/i18n'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { ChangeEvent } from 'react'
import { useSay } from '../../hooks/language'
import { controlClassOf, Field } from '../field/field'
import styles from './language-choice.module.css'

/**
 * Where the choice stands: at the end of the header, beside the account, or
 * in the menu of a narrow screen, where it has the width of the menu
 */
export type LanguageChoicePlace = 'header' | 'menu'

export type LanguageChoiceProps = {
  /** The language of the page */
  language: Locale
  /** Called with the language that is chosen */
  onChoose: (language: Locale) => void
  place: LanguageChoicePlace
}

/**
 * The choice of the language of the page, as the `select` of the browser.
 * Each language is named in that language and marked so (`lang`), so that a
 * visitor who cannot read the page finds their own, and a screen reader
 * reads each name in its language.
 *
 * In the header it is as high as the buttons of the account, and its name
 * is read but not shown: the language it shows says what it is. In the menu
 * its name stands above it, as that of a control of a form does.
 */
export const LanguageChoice = ({
  language,
  onChoose,
  place,
}: LanguageChoiceProps) => {
  const say = useSay()
  const name = say(uiMessages.appShell.language)

  const chosen = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = LOCALES.find((locale) => locale === event.target.value)
    if (next !== undefined) {
      onChoose(next)
    }
  }

  const options = LOCALES.map((locale) => (
    <option key={locale} value={locale} lang={locale}>
      {LANGUAGE_NAMES[locale]}
    </option>
  ))

  return place === 'header' ? (
    <select
      className={styles['inHeader']}
      aria-label={name}
      value={language}
      onChange={chosen}
    >
      {options}
    </select>
  ) : (
    <Field label={name}>
      {(control) => (
        <select
          {...control}
          className={controlClassOf('full')}
          value={language}
          onChange={chosen}
        >
          {options}
        </select>
      )}
    </Field>
  )
}
