import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { PointReadMapper } from '../../mappers/read/point.mapper'
import type { Actor } from '../../models/auth'
import { parseCustomerId } from '../../models/customer'
import type { ApiPointTransactionResponse } from '../../models/point'
import type { ApiPaginationMeta } from '../../models/salon'
import { pointTransactionSearchRequestSchema } from '../../schemas/point.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { pointReachOf } from './_shared/authorization'
import type { PointUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid point transaction search'

export type PointTransactionPage = {
  data: ApiPointTransactionResponse[]
  meta: ApiPaginationMeta
}

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
  ): Promise<Result<PointTransactionPage, DomainError>> {
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
    const { cursor, startDate, endDate } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.pointRepository.list({
      customerId: id.data,
      limit,
      after: cursor ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<PointTransactionPage, DomainError>>()
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', id.data)),
      )
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: 'Must name a point transaction of the customer',
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, ({ transactions, total, hasMore }) =>
        Result.map(
          PointReadMapper.toApiPointTransactions(transactions),
          (data) => ({
            data,
            meta: {
              total,
              limit,
              hasMore,
              cursor: cursor ?? null,
              nextCursor: hasMore ? (transactions.at(-1)?.id ?? null) : null,
              // Pages are only walked forwards.
              prevCursor: null,
            },
          }),
        ),
      )
      .exhaustive()
  }
}
