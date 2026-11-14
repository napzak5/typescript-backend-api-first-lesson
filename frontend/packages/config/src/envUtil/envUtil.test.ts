import { afterEach, describe, expect, it, vi } from 'vitest'
import { isBrowser } from './envUtil'

const NO_ACTIVE_MODE = {
  production: false,
  staging: false,
  development: false,
  test: false,
  localhost: false,
}

const loadModeFlags = async (mode: string) => {
  vi.stubEnv('MODE', mode)
  vi.resetModules()
  const envUtil = await import('./envUtil')

  return {
    production: envUtil.isProductionMode(),
    staging: envUtil.isStagingMode(),
    development: envUtil.isDevelopmentMode(),
    test: envUtil.isTestMode(),
    localhost: envUtil.isLocalhostMode(),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('runtime mode predicates', () => {
  it.each(['production', 'staging', 'development', 'test', 'localhost'])(
    'should report only the %s mode as active',
    async (mode) => {
      // Act
      const flags = await loadModeFlags(mode)

      // Assert
      expect(flags).toEqual({ ...NO_ACTIVE_MODE, [mode]: true })
    },
  )

  it('should report no mode as active for an unknown Vite mode', async () => {
    // Act
    const flags = await loadModeFlags('analyze')

    // Assert
    expect(flags).toEqual(NO_ACTIVE_MODE)
  })
})

describe('isBrowser', () => {
  it('should return false when there is no window', () => {
    // Act
    const result = isBrowser()

    // Assert
    expect(result).toBe(false)
  })

  it('should return true when a window exists', () => {
    // Arrange
    vi.stubGlobal('window', {})

    // Act
    const result = isBrowser()

    // Assert
    expect(result).toBe(true)
  })
})
