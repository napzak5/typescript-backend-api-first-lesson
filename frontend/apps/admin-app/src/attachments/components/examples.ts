import { salon } from '../../bookings/components/examples'
import type { UploadedAttachment } from '../api/attachments-api'

/*
 * The files of the salon of the examples, as the API answers with them, and
 * the accounts that uploaded them.
 */

/** The account of the examples that is signed in */
export const ACCOUNT_ID = '9c4e1a7b-3d5f-4b8a-9e2c-6f1d3a5b7c90'

/** The account of a member of the staff, whom the ledger names 「佐藤 美咲」 */
export const MISAKI_ACCOUNT_ID = '1d5f2b8c-4e6a-4c9b-8f3d-7a2e4b6c8d01'

/** The members of the ledger the examples name, by their accounts */
export const LEDGER = [{ userId: MISAKI_ACCOUNT_ID, displayName: '佐藤 美咲' }]

/** A photo before a treatment, which the account uploaded */
export const photo: UploadedAttachment = {
  id: '2b6e3c9d-5f7a-4d0b-9a4e-8b3f5c7d9e12',
  salonId: salon.id,
  filename: '施術前.jpg',
  contentType: 'image/jpeg',
  size: 1_258_291,
  status: 'uploaded',
  uploadedBy: ACCOUNT_ID,
  uploadExpiresAt: '2026-11-20T01:15:00.000Z',
  uploadedAt: '2026-11-20T01:01:30.000Z',
  createdAt: '2026-11-20T01:00:00.000Z',
  updatedAt: '2026-11-20T01:01:30.000Z',
}

/** A form a customer signed, which a member of the staff uploaded */
export const consentForm: UploadedAttachment = {
  ...photo,
  id: '3c7f4d0e-6a8b-4e1c-8b5f-9c4a6d8e0f23',
  filename: 'カラー同意書_田中様.pdf',
  contentType: 'application/pdf',
  size: 348_160,
  uploadedBy: MISAKI_ACCOUNT_ID,
  uploadExpiresAt: '2026-11-21T00:45:00.000Z',
  uploadedAt: '2026-11-21T00:31:10.000Z',
  createdAt: '2026-11-21T00:30:00.000Z',
  updatedAt: '2026-11-21T00:31:10.000Z',
}

/** A small image an administrator uploaded */
const logo: UploadedAttachment = {
  ...photo,
  id: '4d8a5e1f-7b9c-4f2d-9c6a-0d5b7e9f1a34',
  filename: 'logo.png',
  contentType: 'image/png',
  size: 912,
  uploadedBy: '5e9b6f2a-8c0d-4a3e-8d7b-1e6c8f0a2b45',
  uploadExpiresAt: '2026-11-19T06:15:00.000Z',
  uploadedAt: '2026-11-19T06:00:40.000Z',
  createdAt: '2026-11-19T06:00:00.000Z',
  updatedAt: '2026-11-19T06:00:40.000Z',
}

/** The files of the salon, the latest uploaded first */
export const FILES_OF_THE_SALON: readonly UploadedAttachment[] = [
  consentForm,
  photo,
  logo,
]
