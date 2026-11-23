import { itShouldWriteItsTextsAsMessages } from '@beauty-salon-frontend/testing/language'
import { describe } from 'vitest'

describe('the texts of the areas of the portal that are done', () => {
  itShouldWriteItsTextsAsMessages(import.meta.dirname, [
    'account',
    'bookings',
    'navigation.ts',
    'salons',
    'security',
    'session',
  ])
})
