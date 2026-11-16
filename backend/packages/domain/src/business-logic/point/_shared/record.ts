import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { PointReadMapper } from '../../../mappers/read/point.mapper'
import type { LedgerReach } from '../../../models/booking'
import type { ApiPointTransactionResponse } from '../../../models/point'
import { type DomainError, DomainErrors } from '../../../shared'
import { notFound } from '../../booking/_shared/plan'
import type { PointUseCaseDependencies } from './dependencies'
import type { PointMovement } from './plan'
import { toPointRefusalError } from './refusals'

/**
 * Writes a movement that passed the rules of its own, and tells the client
 * what became of it: the point transaction, or why there is none. A
 * customer that is not there is a property of the request that names no
 * customer (400), as a record that is not one of the customer is.
 */
export const recordMovement = async (
  { pointRepository }: PointUseCaseDependencies,
  reach: LedgerReach,
  movement: PointMovement,
  message: string,
): Promise<Result<ApiPointTransactionResponse, DomainError>> => {
  const recorded = await pointRepository.record(reach, movement)
  if (recorded.type === 'error') {
    return recorded
  }

  return match(recorded.data)
    .returnType<Result<ApiPointTransactionResponse, DomainError>>()
    .with({ type: 'recorded' }, ({ transaction }) =>
      PointReadMapper.toApiPointTransaction(transaction),
    )
    .with({ type: 'customerNotFound' }, () =>
      Result.error(
        DomainErrors.validation(message, [
          notFound('customerId', 'a customer'),
        ]),
      ),
    )
    .with({ type: 'invalid' }, ({ issues }) =>
      Result.error(DomainErrors.validation(message, issues)),
    )
    .with(
      { type: 'referenceClosed' },
      { type: 'referenceTaken' },
      { type: 'balanceShort' },
      { type: 'balanceOverLimit' },
      (refusal) => Result.error(toPointRefusalError(refusal)),
    )
    .exhaustive()
}
