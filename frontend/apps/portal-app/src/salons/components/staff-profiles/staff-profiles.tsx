import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import { Badge, DescriptionList, TagList } from '@beauty-salon-frontend/ui'
import { levelNameOf } from '../../salon-format'
import styles from './staff-profiles.module.css'

export type StaffProfilesProps = {
  /** The people of a salon, in the order of the API; at least one */
  staff: readonly ModelsStaffProfileResponse[]
}

/** What a person does at the salon, in one line: 「店長・シニア・経験 12 年」. */
const roleOf = (person: ModelsStaffProfileResponse): string =>
  [
    ...(person.position === null ? [] : [person.position]),
    levelNameOf(person.level),
    ...(person.yearsOfExperience === null
      ? []
      : [`経験 ${person.yearsOfExperience} 年`]),
  ].join('・')

const Person = ({ person }: { person: ModelsStaffProfileResponse }) => {
  const skills = [
    ...(person.specialties.length === 0
      ? []
      : [
          {
            term: '得意な施術',
            description: (
              <TagList
                label={`${person.displayName}の得意な施術`}
                items={person.specialties}
              />
            ),
          },
        ]),
    ...(person.certifications.length === 0
      ? []
      : [
          {
            term: '資格',
            description: (
              <TagList
                label={`${person.displayName}の資格`}
                items={person.certifications}
              />
            ),
          },
        ]),
  ]

  return (
    <li className={styles['person']}>
      <h3 className={styles['name']}>{person.displayName}</h3>
      <p className={styles['role']}>{roleOf(person)}</p>
      {!person.canReceiveBookings && (
        <p>
          <Badge>予約の受け付けなし</Badge>
        </p>
      )}
      {person.bio !== null && <p className={styles['bio']}>{person.bio}</p>}
      {skills.length > 0 && <DescriptionList items={skills} />}
    </li>
  )
}

/** The people of a salon, as the salon shows them to its customers. */
export const StaffProfiles = ({ staff }: StaffProfilesProps) => (
  <ul className={styles['staff']}>
    {staff.map((person) => (
      <Person key={person.id} person={person} />
    ))}
  </ul>
)
