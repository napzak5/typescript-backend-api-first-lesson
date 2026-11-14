const WRITTEN_LIKE_A_PHONE_NUMBER = /^[\d\s\-+()]+$/

/**
 * The digits of a keyword that is written like a phone number, and null for
 * any other keyword. People write one number in several ways
 * (`090-1234-5678`, `090 1234 5678`, `09012345678`), so such a keyword is
 * compared with the digits of the phone numbers and not with their text.
 */
export const phoneDigitsOf = (keyword: string): string | null => {
  if (!WRITTEN_LIKE_A_PHONE_NUMBER.test(keyword)) {
    return null
  }
  const digits = keyword.replace(/\D/g, '')
  return digits === '' ? null : digits
}
