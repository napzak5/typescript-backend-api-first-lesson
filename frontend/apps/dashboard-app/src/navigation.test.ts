import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { NavigationOf } from '@beauty-salon-frontend/app-frame'
import { inJapanese } from '@beauty-salon-frontend/ui'
import { describe, expect, it } from 'vitest'
import {
  categorySalesHrefOf,
  dailyHrefOf,
  navigationFor as linksFor,
  reportsHrefOf,
  staffSalesHrefOf,
  trendsHrefOf,
} from './navigation'

/** The links of the header, named as a page in Japanese names them */
const navigationFor = (...address: Parameters<NavigationOf>) =>
  linksFor(...address).map(({ label, ...link }) => ({
    ...link,
    label: inJapanese(label),
  }))

const SALON_ID = '3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60'

/** The screens of the sales of the salon, the one of `current` marked */
const salesOf = (current: string) =>
  [
    [`/salons/${SALON_ID}/reports`, '売上レポート'],
    [`/salons/${SALON_ID}/reports/trends`, '売上の推移'],
    [`/salons/${SALON_ID}/reports/daily`, '1 日の売上'],
    [`/salons/${SALON_ID}/reports/staff`, 'スタッフ別の売上'],
    [`/salons/${SALON_ID}/reports/categories`, '区分別の売上'],
  ].map(([href = '', label = '']) => ({
    href,
    label,
    current: href === current,
  }))

describe('navigationFor', () => {
  it('should lead an administrator to the choice of a salon and to the screens of the sales of the salon chosen', () => {
    // Act
    const items = navigationFor('admin', reportsHrefOf(SALON_ID))

    // Assert
    expect(items).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: false },
      ...salesOf(reportsHrefOf(SALON_ID)),
    ])
  })

  it.each<[string, string]>([
    [reportsHrefOf(SALON_ID), reportsHrefOf(SALON_ID)],
    [trendsHrefOf(SALON_ID), trendsHrefOf(SALON_ID)],
    [dailyHrefOf(SALON_ID), dailyHrefOf(SALON_ID)],
    [staffSalesHrefOf(SALON_ID), staffSalesHrefOf(SALON_ID)],
    [categorySalesHrefOf(SALON_ID), categorySalesHrefOf(SALON_ID)],
    [`${dailyHrefOf(SALON_ID)}/x`, dailyHrefOf(SALON_ID)],
    [`/salons/${SALON_ID}/elsewhere`, ''],
    // An address that only begins with the same letters is no screen below
    [`${trendsHrefOf(SALON_ID)}x`, ''],
    [`${dailyHrefOf(SALON_ID)}x`, ''],
    [`${staffSalesHrefOf(SALON_ID)}x`, ''],
    [`${categorySalesHrefOf(SALON_ID)}x`, ''],
  ])('should mark the screen of the sales at %s alone', (pathname, current) => {
    // Act, Assert
    expect(navigationFor('owner', pathname)).toEqual(salesOf(current))
  })

  it('should mark the choice of a salon as the screen an administrator is on', () => {
    // Act, Assert
    expect(navigationFor('admin', '/')).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: true },
    ])
  })

  it.each<ModelsUserResponse['role']>(['owner', 'manager'])(
    'should lead the %s to the report of their salon, and back to it through the start from elsewhere',
    (role) => {
      // Act, Assert
      expect(navigationFor(role, reportsHrefOf(SALON_ID))).toEqual(
        salesOf(reportsHrefOf(SALON_ID)),
      )
      expect(navigationFor(role, '/account/security')).toEqual([
        { href: '/', label: '売上レポート', current: false },
      ])
    },
  )

  it('should lead nobody who is not signed in anywhere', () => {
    // Act, Assert
    expect(navigationFor(undefined, '/')).toEqual([])
  })
})
