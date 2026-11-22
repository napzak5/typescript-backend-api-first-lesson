import { AllergySeverityTypeSchema } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { MedicalChartReadMapper } from '../../../mappers/read/medical-chart.mapper'
import type {
  CustomerMergeConflictResolution,
  DbCustomer,
  DbNewCustomer,
} from '../../../models/customer'
import type {
  DbCustomerAllergy,
  DbNewCustomerAllergy,
} from '../../../models/customer-allergy'
import type {
  ApiMedicalChartResponse,
  DbMedicalChart,
  DbNewMedicalChart,
} from '../../../models/medical-chart'
import { MOST_LISTED } from '../../../schemas/medical-chart.schema'
import type { DomainError } from '../../../shared'

/**
 * The rules of a merge of two customers: the primary is kept, the
 * secondary is merged into it and deleted. What is merged here is decided
 * from the rows of both; the repository writes it.
 */

/** One of the two customers of a merge. */
export type MergeSide = 'primary' | 'secondary'

/**
 * Whose value a conflict takes. `newer` is the customer, or the row, that
 * was written last: the primary when both were written at the same moment.
 */
export const sideOf = (
  resolution: CustomerMergeConflictResolution,
  newer: MergeSide,
): MergeSide =>
  match(resolution)
    .returnType<MergeSide>()
    .with('keep_primary', () => 'primary')
    .with('keep_secondary', () => 'secondary')
    .with('keep_newest', () => newer)
    .exhaustive()

/** Whether two values are the same: they are plain data, as stored. */
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * The value of one field after the merge: the value both have, the value
 * of the one that has a value, or else the value of `side`.
 */
const mergedValue = <T>(
  primary: T,
  secondary: T,
  side: MergeSide,
  isEmpty: (value: T) => boolean = (value) => value === null,
): T => {
  if (same(primary, secondary) || isEmpty(secondary)) {
    return primary
  }
  if (isEmpty(primary)) {
    return secondary
  }
  return side === 'primary' ? primary : secondary
}

/**
 * The values of the ledger the primary has after the merge. A referrer
 * that is one of the two is no value: the customer would refer itself.
 */
export const mergedLedgerOf = (
  primary: DbCustomer,
  secondary: DbCustomer,
  side: MergeSide,
): DbNewCustomer => {
  const of = <K extends keyof DbNewCustomer & keyof DbCustomer>(
    field: K,
  ): DbCustomer[K] => mergedValue(primary[field], secondary[field], side)
  const referrerOf = ({ referredBy }: DbCustomer): string | null =>
    referredBy === primary.id || referredBy === secondary.id ? null : referredBy

  return {
    firstName: of('firstName'),
    lastName: of('lastName'),
    firstNameKana: of('firstNameKana'),
    lastNameKana: of('lastNameKana'),
    email: of('email'),
    phoneNumber: of('phoneNumber'),
    alternativePhone: of('alternativePhone'),
    postalCode: of('postalCode'),
    prefecture: of('prefecture'),
    city: of('city'),
    address: of('address'),
    building: of('building'),
    birthDate: of('birthDate'),
    gender: of('gender'),
    occupation: of('occupation'),
    membershipTier: of('membershipTier'),
    preferences: of('preferences'),
    notes: of('notes'),
    internalNotes: of('internalNotes'),
    tags: mergedValue(
      primary.tags,
      secondary.tags,
      side,
      (tags) => tags.length === 0,
    ),
    referredBy: mergedValue(referrerOf(primary), referrerOf(secondary), side),
    referralCode: of('referralCode'),
    allowMarketing: of('allowMarketing'),
    allowSms: of('allowSms'),
    allowEmail: of('allowEmail'),
    isActive: of('isActive'),
    hairType: of('hairType'),
    hairThickness: of('hairThickness'),
    scalpCondition: of('scalpCondition'),
    customerStatus: of('customerStatus'),
  }
}

/**
 * What a merge does with the preferences, of which a customer has one row
 * at most:
 * - `keep`: the primary keeps its row, or has none, as the secondary has none
 * - `move`: the row of the secondary becomes the primary's
 * - `copy`: the primary's row takes the values of `row`, the secondary's
 */
export type PreferencesMerge<Row> =
  | { type: 'keep' }
  | { type: 'move' }
  | { type: 'copy'; row: Row }

/**
 * What a merge does with the preferences: a row of either is kept whole, so
 * that the staff preferred and those avoided do not come from two rows.
 * `side` decides when both have one.
 */
export const preferencesMergeOf = <Row>(
  primary: Row | undefined,
  secondary: Row | undefined,
  side: MergeSide,
): PreferencesMerge<Row> => {
  if (secondary === undefined) {
    return { type: 'keep' }
  }
  if (primary === undefined) {
    return { type: 'move' }
  }
  return side === 'primary'
    ? { type: 'keep' }
    : { type: 'copy', row: secondary }
}

/** The values of a chart a merge writes. */
export type ChartValues = Pick<
  DbNewMedicalChart,
  | 'previousTreatments'
  | 'medicalConditions'
  | 'preferredProducts'
  | 'avoidProducts'
  | 'notes'
>

/** A list of a chart, which a request may write up to `MOST_LISTED` of. */
export type ChartList =
  | 'previousTreatments'
  | 'preferredProducts'
  | 'avoidProducts'

const CHART_LISTS: readonly ChartList[] = [
  'previousTreatments',
  'preferredProducts',
  'avoidProducts',
]

/**
 * What a merge does with the medical charts:
 * - `keep`: the secondary has none
 * - `move`: only the secondary has one, and it becomes the primary's
 * - `combine`: both have one, and the primary's takes `values`
 * - `tooLong`: both have one, and together they list more in `list` than a
 *   request may write
 */
export type ChartMerge =
  | { type: 'keep' }
  | { type: 'move' }
  | { type: 'combine'; values: ChartValues }
  | { type: 'tooLong'; list: ChartList }

/** The entries of `primary`, then those of `secondary` it does not have. */
const united = <T>(primary: readonly T[], secondary: readonly T[]): T[] => [
  ...primary,
  ...secondary.filter((entry) => !primary.some((kept) => same(kept, entry))),
]

/** A text of both: one alone, or both, the primary's first. */
const joined = (
  primary: string | null,
  secondary: string | null,
): string | null => {
  if (secondary === null || secondary === primary) {
    return primary
  }
  if (primary === null) {
    return secondary
  }
  return `${primary}\n\n${secondary}`
}

const combined = (
  primary: ApiMedicalChartResponse,
  secondary: ApiMedicalChartResponse,
): ChartMerge => {
  const values: ChartValues = {
    previousTreatments: united(
      primary.previousTreatments,
      secondary.previousTreatments,
    ),
    medicalConditions: joined(
      primary.medicalConditions,
      secondary.medicalConditions,
    ),
    preferredProducts: united(
      primary.preferredProducts,
      secondary.preferredProducts,
    ),
    avoidProducts: united(primary.avoidProducts, secondary.avoidProducts),
    notes: joined(primary.notes, secondary.notes),
  }
  const tooLong = CHART_LISTS.find((list) => values[list].length > MOST_LISTED)
  return tooLong === undefined
    ? { type: 'combine', values }
    : { type: 'tooLong', list: tooLong }
}

/**
 * What a merge does with the medical charts. Nothing of either is dropped,
 * whatever the conflict resolution: the lists are put together, and two
 * texts that differ are joined by a blank line.
 */
export const chartMergeOf = (
  primary: DbMedicalChart | null,
  secondary: DbMedicalChart | null,
): Result<ChartMerge, DomainError> => {
  if (secondary === null) {
    return Result.success({ type: 'keep' })
  }
  if (primary === null) {
    return Result.success({ type: 'move' })
  }
  return Result.flatMap(
    MedicalChartReadMapper.toApiMedicalChart(primary),
    (kept) =>
      Result.map(
        MedicalChartReadMapper.toApiMedicalChart(secondary),
        (merged) => combined(kept, merged),
      ),
  )
}

/** The values of an allergy a merge writes over the primary's. */
export type AllergyValues = Omit<DbNewCustomerAllergy, 'allergenName'>

/**
 * What a merge does with the allergies: `moved` are the secondary's of an
 * allergen the primary has none of, and `replaced` the primary's of an
 * allergen the secondary has a severer record of, with its values.
 */
export type AllergyMerge = {
  moved: string[]
  replaced: { id: string; values: AllergyValues }[]
}

const severityOf = ({ severityType }: DbCustomerAllergy): number =>
  AllergySeverityTypeSchema.options.indexOf(severityType)

/**
 * What a merge does with the allergies. Of an allergen both have, the
 * severer record is kept, and the primary's at the same severity: a merge
 * never lowers what the staff are warned of.
 */
export const allergyMergeOf = (
  primary: readonly DbCustomerAllergy[],
  secondary: readonly DbCustomerAllergy[],
): AllergyMerge => {
  const merge: AllergyMerge = { moved: [], replaced: [] }
  for (const allergy of secondary) {
    const kept = primary.find(
      ({ allergenName }) => allergenName === allergy.allergenName,
    )
    if (kept === undefined) {
      merge.moved.push(allergy.id)
    } else if (severityOf(allergy) > severityOf(kept)) {
      merge.replaced.push({
        id: kept.id,
        values: {
          allergyType: allergy.allergyType,
          severityType: allergy.severityType,
          symptoms: allergy.symptoms,
          notes: allergy.notes,
          confirmedDate: allergy.confirmedDate,
        },
      })
    }
  }
  return merge
}
