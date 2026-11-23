type Listener = () => void

/** One value that the browser keeps for the site, and whoever listens to its changes. */
export type KeptValue = {
  /**
   * What is kept, or null when nothing is, also in a browser that refuses
   * access to its storage, as it does for a visitor who lets no site keep
   * data
   */
  read(): string | null
  /**
   * Keeps the value. Answers whether it is kept: a browser that lets the
   * site store nothing refuses, and then no listener is told
   */
  write(value: string): boolean
  clear(): void
  /**
   * Calls the listener whenever the value may have changed, in this tab or
   * in another one. Returns the function that ends the subscription
   */
  subscribe(listener: Listener): () => void
}

/**
 * A value under `key` of `localStorage`: it outlives a reload, and is the
 * same in every tab of the application. Every access goes through here, so
 * a browser that refuses access to its storage is met in one place.
 */
export const keptValue = (key: string): KeptValue => {
  const listeners = new Set<Listener>()

  const notify = (): void => {
    for (const listener of listeners) {
      listener()
    }
  }

  /** Another tab wrote or removed the value: the listeners of this tab hear of it too */
  const onStorage = (event: StorageEvent): void => {
    if (event.key === key || event.key === null) {
      notify()
    }
  }

  return {
    read() {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },

    write(value) {
      try {
        localStorage.setItem(key, value)
      } catch {
        return false
      }
      notify()

      return true
    },

    clear() {
      try {
        localStorage.removeItem(key)
      } catch {
        // Nothing is stored in a browser that refuses access to its storage
      }
      notify()
    },

    subscribe(listener) {
      if (listeners.size === 0) {
        window.addEventListener('storage', onStorage)
      }
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          window.removeEventListener('storage', onStorage)
        }
      }
    },
  }
}
