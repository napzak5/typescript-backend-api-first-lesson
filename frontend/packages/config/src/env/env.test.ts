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

  it('should read the application settings from the VITE_ variables', async () => {
    // Arrange
    vi.stubEnv('VITE_APP_TITLE', 'Beauty Salon Portal')
    vi.stubEnv('VITE_APP_VERSION', '1.2.3')
    vi.stubEnv('VITE_FRONTEND_BASE_URL', 'https://portal.example.com')
    vi.stubEnv('VITE_BACKEND_BASE_URL', 'https://api.example.com')

    // Act
    const env = await loadEnv()

    // Assert
    expect({
      title: env.VITE_APP_TITLE.value,
      version: env.VITE_APP_VERSION.value,
      frontendBaseUrl: env.VITE_FRONTEND_BASE_URL.value,
      backendBaseUrl: env.VITE_BACKEND_BASE_URL.value,
    }).toEqual({
      title: 'Beauty Salon Portal',
      version: '1.2.3',
      frontendBaseUrl: 'https://portal.example.com',
      backendBaseUrl: 'https://api.example.com',
    })
  })

  it('should capture the variables once when the module is loaded', async () => {
    // Arrange
    vi.stubEnv('VITE_APP_TITLE', 'Before')
    const env = await loadEnv()

    // Act
    vi.stubEnv('VITE_APP_TITLE', 'After')

    // Assert
    expect(env.VITE_APP_TITLE.value).toBe('Before')
  })
})
