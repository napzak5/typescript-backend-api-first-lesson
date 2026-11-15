import { SalonRoleTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import type { ApiStaffInvitationCreateRequest } from '../models/staff-invitation'

/**
 * Validation of the request that invites a staff member. The shape is
 * checked against the generated API type. Whoever accepts an invitation
 * sends an authentication request; those are in `auth.schema.ts`.
 */
export const staffInvitationCreateRequestSchema = z.strictObject({
  role: SalonRoleTypeSchema,
}) satisfies z.ZodType<ApiStaffInvitationCreateRequest>
