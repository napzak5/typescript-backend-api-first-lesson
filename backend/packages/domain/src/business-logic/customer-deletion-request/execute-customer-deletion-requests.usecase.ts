import { Result } from '@beauty-salon-backend/utility'
import { CustomerDeletionRequestReadMapper } from '../../mappers/read/customer-deletion-request.mapper'
import type { Actor } from '../../models/auth'
import type { ApiCustomerDeletionRequestResponse } from '../../models/customer-deletion-request'
import { type DomainError, DomainErrors } from '../../shared'
import { mayEraseCustomers } from './_shared/authorization'
import type { CustomerDeletionRequestUseCaseDependencies } from './_shared/dependencies'

export class ExecuteCustomerDeletionRequestsUseCase {
  constructor(
    private readonly dependencies: CustomerDeletionRequestUseCaseDependencies,
  ) {}

  /**
   * Carries out every pending request that is due, in the order they fell
   * due, each in its own transaction, and returns those it carried out. A
   * request cancelled meanwhile is passed over. At the first error it stops:
   * the requests before it are done, and running it again carries out the
   * rest. Only administrators run it.
   */
  async execute(
    actor: Actor,
  ): Promise<Result<ApiCustomerDeletionRequestResponse[], DomainError>> {
    if (!mayEraseCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const { customerDeletionRequestRepository } = this.dependencies

    const due = await customerDeletionRequestRepository.dueRequests()
    if (due.type === 'error') {
      return due
    }

    const done: ApiCustomerDeletionRequestResponse[] = []
    for (const id of due.data) {
      const erased = await customerDeletionRequestRepository.erase(
        id,
        actor.userId,
      )
      if (erased.type === 'error') {
        return erased
      }
      if (erased.data.type === 'erased') {
        const shown =
          CustomerDeletionRequestReadMapper.toApiCustomerDeletionRequest(
            erased.data.request,
          )
        if (shown.type === 'error') {
          return shown
        }
        done.push(shown.data)
      }
    }
    return Result.success(done)
  }
}
