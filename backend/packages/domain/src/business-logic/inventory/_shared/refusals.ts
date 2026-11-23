import {
  inventoryMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { type DomainError, DomainErrors, type Told } from '../../../shared'

/**
 * The salon a query or a request names in its properties is not there.
 * It is an error of the request, as any of its properties that names
 * nothing is: the route itself is there.
 */
export const salonNotFound = (message: Told): DomainError =>
  DomainErrors.validation(message, [
    { field: 'salonId', rule: 'not_found', message: ruleMessages.aSalon },
  ])

/**
 * The cursor of a list of stock rows names a row the list does not reach,
 * so the list cannot tell where the page begins. It is an error of the
 * request.
 */
export const cursorNotFound = (message: Told): DomainError =>
  DomainErrors.validation(message, [
    {
      field: 'cursor',
      rule: 'not_found',
      message: inventoryMessages.aStockRowOfList,
    },
  ])
