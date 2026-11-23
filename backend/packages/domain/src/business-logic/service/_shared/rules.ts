import { serviceMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { DbNewService } from '../../../models/service'
import type { ValidationIssue } from '../../../shared'

/** The fewest services a package combines: one service is not a combination. */
const MIN_PACKAGE_MEMBERS = 2

/** The properties of a service that a rule ties to each other. */
type TiedProperties = Pick<
  DbNewService,
  'price' | 'discountPrice' | 'isPackage' | 'packageServiceIds'
>

/**
 * The rules that tie properties of a service to each other; the issues are
 * empty when the service keeps them all.
 *
 * A create checks its request against them. An update names only some
 * properties, so the service as it will be stored is checked, by whoever
 * holds the stored row.
 */
export const serviceRuleIssues = ({
  price,
  discountPrice,
  isPackage,
  packageServiceIds,
}: TiedProperties): ValidationIssue[] => [
  ...(discountPrice !== null && discountPrice > price
    ? [
        {
          field: 'discountPrice',
          rule: 'too_big',
          message: serviceMessages.notGreaterThanPrice,
        },
      ]
    : []),
  ...(isPackage && packageServiceIds.length < MIN_PACKAGE_MEMBERS
    ? [
        {
          field: 'packageServiceIds',
          rule: 'too_small',
          message: serviceMessages.atLeastPackageMembers(MIN_PACKAGE_MEMBERS),
        },
      ]
    : []),
  ...(!isPackage && packageServiceIds.length > 0
    ? [
        {
          field: 'packageServiceIds',
          rule: 'not_allowed',
          message: serviceMessages.emptyUnlessPackage,
        },
      ]
    : []),
]
