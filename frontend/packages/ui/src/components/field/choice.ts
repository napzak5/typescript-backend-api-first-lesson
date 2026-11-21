/** One option of a choice: the value that is sent, and the words that are seen */
export type ChoiceOption = {
  value: string
  label: string
}

/**
 * One option below the other, or as many beside each other as fit, in
 * columns of one width
 */
export type ChoiceLayout = 'stack' | 'columns'
