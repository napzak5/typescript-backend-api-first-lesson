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

/** The trends of the sales of a salon. */
export const trendsHrefOf = (salonId: string): string =>
  `${reportsHrefOf(salonId)}/trends`

/** The sales of one day of a salon. */
export const dailyHrefOf = (salonId: string): string =>
  `${reportsHrefOf(salonId)}/daily`

/** The sales of every member of the staff of a salon. */
export const staffSalesHrefOf = (salonId: string): string =>
  `${reportsHrefOf(salonId)}/staff`

/** The sales of every kind of service of a salon. */
export const categorySalesHrefOf = (salonId: string): string =>
  `${reportsHrefOf(salonId)}/categories`

/** Whether an address is that of a screen, or of one below it. */
const isAtOrBelow = (pathname: string, screen: string): boolean =>
  pathname === screen || pathname.startsWith(`${screen}/`)

/**
 * The links of the header: the screens of the sales of the salon of the
 * address.
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
    const trends = trendsHrefOf(salonId)
    const daily = dailyHrefOf(salonId)
    const staff = staffSalesHrefOf(salonId)
    const categories = categorySalesHrefOf(salonId)

    return [
      ...choice,
      { href: reports, label: '売上レポート', current: pathname === reports },
      {
        href: trends,
        label: '売上の推移',
        current: isAtOrBelow(pathname, trends),
      },
      {
        href: daily,
        label: '1 日の売上',
        current: isAtOrBelow(pathname, daily),
      },
      {
        href: staff,
        label: 'スタッフ別の売上',
        current: isAtOrBelow(pathname, staff),
      },
      {
        href: categories,
        label: '区分別の売上',
        current: isAtOrBelow(pathname, categories),
      },
    ]
  }

  return role === 'owner' || role === 'manager'
    ? [{ href: '/', label: '売上レポート', current: false }]
    : choice
}
