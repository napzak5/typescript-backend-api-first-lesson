import { type DomainError, DomainErrors } from '../../../shared'

/**
 * The salon a query or a request names in its properties is not there.
 * It is an error of the request, as any of its properties that names
 * nothing is: the route itself is there.
 */
export const salonNotFound = (message: string): DomainError =>
  DomainErrors.validation(message, [
    { field: 'salonId', rule: 'not_found', message: 'Must name a salon' },
  ])

/**
 * The cursor of a list of stock rows names a row the list does not reach,
 * so the list cannot tell where the page begins. It is an error of the
 * request.
 */
export const cursorNotFound = (message: string): DomainError =>
  DomainErrors.validation(message, [
    {
      field: 'cursor',
      rule: 'not_found',
      message: 'Must name a stock row of the list',
    },
  ])
