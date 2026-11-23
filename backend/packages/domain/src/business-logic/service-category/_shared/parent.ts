import {
  ruleMessages,
  serviceCategoryMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { type DomainError, DomainErrors } from '../../../shared'

const MESSAGE = serviceCategoryMessages.invalidServiceCategory

/** `parentId` names no category of the salon the category belongs to. */
export const parentNotFound = (): DomainError =>
  DomainErrors.validation(MESSAGE, [
    {
      field: 'parentId',
      rule: 'not_found',
      message: ruleMessages.aCategoryOfSameSalon,
    },
  ])

/** `parentId` names the category itself or one below it. */
export const parentWithinSubtree = (): DomainError =>
  DomainErrors.validation(MESSAGE, [
    {
      field: 'parentId',
      rule: 'circular',
      message: serviceCategoryMessages.notItselfOrSubcategory,
    },
  ])
