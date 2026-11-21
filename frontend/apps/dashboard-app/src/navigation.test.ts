import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { navigationFor, reportsHrefOf, salonIdIn } from './navigation'

const SALON_ID = '3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60'

describe('salonIdIn', () => {
  it.each<[string, string | undefined]>([
    [`/salons/${SALON_ID}/reports`, SALON_ID],
    [`/salons/${SALON_ID}`, SALON_ID],
    ['/', undefined],
    ['/account/security', undefined],
  ])('should read the salon of %s', (pathname, salonId) => {
    // Act, Assert
    expect(salonIdIn(pathname)).toBe(salonId)
  })
})

describe('navigationFor', () => {
  it('should lead an administrator to the choice of a salon and to the report of the salon chosen', () => {
    // Act
    const items = navigationFor('admin', reportsHrefOf(SALON_ID))

    // Assert
    expect(items).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: false },
      {
        href: `/salons/${SALON_ID}/reports`,
        label: '売上レポート',
        current: true,
      },
    ])
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
      expect(navigationFor(role, reportsHrefOf(SALON_ID))).toEqual([
        {
          href: `/salons/${SALON_ID}/reports`,
          label: '売上レポート',
          current: true,
        },
      ])
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
