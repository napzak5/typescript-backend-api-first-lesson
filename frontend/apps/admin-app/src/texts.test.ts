import { itShouldWriteItsTextsAsMessages } from '@beauty-salon-frontend/testing/language'
import { describe } from 'vitest'

describe('the texts of the parts of the admin application that are done', () => {
  itShouldWriteItsTextsAsMessages(import.meta.dirname, [
    'App.tsx',
    'main.tsx',
    'navigation.ts',
    'bookings',
    'charts',
    'customers',
    'inventory',
    'menu',
    'own-profile',
    'payment-methods',
    'products',
    'purchase-orders',
    'review-reports',
    'reviews',
    'sales',
    'salons',
    'settings',
    'shifts',
    'staff',
    'treatments',
  ])
})
