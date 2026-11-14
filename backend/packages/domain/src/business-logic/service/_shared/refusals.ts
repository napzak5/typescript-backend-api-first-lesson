import { match } from 'ts-pattern'
import type { ServiceChangeRefusal } from '../../../repositories/service.repository'
import {
  type DomainError,
  DomainErrors,
  type ValidationIssue,
} from '../../../shared'

/** `packageServiceIds` names the service that is to become the package. */
export const packageContainsItself: ValidationIssue = {
  field: 'packageServiceIds',
  rule: 'circular',
  message: 'Must not name the service itself',
}

/**
 * A validation error for a service; `within` is the property of the request
 * that holds the properties of the service, when the request is not the
 * service itself.
 */
export const invalidService = (
  message: string,
  issues: ValidationIssue[],
  within: string | null = null,
): DomainError =>
  DomainErrors.validation(
    message,
    within === null
      ? issues
      : issues.map((issue) => ({
          ...issue,
          field: `${within}.${issue.field}`,
        })),
  )

/** Why the stored services refuse a write, as the error a client gets. */
export const toRefusalError = (
  refusal: ServiceChangeRefusal,
  message: string,
  within: string | null = null,
): DomainError =>
  match(refusal)
    .with({ type: 'notFound' }, ({ id }) =>
      DomainErrors.notFound('Service', id),
    )
    .with({ type: 'invalid' }, ({ issues }) =>
      invalidService(message, issues, within),
    )
    .with({ type: 'categoryNotFound' }, () =>
      invalidService(
        message,
        [
          {
            field: 'categoryId',
            rule: 'not_found',
            message: 'Must be a category of the same salon',
          },
        ],
        within,
      ),
    )
    .with({ type: 'packageMemberNotFound' }, () =>
      invalidService(
        message,
        [
          {
            field: 'packageServiceIds',
            rule: 'not_found',
            message: 'Must name services of the same salon',
          },
        ],
        within,
      ),
    )
    .with({ type: 'packageMemberIsPackage' }, () =>
      invalidService(
        message,
        [
          {
            field: 'packageServiceIds',
            rule: 'nested_package',
            message: 'Must not name a package',
          },
        ],
        within,
      ),
    )
    .with({ type: 'containedInPackage' }, () =>
      invalidService(
        message,
        [
          {
            field: 'isPackage',
            rule: 'contained_in_package',
            message: 'A service that a package contains cannot be a package',
          },
        ],
        within,
      ),
    )
    .exhaustive()
