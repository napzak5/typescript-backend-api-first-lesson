import { itShouldWriteItsTextsAsMessages } from '@beauty-salon-frontend/testing/language'
import { describe } from 'vitest'

describe('the texts of the parts of the admin application that are done', () => {
  itShouldWriteItsTextsAsMessages(import.meta.dirname, [
    'App.tsx',
    'main.tsx',
    'navigation.ts',
    'bookings',
    'customers',
    'inventory',
    'menu',
    'payment-methods',
    'products',
    'purchase-orders',
    'sales',
    'settings',
    'treatments',
  ])
})
