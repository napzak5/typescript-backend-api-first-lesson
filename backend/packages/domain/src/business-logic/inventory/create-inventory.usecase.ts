import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { InventoryReadMapper } from '../../mappers/read/inventory.mapper'
import { InventoryWriteMapper } from '../../mappers/write/inventory.mapper'
import type { Actor } from '../../models/auth'
import type { ApiInventoryResponse } from '../../models/inventory'
import { inventoryCreateRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { inventoryKeeperReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'
import { salonNotFound } from './_shared/refusals'

const MESSAGE = 'Invalid stock row'

export class CreateInventoryUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Adds a stock row for a lot of a product of a salon, or for a product not
   * kept by lots. The row has no stock: what comes in is recorded as a stock
   * movement.
   *
   * Whether the actor keeps stock is decided before the request is read,
   * and whether they keep that of the salon of the request before the salon
   * is looked up: a salon that is not there is one that a member of another
   * salon does not keep either.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiInventoryResponse, DomainError>> {
    const reach = inventoryKeeperReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(inventoryCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    if (!isWithin(reach, request.data.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const { inventoryRepository, salonRepository } = this.dependencies
    const salonExists = await salonRepository.exists(request.data.salonId)
    if (salonExists.type === 'error') {
      return salonExists
    }
    if (!salonExists.data) {
      return Result.error(salonNotFound(MESSAGE))
    }

    const created = await inventoryRepository.create(
      InventoryWriteMapper.fromCreateRequest(request.data),
    )
    if (created.type === 'error') {
      return created
    }

    return match(created.data)
      .returnType<Result<ApiInventoryResponse, DomainError>>()
      .with({ type: 'created' }, ({ row }) =>
        InventoryReadMapper.toApiInventory(row),
      )
      .with({ type: 'productNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'productId',
              rule: 'not_found',
              message: 'Must name a product of the salon',
            },
          ]),
        ),
      )
      .with({ type: 'lotNumberRefused' }, ({ message }) =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            { field: 'lotNumber', rule: 'custom', message },
          ]),
        ),
      )
      .exhaustive()
  }
}
