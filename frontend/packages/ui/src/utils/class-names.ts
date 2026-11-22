/**
 * Joins the class names of a CSS Module, leaving out what is not a class
 * name: a condition that is false, and a class the module does not define.
 */
export const classNames = (
  ...names: (string | false | null | undefined)[]
): string => names.filter(Boolean).join(' ')
