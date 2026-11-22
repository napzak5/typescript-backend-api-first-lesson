import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { CustomerDeletionRequestUseCaseDependencies } from '../../business-logic/customer-deletion-request'
import type {
  ApiCustomerDeletionRequestResponse,
  DbCustomerDeletionRequest,
} from '../../models/customer-deletion-request'
import type {
  CustomerDeletionRequestCancelling,
  CustomerDeletionRequesting,
  CustomerDeletionRequestReading,
  CustomerErasure,
  ICustomerDeletionRequestRepository,
} from '../../repositories/customer-deletion-request.repository'
import { CUSTOMER_ID, USER_ID } from './auth-fixtures'

export const CUSTOMER_DELETION_REQUEST_ID =
  '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6f01'
export const OTHER_CUSTOMER_DELETION_REQUEST_ID =
  '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6f02'

/** A row of `customer_deletion_requests` as the driver returns it: pending. */
export const dbCustomerDeletionRequest = (
  overrides: Partial<DbCustomerDeletionRequest> = {},
): DbCustomerDeletionRequest => ({
  id: CUSTOMER_DELETION_REQUEST_ID,
  customerId: CUSTOMER_ID,
  reason: '退会したため、本人から電話で依頼',
  status: 'pending',
  requestedBy: USER_ID,
  requestedAt: '2026-11-18 11:00:00.654321+09',
  scheduledAt: '2026-12-02 11:00:00.654321+09',
  cancelledBy: null,
  cancelledAt: null,
  completedBy: null,
  completedAt: null,
  ...overrides,
})

/** The row of `dbCustomerDeletionRequest()` as the API presents it. */
export const apiCustomerDeletionRequest = (
  overrides: Partial<ApiCustomerDeletionRequestResponse> = {},
): ApiCustomerDeletionRequestResponse => ({
  id: CUSTOMER_DELETION_REQUEST_ID,
  customerId: CUSTOMER_ID,
  reason: '退会したため、本人から電話で依頼',
  status: 'pending',
  requestedBy: USER_ID,
  requestedAt: '2026-11-18T02:00:00.654Z',
  scheduledAt: '2026-12-02T02:00:00.654Z',
  cancelledBy: null,
  cancelledAt: null,
  completedBy: null,
  completedAt: null,
  ...overrides,
})

/**
 * A repository of a customer with the pending request above, in which every
 * write succeeds and nothing is due; a test overrides what it needs.
 */
const customerDeletionRequestRepositoryWith = (
  overrides: Partial<ICustomerDeletionRequestRepository> = {},
): ICustomerDeletionRequestRepository => ({
  request: vi.fn(async () =>
    Result.success<CustomerDeletionRequesting>({
      type: 'requested',
      request: dbCustomerDeletionRequest(),
    }),
  ),
  latestOf: vi.fn(async () =>
    Result.success<CustomerDeletionRequestReading>({
      type: 'found',
      request: dbCustomerDeletionRequest(),
    }),
  ),
  cancel: vi.fn(async () =>
    Result.success<CustomerDeletionRequestCancelling>({
      type: 'cancelled',
      request: dbCustomerDeletionRequest({
        status: 'cancelled',
        cancelledBy: USER_ID,
        cancelledAt: '2026-11-19 10:00:00+09',
      }),
    }),
  ),
  dueRequests: vi.fn(async () => Result.success<string[]>([])),
  erase: vi.fn(async () => Result.success<CustomerErasure>({ type: 'notDue' })),
  ...overrides,
})

/** Everything the use cases of the deletion requests need: the repository above. */
export const customerDeletionRequestDependencies = (
  requests: Partial<ICustomerDeletionRequestRepository> = {},
): CustomerDeletionRequestUseCaseDependencies => ({
  customerDeletionRequestRepository:
    customerDeletionRequestRepositoryWith(requests),
})
