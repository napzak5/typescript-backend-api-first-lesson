import { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'
import { CustomerPreferencesReadMapper } from '../../../mappers/read/customer-preferences.mapper'
import type { CustomerId } from '../../../models/customer'
import type { ApiCustomerPreferencesResponse } from '../../../models/customer-preferences'
import type { ICustomerPreferencesRepository } from '../../../repositories/customer-preferences.repository'
import { customerPreferencesUpdateRequestSchema } from '../../../schemas/customer-preferences.schema'
import { type DomainError, DomainErrors, parseWith } from '../../../shared'
import { toRefusalError } from './refusals'
import { customerPreferencesRuleIssues } from './rules'

/**
 * Reading and changing the preferences of one customer, once it is decided
 * that the actor may and whose they are. The ledger and the customer's own
 * routes differ in that decision and in what they call a customer that is
 * not there (`customerNotFound`); the rest is the same.
 */

const MESSAGE = 'Invalid customer preferences update'

export const readPreferencesOf = async (
  repository: ICustomerPreferencesRepository,
  customerId: CustomerId,
  customerNotFound: () => DomainError,
): Promise<Result<ApiCustomerPreferencesResponse, DomainError>> => {
  const found = await repository.findByCustomerId(customerId)
  if (found.type === 'error') {
    return found
  }

  return match(found.data)
    .returnType<Result<ApiCustomerPreferencesResponse, DomainError>>()
    .with({ type: 'found' }, ({ preferences }) =>
      CustomerPreferencesReadMapper.toApiPreferences(customerId, preferences),
    )
    .with({ type: 'customerNotFound' }, () => Result.error(customerNotFound()))
    .exhaustive()
}

/**
 * Changes the properties present in the request and leaves the others as
 * they are. A request that names both the preferred staff member and the
 * avoided ones is held to the rule that ties them before anything is looked
 * up; the repository holds the preferences as they are afterwards to it.
 */
export const changePreferencesOf = async (
  repository: ICustomerPreferencesRepository,
  customerId: CustomerId,
  input: unknown,
  customerNotFound: () => DomainError,
): Promise<Result<ApiCustomerPreferencesResponse, DomainError>> => {
  const request = parseWith(
    customerPreferencesUpdateRequestSchema,
    input,
    MESSAGE,
  )
  if (request.type === 'error') {
    return request
  }
  const { preferredStaffId, avoidStaffIds } = request.data
  if (preferredStaffId !== undefined && avoidStaffIds !== undefined) {
    const issues = customerPreferencesRuleIssues({
      preferredStaffId,
      avoidStaffIds,
    })
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }
  }

  const updated = await repository.update(customerId, request.data)
  if (updated.type === 'error') {
    return updated
  }

  return match(updated.data)
    .returnType<Result<ApiCustomerPreferencesResponse, DomainError>>()
    .with({ type: 'updated' }, ({ preferences }) =>
      CustomerPreferencesReadMapper.toApiPreferences(customerId, preferences),
    )
    .with({ type: P.not('updated') }, (refusal) =>
      Result.error(
        toRefusalError(refusal, request.data, MESSAGE, customerNotFound),
      ),
    )
    .exhaustive()
}
