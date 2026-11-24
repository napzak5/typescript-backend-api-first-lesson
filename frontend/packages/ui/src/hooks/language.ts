import { languageStore } from '@beauty-salon-frontend/io'
import {
  type Locale,
  type LocalizedText,
  textIn,
} from '@beauty-salon-shared/i18n'
import { useCallback, useSyncExternalStore } from 'react'
import type { ChoiceOption, NamedChoice } from '../components/field/choice'
import type { FormErrors } from '../components/form/error-focus'
import type { FormSays } from '../components/form/form-values'

/** The language of the page, and the way to choose another */
export type PageLanguage = {
  /** The language the page says its texts in */
  language: Locale
  /**
   * Chooses the language of the page: in this tab and in every other one of
   * the application, from now on and after a reload
   */
  choose: (language: Locale) => void
}

const choose = (language: Locale): void => {
  languageStore.choose(language)
}

/**
 * The language of the page: the one its visitor chose, in this tab or in
 * another, else the one the browser is set to, else Japanese. The
 * component is drawn again when it changes. With the way to choose
 * another, for the choice of the language in the frame of an application.
 */
export const usePageLanguage = (): PageLanguage => {
  const language = useSyncExternalStore(
    languageStore.subscribe,
    languageStore.read,
  )

  return { language, choose }
}

/**
 * How a component says a text: `const say = useSay()`, then
 * `say(uiMessages.close)`. A text of a screen is a message, written in
 * every language, and it is said in the language of the page
 * (`usePageLanguage`). When the language changes, the component is drawn
 * again and says its texts anew.
 *
 * A message is said where it is shown. What is not a component (the rule
 * of a value, what a form makes of an answer) hands the message on, and
 * never a text of one language.
 */
export const useSay = (): ((message: LocalizedText) => string) => {
  const { language } = usePageLanguage()

  return useCallback(
    (message: LocalizedText) => textIn(message, language),
    [language],
  )
}

/**
 * How a component says the options of a choice whose words are messages:
 * `const options = useSaidChoices()`, then
 * `<Select options={options(GENDER_CHOICES)} />`, in the language of the
 * page, and anew when another language is chosen.
 */
export const useSaidChoices = (): ((
  choices: readonly NamedChoice[],
) => ChoiceOption[]) => {
  const say = useSay()

  return useCallback(
    (choices: readonly NamedChoice[]) =>
      choices.map(({ value, label }) => ({ value, label: say(label) })),
    [say],
  )
}

/**
 * What a form whose texts are messages says, in the language of the page:
 * the message about the attempt, for the form, and the errors, for its
 * controls (`error={said.errors['email']}`), said anew whenever the form
 * is drawn.
 *
 * The form itself is given the errors as the attempt left them (`errors`
 * of `Form` and `FormDialog`): it moves the focus for another attempt, and
 * not when only the language changes.
 */
export const useSaidForm = (
  message: LocalizedText | undefined,
  errors: FormErrors<LocalizedText>,
): FormSays => {
  const say = useSay()

  return {
    message: message === undefined ? undefined : say(message),
    errors: Object.fromEntries(
      Object.entries(errors).map(
        ([control, error]): [string, string | undefined] => [
          control,
          error === undefined ? undefined : say(error),
        ],
      ),
    ),
  }
}
