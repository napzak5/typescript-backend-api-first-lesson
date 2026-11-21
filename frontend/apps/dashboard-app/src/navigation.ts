import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { NavigationItem } from '@beauty-salon-frontend/ui'

/** The start of the addresses of the screens of one salon. */
const SALON_PATH = /^\/salons\/([^/]+)(?:\/|$)/

/** The salon whose screens an address is of, if it is one of them. */
export const salonIdIn = (pathname: string): string | undefined =>
  SALON_PATH.exec(pathname)?.[1]

/** The sales report of a salon: where its screens begin. */
export const reportsHrefOf = (salonId: string): string =>
  `/salons/${salonId}/reports`

/** Whether an address is that of a screen, or of one below it. */
const isAtOrBelow = (pathname: string, screen: string): boolean =>
  pathname === screen || pathname.startsWith(`${screen}/`)

/**
 * The links of the header: the sales report of the salon of the address.
 * An administrator chooses the salon at the start (`/`); the owner and a
 * manager are led from there to the salon they belong to, so one who is
 * elsewhere (the security of the account) goes back to the report through
 * the start.
 */
export const navigationFor = (
  role: ModelsUserResponse['role'] | undefined,
  pathname: string,
): NavigationItem[] => {
  const salonId = salonIdIn(pathname)
  const choice: NavigationItem[] =
    role === 'admin'
      ? [{ href: '/', label: 'サロンを選ぶ', current: pathname === '/' }]
      : []
  if (salonId !== undefined) {
    const reports = reportsHrefOf(salonId)

    return [
      ...choice,
      {
        href: reports,
        label: '売上レポート',
        current: isAtOrBelow(pathname, reports),
      },
    ]
  }

  return role === 'owner' || role === 'manager'
    ? [{ href: '/', label: '売上レポート', current: false }]
    : choice
}
