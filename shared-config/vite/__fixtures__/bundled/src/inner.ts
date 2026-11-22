/** Whether a word is of letters only: written with syntax that an older browser does not read. */
export const lettersOnly = (word: string): boolean =>
  /^\p{Letter}+$/v.test(word)

export const inner = (): string => 'what the package holds itself'
