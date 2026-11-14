import { afterEach, describe, expect, it, vi } from 'vitest'

const createMemoryStorage = () => {
  const items = new Map<string, string>()

  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
    clear: () => {
      items.clear()
    },
    get length() {
      return items.size
    },
  }
}

const stubBrowserWindow = () => {
  const browserWindow = {
    localStorage: createMemoryStorage(),
    sessionStorage: createMemoryStorage(),
  }
  vi.stubGlobal('window', browserWindow)

  return browserWindow
}

const loadVault = async () => {
  vi.resetModules()
  const { localStorage } = await import('./storage')

  return localStorage
}

describe('localStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should persist a value to the local storage of the browser as JSON', async () => {
    // Arrange
    const browserWindow = stubBrowserWindow()
    const vault = await loadVault()

    // Act
    vault.set('session', { userId: 'u_1', roles: ['admin'] })

    // Assert
    expect(browserWindow.localStorage.getItem('session')).toBe(
      '{"userId":"u_1","roles":["admin"]}',
    )
  })

  it('should not write to the session storage', async () => {
    // Arrange
    const browserWindow = stubBrowserWindow()
    const vault = await loadVault()

    // Act
    vault.set('session', { userId: 'u_1' })

    // Assert
    expect(browserWindow.sessionStorage.length).toBe(0)
  })

  it('should read back the structure that was stored', async () => {
    // Arrange
    stubBrowserWindow()
    const vault = await loadVault()
    vault.set('session', { userId: 'u_1', roles: ['admin'] })

    // Act
    const result = vault.get('session')

    // Assert
    expect(result).toEqual({ userId: 'u_1', roles: ['admin'] })
  })

  it('should read a value that the browser already holds', async () => {
    // Arrange
    const browserWindow = stubBrowserWindow()
    browserWindow.localStorage.setItem('theme', '"dark"')
    const vault = await loadVault()

    // Act
    const result = vault.get('theme')

    // Assert
    expect(result).toBe('dark')
  })

  it('should return undefined for a key that was never stored', async () => {
    // Arrange
    stubBrowserWindow()
    const vault = await loadVault()

    // Act
    const result = vault.get('missing')

    // Assert
    expect(result).toBeUndefined()
  })

  it('should remove only the requested key', async () => {
    // Arrange
    stubBrowserWindow()
    const vault = await loadVault()
    vault.set('session', { userId: 'u_1' })
    vault.set('theme', 'dark')

    // Act
    vault.remove('session')

    // Assert
    expect(vault.get('session')).toBeUndefined()
    expect(vault.get('theme')).toBe('dark')
  })

  it('should remove every key at once', async () => {
    // Arrange
    stubBrowserWindow()
    const vault = await loadVault()
    vault.set('session', { userId: 'u_1' })
    vault.set('theme', 'dark')

    // Act
    vault.removeAll()

    // Assert
    expect(vault.length).toBe(0)
  })
})
