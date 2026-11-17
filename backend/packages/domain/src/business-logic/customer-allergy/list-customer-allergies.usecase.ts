import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { CustomerAllergyReadMapper } from '../../mappers/read/customer-allergy.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiCustomerAllergyResponse,
  parseAllergyCustomerId,
} from '../../models/customer-allergy'
import type { ApiPaginationMeta } from '../../models/salon'
import { customerAllergySearchRequestSchema } from '../../schemas/customer-allergy.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { CustomerAllergyUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid customer allergy search'

const DEFAULT_LIMIT = 20

export type CustomerAllergyPage = {
  data: ApiCustomerAllergyResponse[]
  meta: ApiPaginationMeta
}

export class ListCustomerAllergiesUseCase {
  constructor(
    private readonly dependencies: CustomerAllergyUseCaseDependencies,
  ) {}

  /**
   * Lists the allergies of a customer who is there, severest first, then
   * in the order they were recorded. The cursor of a page is the ID of its
   * last allergy, and one that names no allergy of the customer is refused.
   *
   * Whether the actor reads allergies is decided before the request is
   * looked at, which is why the query arrives as the caller decoded it.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<CustomerAllergyPage, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const id = parseAllergyCustomerId(customerId)
    if (id.type === 'error') {
      return id
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      customerAllergySearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { cursor } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.customerAllergyRepository.list({
      customerId: id.data,
      limit,
      after: cursor ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<CustomerAllergyPage, DomainError>>()
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', id.data)),
      )
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: 'Must name an allergy of the customer',
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, ({ allergies, total, hasMore }) =>
        Result.map(
          CustomerAllergyReadMapper.toApiCustomerAllergies(allergies),
          (data) => ({
            data,
            meta: {
              total,
              limit,
              hasMore,
              cursor: cursor ?? null,
              nextCursor: hasMore ? (allergies.at(-1)?.id ?? null) : null,
              // Pages are only walked forwards.
              prevCursor: null,
            },
          }),
        ),
      )
      .exhaustive()
  }
}
