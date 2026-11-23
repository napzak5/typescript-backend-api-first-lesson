import { Result } from '@beauty-salon-backend/utility'
import { paymentMethodMessages } from '@beauty-salon-shared/i18n/messages/api'
import { PaymentMethodReadMapper } from '../../mappers/read/payment-method.mapper'
import { PaymentMethodWriteMapper } from '../../mappers/write/payment-method.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPage } from '../../models/page'
import type { ApiPaymentMethodResponse } from '../../models/payment-method'
import { parseSalonIdOfPath } from '../../models/salon'
import { paymentMethodSearchRequestSchema } from '../../schemas/payment-method.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayReadPaymentMethods } from './_shared/authorization'
import type { PaymentMethodUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = paymentMethodMessages.invalidPaymentMethodSearch

export class ListPaymentMethodsUseCase {
  constructor(
    private readonly dependencies: PaymentMethodUseCaseDependencies,
  ) {}

  /**
   * Lists the payment methods of a salon in the order in which a till
   * shows them, the ones that are not active among them unless the request
   * filters. The cursor of a page is the ID of its last payment method. One
   * that was deleted since is gone, and a cursor that names it is refused:
   * the list has to be read from the start again.
   *
   * Whether the actor may is decided from the salon in the path alone,
   * before the query is looked at. That is why the query arrives as the
   * caller decoded it: a query that could not be decoded is an error of the
   * request, and an actor who may not read the payment methods is told that
   * and nothing about the request.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiPaymentMethodResponse>, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayReadPaymentMethods(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(
      paymentMethodSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const criteria = PaymentMethodWriteMapper.fromSearchRequest(
      request.data,
      salonId.data,
    )

    const { paymentMethodRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const listed = await paymentMethodRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a payment method of the salon',
          },
        ]),
      )
    }

    return PaymentMethodReadMapper.toApiPaymentMethodPage(listed.data, criteria)
  }
}
