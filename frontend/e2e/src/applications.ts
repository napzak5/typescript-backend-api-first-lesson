import { type ApplicationKey, applications } from '@beauty-salon-frontend/brand'

/** One of the applications, as the browser tests serve it. */
export type Application = {
  /** The directory of the application under `frontend/apps` */
  name: `${ApplicationKey}-app`
  /** Its key in the table of the brand */
  key: ApplicationKey
  port: number
  origin: string
  /** Its name, in its header and in the title of its pages */
  title: string
}

const application = (key: ApplicationKey, port: number): Application => ({
  name: `${key}-app`,
  key,
  port,
  origin: `http://127.0.0.1:${port}`,
  title: applications[key].name,
})

/**
 * Where the browser tests run the API and the applications: on this machine
 * only, and on ports of their own, so that the development servers (3000 to
 * 3003) may run next to them.
 */
export const API_PORT = 4100
export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`

export const PORTAL = application('portal', 4101)
export const ADMIN = application('admin', 4102)
export const DASHBOARD = application('dashboard', 4103)

export const APPLICATIONS = [PORTAL, ADMIN, DASHBOARD]
