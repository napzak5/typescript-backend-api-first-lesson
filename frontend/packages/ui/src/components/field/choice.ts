import type { LocalizedText } from '@beauty-salon-shared/i18n'

/** One option of a choice: the value that is sent, and the words that are seen */
export type ChoiceOption = {
  value: string
  label: string
}

/**
 * One option of a choice whose words are a message, written in every
 * language: what a module that is not a component offers (the values of an
 * enum under their names), and a component says (`useSaidChoices`)
 */
export type NamedChoice = {
  value: string
  label: LocalizedText
}

/**
 * One option below the other, or as many beside each other as fit, in
 * columns of one width
 */
export type ChoiceLayout = 'stack' | 'columns'
