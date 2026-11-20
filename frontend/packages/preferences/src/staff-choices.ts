import type {
  ModelsCustomerPreferencesResponse,
  ModelsSalonResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'

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
export const staffLabelOf = ({ displayName, salonName }: StaffChoice): string =>
  `${displayName}（${salonName}）`
