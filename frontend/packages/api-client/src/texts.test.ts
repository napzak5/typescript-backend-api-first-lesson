import { itShouldWriteItsTextsAsMessages } from '@beauty-salon-frontend/testing/language'
import { describe } from 'vitest'

describe('the texts of the package', () => {
  itShouldWriteItsTextsAsMessages(import.meta.dirname)
})
