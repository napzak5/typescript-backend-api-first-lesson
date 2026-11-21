import { afterEach, describe, expect, it, vi } from 'vitest'

const loadEnv = async () => {
  vi.resetModules()
  const { env } = await import('./env')

  return env
}

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should expose the Vite mode as the runtime mode', async () => {
    // Arrange
    vi.stubEnv('MODE', 'staging')

    // Act
    const env = await loadEnv()

    // Assert
    expect(env.VITE_MODE.value).toBe('staging')
  })

  it('should read the origin of the API from its VITE_ variable', async () => {
    // Arrange
    vi.stubEnv('VITE_BACKEND_BASE_URL', 'https://api.example.com')

    // Act
    const env = await loadEnv()

    // Assert
    expect(env.VITE_BACKEND_BASE_URL.value).toBe('https://api.example.com')
  })

  it('should leave a variable that is not set undefined', async () => {
    // Arrange
    vi.stubEnv('VITE_BACKEND_BASE_URL', undefined)

    // Act
    const env = await loadEnv()

    // Assert
    expect(env.VITE_BACKEND_BASE_URL.value).toBeUndefined()
  })

  it('should capture the variables once when the module is loaded', async () => {
    // Arrange
    vi.stubEnv('VITE_BACKEND_BASE_URL', 'https://before.example.com')
    const env = await loadEnv()

    // Act
    vi.stubEnv('VITE_BACKEND_BASE_URL', 'https://after.example.com')

    // Assert
    expect(env.VITE_BACKEND_BASE_URL.value).toBe('https://before.example.com')
  })
})
