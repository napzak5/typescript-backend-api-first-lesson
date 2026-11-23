import { Result } from '@beauty-salon-backend/utility'
import { pointMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { PointReadMapper } from '../../mappers/read/point.mapper'
import { PointWriteMapper } from '../../mappers/write/point.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiPage } from '../../models/page'
import type { ApiPointTransactionResponse } from '../../models/point'
import { pointTransactionSearchRequestSchema } from '../../schemas/point.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { pointReachOf } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = pointMessages.invalidPointTransactionSearch

export class ListPointTransactionsUseCase {
  constructor(private readonly dependencies: PointUseCaseDependencies) {}

  /**
   * Lists the point transactions of a customer by the time they were
   * written, latest first. The cursor of a page is the ID of its last
   * transaction, and one that names no transaction of the customer is
   * refused.
   *
   * Whether the actor keeps the points ledger is decided before the
   * request is looked at, which is why the query arrives as the caller
   * decoded it.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiPointTransactionResponse>, DomainError>> {
    if (pointReachOf(actor) === null) {
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
      pointTransactionSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const criteria = PointWriteMapper.fromTransactionSearchRequest(
      request.data,
      id.data,
    )

    const listed = await this.dependencies.pointRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<ApiPage<ApiPointTransactionResponse>, DomainError>>()
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', id.data)),
      )
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: pointMessages.aPointTransactionOfCustomer,
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, (list) =>
        PointReadMapper.toApiPointTransactionPage(list, criteria),
      )
      .exhaustive()
  }
}
