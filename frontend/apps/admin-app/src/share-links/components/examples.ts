import type { ModelsShareLinkResponse } from '@beauty-salon-frontend/api-client'
import {
  ACCOUNT_ID,
  consentForm,
  MISAKI_ACCOUNT_ID,
} from '../../attachments/components/examples'

/*
 * The share links of the form a customer signed, as the API answers with
 * them, seen at 10:00 in Tokyo on 21 November 2026.
 */

/** The moment the examples are seen at */
export const NOW = new Date('2026-11-21T01:00:00.000Z')

/** The token of a link, as the API gives it once */
export const TOKEN = 'BwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSY'

/** A link for the customer, with a password and a limit, which the account issued */
export const forTheCustomer: ModelsShareLinkResponse = {
  id: '5e9b6f2a-8c0d-4a3e-9d7b-1e6c8f0a2b45',
  attachmentId: consentForm.id,
  expiresAt: '2026-11-28T00:40:00.000Z',
  maxDownloads: 3,
  downloadCount: 1,
  hasPassword: true,
  createdBy: ACCOUNT_ID,
  createdAt: '2026-11-21T00:40:00.000Z',
  updatedAt: '2026-11-21T00:52:00.000Z',
}

/** A link that gave its file as often as it may */
export const usedUp: ModelsShareLinkResponse = {
  ...forTheCustomer,
  id: '6f0c7a3b-9d1e-4b4f-8e8c-2f7d9a1b3c56',
  expiresAt: '2026-11-24T02:00:00.000Z',
  maxDownloads: 1,
  downloadCount: 1,
  hasPassword: false,
  createdAt: '2026-11-20T02:00:00.000Z',
  updatedAt: '2026-11-20T05:10:00.000Z',
}

/** A link without a limit, which a member of the staff issued, and which ran out */
export const ranOut: ModelsShareLinkResponse = {
  ...forTheCustomer,
  id: '7a1d8b4c-0e2f-4c5a-9f9d-3a8e0b2c4d67',
  expiresAt: '2026-11-20T00:00:00.000Z',
  maxDownloads: null,
  downloadCount: 4,
  hasPassword: false,
  createdBy: MISAKI_ACCOUNT_ID,
  createdAt: '2026-11-19T00:00:00.000Z',
  updatedAt: '2026-11-19T08:30:00.000Z',
}

/** The links of the form, the latest issued first */
export const SHARE_LINKS_OF_THE_FILE: ModelsShareLinkResponse[] = [
  forTheCustomer,
  usedUp,
  ranOut,
]
