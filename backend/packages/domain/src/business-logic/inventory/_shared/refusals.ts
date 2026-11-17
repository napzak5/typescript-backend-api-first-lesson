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
