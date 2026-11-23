import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { type FrameLink, isAtOrBelow } from '@beauty-salon-frontend/app-frame'
import { salonIdIn } from '@beauty-salon-frontend/salon-screens'
import { dashboardFrameMessages } from '@beauty-salon-shared/i18n/messages/dashboard'

const { navigation: names } = dashboardFrameMessages

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
): FrameLink[] => {
  const salonId = salonIdIn(pathname)
  const choice: FrameLink[] =
    role === 'admin'
      ? [
          {
            href: '/',
            label: names.chooseSalon,
            current: pathname === '/',
          },
        ]
      : []
  if (salonId !== undefined) {
    const reports = reportsHrefOf(salonId)
    const trends = trendsHrefOf(salonId)
    const daily = dailyHrefOf(salonId)
    const staff = staffSalesHrefOf(salonId)
    const categories = categorySalesHrefOf(salonId)

    return [
      ...choice,
      {
        href: reports,
        label: names.report,
        current: pathname === reports,
      },
      {
        href: trends,
        label: names.trends,
        current: isAtOrBelow(pathname, trends),
      },
      {
        href: daily,
        label: names.daily,
        current: isAtOrBelow(pathname, daily),
      },
      {
        href: staff,
        label: names.staff,
        current: isAtOrBelow(pathname, staff),
      },
      {
        href: categories,
        label: names.categories,
        current: isAtOrBelow(pathname, categories),
      },
    ]
  }

  return role === 'owner' || role === 'manager'
    ? [{ href: '/', label: names.report, current: false }]
    : choice
}
