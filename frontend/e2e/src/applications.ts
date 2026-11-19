/** One of the applications, as the browser tests serve it. */
export type Application = {
  /** The directory of the application under `frontend/apps` */
  name: 'portal-app' | 'admin-app' | 'dashboard-app'
  port: number
  origin: string
  /** `VITE_APP_TITLE` of its `.env.test` */
  title: string
}

const application = (
  name: Application['name'],
  port: number,
  title: string,
): Application => ({ name, port, origin: `http://127.0.0.1:${port}`, title })

/**
 * Where the browser tests run the API and the applications: on this machine
 * only, and on ports of their own, so that the development servers (3000 to
 * 3003) may run next to them.
 */
export const API_PORT = 4100
export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`

export const PORTAL = application(
  'portal-app',
  4101,
  'Beauty Salon Portal (Test)',
)
export const ADMIN = application('admin-app', 4102, 'Beauty Salon Admin (Test)')
export const DASHBOARD = application(
  'dashboard-app',
  4103,
  'Beauty Salon Dashboard (Test)',
)

export const APPLICATIONS = [PORTAL, ADMIN, DASHBOARD]
