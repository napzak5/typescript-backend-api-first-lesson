import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { StaffAccountUseCaseDependencies } from '../business-logic/staff-account'
import type {
  ApiStaffAccountResponse,
  DbStaffAccount,
} from '../models/staff-account'
import type { ISalonRepository } from '../repositories/salon.repository'
import type {
  FoundStaffAccount,
  IStaffAccountRepository,
  StaffAccountChanges,
  UnlinkedStaffAccount,
  UpdatedStaffAccount,
} from '../repositories/staff-account.repository'
import { salonRepositoryWith } from './fixtures'

export const ACCOUNT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2001'

/**
 * The columns of a row of `users` that the salon is shown, as the driver
 * returns them: the account of a staff member that signed in two days ago.
 */
export const dbStaffAccount = (
  overrides: Partial<DbStaffAccount> = {},
): DbStaffAccount => ({
  id: ACCOUNT_ID,
  email: 'hanako@aoyama.example.com',
  role: 'staff',
  status: 'active',
  twoFactorStatus: 'disabled',
  lastLoginAt: '2026-11-13 21:15:00+09',
  createdAt: '2026-11-01 10:00:00+09',
  updatedAt: '2026-11-13 12:15:00.5+00',
  ...overrides,
})

/** The row above as the API returns it. */
export const apiStaffAccount = (
  overrides: Partial<ApiStaffAccountResponse> = {},
): ApiStaffAccountResponse => ({
  id: ACCOUNT_ID,
  email: 'hanako@aoyama.example.com',
  role: 'staff',
  status: 'active',
  twoFactorStatus: 'disabled',
  lastLoginAt: '2026-11-13T12:15:00.000Z',
  createdAt: '2026-11-01T01:00:00.000Z',
  updatedAt: '2026-11-13T12:15:00.500Z',
  ...overrides,
})

/**
 * A repository in which the staff member has the account above and every
 * call does what it is asked: an update returns the account with what was
 * changed. A test overrides what it needs.
 */
const staffAccountRepositoryWith = (
  overrides: Partial<IStaffAccountRepository> = {},
): IStaffAccountRepository => ({
  findByStaff: vi.fn(async () =>
    Result.success<FoundStaffAccount>({
      type: 'found',
      account: dbStaffAccount(),
    }),
  ),
  update: vi.fn(
    async (_salonId: string, _staffId: string, changes: StaffAccountChanges) =>
      Result.success<UpdatedStaffAccount>({
        type: 'updated',
        account: dbStaffAccount(changes),
      }),
  ),
  unlink: vi.fn(async () =>
    Result.success<UnlinkedStaffAccount>({ type: 'unlinked' }),
  ),
  ...overrides,
})

/**
 * Everything the use cases of the accounts of staff members need: the
 * repository above and a salon repository in which the salon exists.
 */
export const staffAccountDependencies = (
  accounts: Partial<IStaffAccountRepository> = {},
  salons: Partial<ISalonRepository> = {},
): StaffAccountUseCaseDependencies => ({
  staffAccountRepository: staffAccountRepositoryWith(accounts),
  salonRepository: salonRepositoryWith(salons),
})
