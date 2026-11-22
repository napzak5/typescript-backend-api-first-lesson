/**
 * The entries of a list that a person writes a line each (colours, styles,
 * the addresses of pictures; the control is a text of several lines):
 * without the spaces around them, without the empty lines, and each once.
 * (The API takes no entry twice.)
 */
export const linesOf = (text: string): string[] => [
  ...new Set(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  ),
]
