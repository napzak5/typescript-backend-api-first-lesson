/**
 * What a test of something the browser keeps (`localStorage`) plays: another
 * tab of the application, and a browser that keeps nothing for the site.
 */
import { vi } from 'vitest'

/**
 * Another tab has changed what the site keeps, and the browser tells this
 * tab: the value under `key` is `newValue` now, or gone (`null`). Without a
 * key, the other tab cleared the whole storage.
 */
export const changeInAnotherTab = (
  key: string | null,
  newValue: string | null,
): void => {
  if (key === null) {
    localStorage.clear()
  } else if (newValue === null) {
    localStorage.removeItem(key)
  } else {
    localStorage.setItem(key, newValue)
  }
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
}

/**
 * From here on the browser refuses access to its storage, as it does for a
 * visitor who lets no site keep data. `vi.restoreAllMocks()` ends it.
 */
export const refuseStorage = (): void => {
  vi.spyOn(globalThis, 'localStorage', 'get').mockThrow(
    new DOMException('Access is denied for this document.', 'SecurityError'),
  )
}
