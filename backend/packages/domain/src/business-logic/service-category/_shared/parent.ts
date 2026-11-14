import { type DomainError, DomainErrors } from '../../../shared'

const MESSAGE = 'Invalid service category'

/** `parentId` names no category of the salon the category belongs to. */
export const parentNotFound = (): DomainError =>
  DomainErrors.validation(MESSAGE, [
    {
      field: 'parentId',
      rule: 'not_found',
      message: 'Must be a category of the same salon',
    },
  ])

/** `parentId` names the category itself or one below it. */
export const parentWithinSubtree = (): DomainError =>
  DomainErrors.validation(MESSAGE, [
    {
      field: 'parentId',
      rule: 'circular',
      message: 'Must not be the category itself or one of its subcategories',
    },
  ])
