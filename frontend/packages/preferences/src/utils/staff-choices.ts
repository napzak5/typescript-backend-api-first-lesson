import type {
  ModelsCustomerPreferencesResponse,
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { preferenceMessages } from '@beauty-salon-shared/i18n/messages/ui'

/** A member of the staff a customer may wish for or avoid, with the salon they work at. */
export type StaffChoice = {
  id: string
  displayName: string
  salonId: string
  salonName: string
}

/** The members of the staff the preferences name, each once: the one wished for first. */
export const staffIdsOf = ({
  preferredStaffId,
  avoidStaffIds,
}: Pick<
  ModelsCustomerPreferencesResponse,
  'preferredStaffId' | 'avoidStaffIds'
>): string[] => [
  ...new Set([
    ...(preferredStaffId === null ? [] : [preferredStaffId]),
    ...avoidStaffIds,
  ]),
]

/**
 * The staff as a screen names them: each member once, with the name of
 * their salon. The salons follow each other by name, and the staff of a
 * salon stay in the order the salon shows them in. A member whose salon is
 * not among `salons` is left out: nothing is known of where they work.
 */
export const staffChoicesOf = (
  staff: readonly ModelsStaffProfileResponse[],
  salons: readonly Pick<ModelsSalonResponse, 'id' | 'name'>[],
): StaffChoice[] => {
  const names = new Map(salons.map(({ id, name }) => [id, name]))

  return staff
    .filter(
      (member, index) =>
        staff.findIndex(({ id }) => id === member.id) === index,
    )
    .flatMap(({ id, displayName, salonId }) => {
      const salonName = names.get(salonId)

      return salonName === undefined
        ? []
        : [{ id, displayName, salonId, salonName }]
    })
    .toSorted(
      (one, other) =>
        one.salonName.localeCompare(other.salonName, 'ja') ||
        one.salonId.localeCompare(other.salonId),
    )
}

/** How a member of the staff is named where staff of several salons stand together: 「田中 美咲（Beauty Salon Tokyo）」. */
export const staffLabelOf = ({
  displayName,
  salonName,
}: StaffChoice): LocalizedText =>
  preferenceMessages.staffOfSalon(displayName, salonName)

/**
 * The names of the members of the staff with the given IDs, in the order
 * of the IDs. A member who is not among `staff` has no name to show, and is
 * left out.
 */
export const staffNamed = (
  ids: readonly string[],
  staff: readonly StaffChoice[],
): LocalizedText[] =>
  ids.flatMap((id) => {
    const member = staff.find((choice) => choice.id === id)

    return member === undefined ? [] : [staffLabelOf(member)]
  })
