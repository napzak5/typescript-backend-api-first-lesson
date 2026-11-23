import { itShouldWriteItsTextsAsMessages } from '@beauty-salon-frontend/testing/language'
import { describe } from 'vitest'

describe('the texts of the portal', () => {
  itShouldWriteItsTextsAsMessages(import.meta.dirname)
})
