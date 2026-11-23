import { itShouldWriteItsTextsAsMessages } from '@beauty-salon-frontend/testing/language'
import { describe } from 'vitest'

describe('the texts of the parts of the admin application that are done', () => {
  itShouldWriteItsTextsAsMessages(import.meta.dirname, [
    'App.tsx',
    'main.tsx',
    'navigation.ts',
    'customers/api',
    'customers/components/customer-choices',
    'customers/components/customer-filter',
    'customers/components/customer-form',
    'customers/components/customer-history',
    'customers/components/customer-keeping',
    'customers/components/customer-record',
    'customers/components/customer-statistics',
    'customers/components/customer-table',
    'customers/components/referrer-dialog',
    'customers/components/referrer-field',
    'customers/components/removed-record',
    'customers/components/version-record',
    'customers/screens/customer-change-screen.tsx',
    'customers/screens/customer-entry-screen.tsx',
    'customers/screens/customer-history-screen.tsx',
    'customers/screens/customer-ledger-screen.tsx',
    'customers/screens/customer-preferences-screen.tsx',
    'customers/screens/customer-screen.tsx',
    'customers/screens/customer-version-screen.tsx',
    'customers/screens/found-customers.tsx',
    'customers/screens/referrer-choice.tsx',
    'customers/screens/removed-customer.tsx',
    'customers/screens/with-customer.tsx',
    'customers/utils/customer-form.ts',
    'customers/utils/customer-format.ts',
    'customers/utils/customer-history.ts',
    'customers/utils/customer-ledger.ts',
  ])
})
