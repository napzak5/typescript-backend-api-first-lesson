import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerVersionReadMapper } from '../../mappers/read/customer-version.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiCustomerHistoryEntryResponse } from '../../models/customer-version'
import type { ApiPaginationMeta } from '../../models/page'
import { customerVersionSearchRequestSchema } from '../../schemas/customer-version.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayDeleteCustomers } from '../customer/_shared/authorization'
import type { CustomerVersionUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid customer history search'

const DEFAULT_LIMIT = 20

export type CustomerHistoryPage = {
  data: ApiCustomerHistoryEntryResponse[]
  meta: ApiPaginationMeta
}

export class GetCustomerHistoryUseCase {
  constructor(
    private readonly dependencies: CustomerVersionUseCaseDependencies,
  ) {}

  /**
   * Lists the versions of a customer, newest first, each with what changed
   * from the version before it. The history is read by those who may delete
   * a customer, and it is read of a deleted customer too. The cursor of a
   * page is the ID of its last version, and one that names no version of
   * the customer is refused.
   *
   * Whether the actor reads the history is decided before the request is
   * looked at, which is why the query arrives as the caller decoded it.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<CustomerHistoryPage, DomainError>> {
    if (!mayDeleteCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const id = parseCustomerId(customerId)
    if (id.type === 'error') {
      return id
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      customerVersionSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { cursor } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.customerVersionRepository.list({
      customerId: id.data,
      limit,
      after: cursor ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<CustomerHistoryPage, DomainError>>()
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', id.data)),
      )
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: 'Must name a version of the customer',
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, ({ versions, total, hasMore }) =>
        Result.map(
          CustomerVersionReadMapper.toApiHistory(versions),
          (data) => ({
            data,
            meta: {
              total,
              limit,
              hasMore,
              cursor: cursor ?? null,
              nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
              // Pages are only walked forwards.
              prevCursor: null,
            },
          }),
        ),
      )
      .exhaustive()
  }
}
