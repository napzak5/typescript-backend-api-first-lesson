import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { InventoryAlertReadMapper } from '../../mappers/read/inventory-alert.mapper'
import { InventoryAlertWriteMapper } from '../../mappers/write/inventory-alert.mapper'
import type { Actor } from '../../models/auth'
import type { ApiInventoryAlertResponse } from '../../models/inventory-alert'
import { inventoryAlertAcknowledgeRequestSchema } from '../../schemas/inventory-alert.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import {
  inventoryReachOf,
  performerOf,
} from '../inventory/_shared/authorization'
import { subjectIdOf } from './_shared/alerts'
import type { InventoryAlertUseCaseDependencies } from './_shared/dependencies'
import { unknownTimeZone } from './_shared/refusals'

const MESSAGE = 'Invalid inventory alert acknowledgement'

export class AcknowledgeInventoryAlertUseCase {
  constructor(
    private readonly dependencies: InventoryAlertUseCaseDependencies,
  ) {}

  /**
   * Records that the actor saw to an alert of the stock that is there now:
   * the staff member they are, none for an administrator. Every member of
   * the salon of the product acknowledges its alerts, as every member reads
   * its stock. The acknowledgement keeps what the alert is like now, and
   * holds while that lasts.
   *
   * An alert that its product or stock row does not have now is not found
   * (404), as is one of a product of a salon the actor does not reach or of
   * a stock row of another product; one that an acknowledgement still holds
   * for is a conflict (409).
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiInventoryAlertResponse, DomainError>> {
    const reach = inventoryReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(
      inventoryAlertAcknowledgeRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const acknowledgement = InventoryAlertWriteMapper.fromAcknowledgeRequest(
      request.data,
      performerOf(actor),
    )
    const key = `${acknowledgement.alert}:${subjectIdOf(acknowledgement)}`

    const { inventoryAlertRepository, clock } = this.dependencies
    const acknowledged = await inventoryAlertRepository.acknowledge(
      reach,
      acknowledgement,
      clock(),
    )

    return Result.flatMap(acknowledged, (outcome) =>
      match(outcome)
        .returnType<Result<ApiInventoryAlertResponse, DomainError>>()
        .with({ type: 'acknowledged' }, ({ alert }) =>
          InventoryAlertReadMapper.toApiInventoryAlert(alert),
        )
        .with({ type: 'notFound' }, { type: 'notActive' }, () =>
          Result.error(DomainErrors.notFound('InventoryAlert', key)),
        )
        .with({ type: 'alreadyAcknowledged' }, () =>
          Result.error(
            DomainErrors.conflict(
              `Inventory alert ${key} is acknowledged already: an acknowledgement holds while what it was given for lasts`,
            ),
          ),
        )
        .with({ type: 'unknownTimeZone' }, ({ salonId, timezone }) =>
          Result.error(unknownTimeZone(salonId, timezone)),
        )
        .exhaustive(),
    )
  }
}
