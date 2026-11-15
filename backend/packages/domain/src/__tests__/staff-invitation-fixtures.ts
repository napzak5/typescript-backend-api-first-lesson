import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { StaffInvitationUseCaseDependencies } from '../business-logic/staff-invitation'
import type {
  ApiStaffInvitationResponse,
  DbStaffInvitation,
} from '../models/staff-invitation'
import type { ISalonRepository } from '../repositories/salon.repository'
import type {
  AcceptedStaffInvitation,
  HeldStaffInvitation,
  IStaffInvitationRepository,
  IssuedStaffInvitation,
  RevokedStaffInvitation,
  StaffInvitationIssue,
  UsableStaffInvitation,
} from '../repositories/staff-invitation.repository'
import { authDependencies, NOW, PUBLIC_APP_URL } from './auth-fixtures'
import { salonRepositoryWith } from './fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

export const INVITATION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1001'

/** The address the ledger has for the invited staff member. */
export const INVITED_EMAIL = 'hanako@aoyama.example.com'

/** The name of the salon, as the repository reads it for the mail. */
export const SALON_NAME = 'Hair Studio Aoyama'

/**
 * A row of `staff_invitations` as the driver returns it: an invitation as
 * staff that was issued an hour before `NOW`.
 */
export const dbStaffInvitation = (
  overrides: Partial<DbStaffInvitation> = {},
): DbStaffInvitation => ({
  id: INVITATION_ID,
  staffId: STAFF_MEMBER_ID,
  email: INVITED_EMAIL,
  role: 'staff',
  tokenHash: 'sha256(mailed-token)',
  expiresAt: '2026-11-21 17:00:00+09',
  createdAt: '2026-11-14 08:00:00.123456+00',
  ...overrides,
})

/** The row above as the API returns it. */
export const apiStaffInvitation = (
  overrides: Partial<ApiStaffInvitationResponse> = {},
): ApiStaffInvitationResponse => ({
  id: INVITATION_ID,
  staffId: STAFF_MEMBER_ID,
  email: INVITED_EMAIL,
  role: 'staff',
  expiresAt: '2026-11-21T08:00:00.000Z',
  createdAt: '2026-11-14T08:00:00.123Z',
  ...overrides,
})

/**
 * A repository in which the staff member holds the invitation above and
 * every call does what it is asked: an invitation that is issued is stored
 * as it was stated, with the address above, at `NOW`. A test overrides
 * what it needs.
 */
const staffInvitationRepositoryWith = (
  overrides: Partial<IStaffInvitationRepository> = {},
): IStaffInvitationRepository => ({
  findByStaff: vi.fn(async () =>
    Result.success<HeldStaffInvitation>({
      type: 'held',
      invitation: dbStaffInvitation(),
    }),
  ),
  issue: vi.fn(
    async (_salonId: string, _staffId: string, issue: StaffInvitationIssue) =>
      Result.success<IssuedStaffInvitation>({
        type: 'issued',
        invitation: dbStaffInvitation({
          role: issue.role,
          tokenHash: issue.token.tokenHash,
          expiresAt: issue.token.expiresAt,
          createdAt: NOW.toISOString(),
        }),
        salonName: SALON_NAME,
      }),
  ),
  revoke: vi.fn(async () =>
    Result.success<RevokedStaffInvitation>({ type: 'revoked' }),
  ),
  findUsable: vi.fn(async () =>
    Result.success<UsableStaffInvitation>({
      type: 'usable',
      invitation: dbStaffInvitation(),
    }),
  ),
  accept: vi.fn(async () =>
    Result.success<AcceptedStaffInvitation>({ type: 'accepted' }),
  ),
  ...overrides,
})

/**
 * Everything the use cases of the staff invitations need: the repository
 * above, a salon repository in which the salon exists, the hasher and the
 * token issuer of the authentication tests (`hashed:<password>`,
 * `token-1` with the hash `sha256(token-1)`), a mailer that keeps what it
 * is handed, and the clock at `NOW`.
 */
export const staffInvitationDependencies = (
  invitations: Partial<IStaffInvitationRepository> = {},
  salons: Partial<ISalonRepository> = {},
  overrides: Partial<StaffInvitationUseCaseDependencies> = {},
): StaffInvitationUseCaseDependencies => {
  const { passwordHasher, tokenIssuer } = authDependencies()

  return {
    staffInvitationRepository: staffInvitationRepositoryWith(invitations),
    salonRepository: salonRepositoryWith(salons),
    passwordHasher,
    tokenIssuer,
    mailer: { deliver: vi.fn() },
    publicAppUrl: PUBLIC_APP_URL,
    clock: () => NOW,
    ...overrides,
  }
}
