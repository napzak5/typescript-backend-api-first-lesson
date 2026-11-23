import { Result } from '@beauty-salon-backend/utility'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { CustomerReadMapper } from '../../mappers/read/customer.mapper'
import { CustomerWriteMapper } from '../../mappers/write/customer.mapper'
import type { Actor } from '../../models/auth'
import { customerExportRequestSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayDeleteCustomers } from './_shared/authorization'
import type { CustomerUseCaseDependencies } from './_shared/dependencies'
import {
  type CustomerFile,
  customersFileOf,
  MOST_EXPORTED,
} from './_shared/export'

const MESSAGE = customerMessages.invalidCustomerExport

export class ExportCustomersUseCase {
  constructor(private readonly dependencies: CustomerUseCaseDependencies) {}

  /**
   * The customers who match the filters of the list, as a CSV file in the
   * order of the list. The whole ledger in one file is for those who may
   * delete a customer, and that is decided before the query is looked at,
   * which arrives as the caller decoded it. More customers than one file
   * may hold is a conflict that tells how many matched, so that the
   * filters can be narrowed.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<CustomerFile, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(customerExportRequestSchema, query.data, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const exported = await this.dependencies.customerRepository.exportMatching(
      CustomerWriteMapper.fromExportRequest(request.data),
      MOST_EXPORTED,
    )
    if (exported.type === 'error') {
      return exported
    }

    return match(exported.data)
      .returnType<Result<CustomerFile, DomainError>>()
      .with({ type: 'exported' }, ({ customers }) =>
        Result.map(CustomerReadMapper.toApiCustomers(customers), (listed) =>
          customersFileOf(listed, this.dependencies.clock().toISOString()),
        ),
      )
      .with({ type: 'tooMany' }, ({ matching }) =>
        Result.error(
          DomainErrors.conflict(
            customerMessages.tooManyToExport(matching, MOST_EXPORTED),
          ),
        ),
      )
      .exhaustive()
  }
}
