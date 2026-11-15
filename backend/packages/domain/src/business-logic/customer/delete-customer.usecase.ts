import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { type CustomerId, parseCustomerId } from '../../models/customer'
import { type DomainError, DomainErrors } from '../../shared'
import { unfinishedBookingsReferTo } from '../_shared/unfinished-bookings'
import { mayDeleteCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'

export class DeleteCustomerUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * Marks the customer as deleted; the row is kept. Whether the actor may
   * is decided before the ID is read. A customer who has a booking that is
   * not finished, in whatever salon, stays. Resolves to the ID of the
   * deleted customer.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<CustomerId, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const customerId = parseCustomerId(id)
    if (customerId.type === 'error') {
      return customerId
    }

    const deleted = await this.dependencies.customerRepository.delete(
      customerId.data,
    )
    if (deleted.type === 'error') {
      return deleted
    }

    return match(deleted.data)
      .returnType<Result<CustomerId, DomainError>>()
      .with({ type: 'deleted' }, () => customerId)
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', customerId.data)),
      )
      .with({ type: 'bookingsUnfinished' }, () =>
        Result.error(unfinishedBookingsReferTo('customer')),
      )
      .exhaustive()
  }
}
