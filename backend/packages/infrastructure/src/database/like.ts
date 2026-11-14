/** A LIKE pattern that matches `keyword` literally, anywhere in the text. */
export const containing = (keyword: string): string =>
  `%${keyword.replace(/[\\%_]/g, '\\$&')}%`
