import type {
  ModelsStaffAccountResponse,
  ModelsStaffInvitationResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { aStaffMember } from '../../staff/components/examples'

/*
 * Accounts and invitations for the stories: those of the member of the
 * staff examples.
 */

/** When the stories are looked at: a day after the invitation was mailed */
export const NOW = new Date('2026-11-20T03:00:00Z')

/** The account of the member of the examples, as a stylist who signs in with two factors. */
export const anAccount = (
  changes: Partial<ModelsStaffAccountResponse> = {},
): ModelsStaffAccountResponse => ({
  id: '4a2e6c8b-1d3f-4e5a-8b7c-9d0e1f2a3b51',
  email: 'misaki.tanaka@example.com',
  role: 'staff',
  status: 'active',
  twoFactorStatus: 'enabled',
  lastLoginAt: '2026-11-19T23:45:00Z',
  createdAt: '2026-04-01T00:30:00Z',
  updatedAt: '2026-11-19T23:45:00Z',
  ...changes,
})

/** The member of the examples before an account was linked to them. */
export const anInvitedMember = (
  changes: Partial<ModelsStaffResponse> = {},
): ModelsStaffResponse => aStaffMember({ userId: null, ...changes })

/** An invitation of the member of the examples, mailed yesterday and not taken yet. */
export const anInvitation = (
  changes: Partial<ModelsStaffInvitationResponse> = {},
): ModelsStaffInvitationResponse => ({
  id: '9b1d3f5a-7c2e-4d6b-8a0f-2e4c6a8b0d13',
  staffId: anInvitedMember().id,
  email: 'misaki.tanaka@example.com',
  role: 'staff',
  expiresAt: '2026-11-26T01:00:00Z',
  createdAt: '2026-11-19T01:00:00Z',
  ...changes,
})
