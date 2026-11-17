import { match } from 'ts-pattern'
import type { DbBooking } from '../../../models/booking'
import type { ProductId } from '../../../models/product'
import type { ServiceId } from '../../../models/service'
import type { ValidationIssue } from '../../../shared'
import { notFound } from '../../booking/_shared/plan'
import { lotNumberRefusal } from '../../inventory/_shared/lots'

/**
 * A treatment record is what the salon of a booking writes down of the
 * treatment: the services, the techniques, the states of the scalp and of
 * the hair, the colour formula, the materials and what to recommend next.
 * Everything it names is of the salon of its booking. The database does
 * not see to that for the services, which are a list of IDs, nor for the
 * staff member and the products, whose foreign keys do not say of which
 * salon they are; the rules here do, on what the database has of the
 * names of a request (`TreatmentFacts`).
 */

/**
 * Whether a booking takes a record of its treatment: once the treatment
 * has begun. A booking that has not begun has had no treatment, and one
 * that was cancelled or not come to has none.
 */
export const isTreated = (status: DbBooking['status']): boolean =>
  match(status)
    .with('in_progress', 'completed', () => true)
    .with('draft', 'pending', 'confirmed', 'cancelled', 'no_show', () => false)
    .exhaustive()

/**
 * What the database has, for the salon of the booking of a record, of what
 * a request names: the services that are of the salon and not deleted,
 * and the products that are, with whether each is kept by lots.
 */
export type TreatmentFacts = {
  /** The date of the booking, `YYYY-MM-DD`. */
  bookingDate: string
  services: ReadonlySet<ServiceId>
  /** Of each product, whether it is kept by lots (`requiresLotTracking`). */
  products: ReadonlyMap<ProductId, boolean>
}

/** What a request names of the lists of a record and of the next visit. */
export type NamedOfTreatment = {
  services?: readonly ServiceId[]
  nextRecommendedDate?: string | null
  nextRecommendedServices?: readonly ServiceId[]
  materials?: readonly { productId: ProductId; lotNumber: string | null }[]
}

const SERVICE = 'a service of the salon of the booking'

const serviceIssues = (
  field: string,
  services: readonly ServiceId[] | undefined,
  known: ReadonlySet<ServiceId>,
): ValidationIssue[] =>
  (services ?? []).flatMap((serviceId, index) =>
    known.has(serviceId) ? [] : [notFound(`${field}.${index}`, SERVICE)],
  )

/**
 * Why what a request names of a record does not fit the salon of its
 * booking, in the order of the properties of the request: a service or a
 * product that is not of the salon or is deleted, a next visit recommended
 * before the booking, and a lot number that does not fit its product
 * (`lotNumberRefusal`). Only what the request names is looked at.
 */
export const treatmentIssues = (
  facts: TreatmentFacts,
  named: NamedOfTreatment,
): ValidationIssue[] => {
  const { nextRecommendedDate, materials = [] } = named
  const dateIssues: ValidationIssue[] =
    nextRecommendedDate !== undefined &&
    nextRecommendedDate !== null &&
    nextRecommendedDate < facts.bookingDate
      ? [
          {
            field: 'nextRecommendedDate',
            rule: 'too_small',
            message: `Must not be before the date of the booking, ${facts.bookingDate}`,
          },
        ]
      : []
  const materialIssues = materials.flatMap(
    ({ productId, lotNumber }, index): ValidationIssue[] => {
      const requiresLotTracking = facts.products.get(productId)
      if (requiresLotTracking === undefined) {
        return [
          notFound(
            `materials.${index}.productId`,
            'a product of the salon of the booking',
          ),
        ]
      }
      const refusal = lotNumberRefusal(requiresLotTracking, lotNumber)
      return refusal === null
        ? []
        : [
            {
              field: `materials.${index}.lotNumber`,
              rule: 'custom',
              message: refusal,
            },
          ]
    },
  )

  return [
    ...serviceIssues('services', named.services, facts.services),
    ...dateIssues,
    ...serviceIssues(
      'nextRecommendedServices',
      named.nextRecommendedServices,
      facts.services,
    ),
    ...materialIssues,
  ]
}

/**
 * What the database has of what only a new record names: whether its
 * customer is the customer of the booking and not deleted, and whether
 * its staff member is of the salon of the booking and not deleted. The
 * staff member in charge of a record need not be the one of the booking:
 * an assistant writes the record of what they did.
 */
export type CreationFacts = TreatmentFacts & {
  customerOfBooking: boolean
  staffOfSalon: boolean
}

/**
 * Why a new record does not fit its booking, in the order of the
 * properties of the request (`treatmentIssues` for the rest).
 */
export const creationIssues = (
  facts: CreationFacts,
  named: NamedOfTreatment,
): ValidationIssue[] => [
  ...(facts.customerOfBooking
    ? []
    : [notFound('customerId', 'the customer of the booking')]),
  ...(facts.staffOfSalon
    ? []
    : [notFound('staffId', 'a staff member of the salon of the booking')]),
  ...treatmentIssues(facts, named),
]
