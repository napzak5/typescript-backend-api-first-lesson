import type {
  ModelsReviewSummaryResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Badge,
  DescriptionList,
  Rating,
  TagList,
} from '@beauty-salon-frontend/ui'
import { levelNameOf } from '../../salon-format'
import styles from './staff-profiles.module.css'

export type StaffProfilesProps = {
  /** The people of a salon, in the order of the API; at least one */
  staff: readonly ModelsStaffProfileResponse[]
  /**
   * How each of them was rated, under their ID. `undefined` while that is
   * not known: it is being read, or could not be read. Nothing is said of
   * the ratings then, and nothing of somebody who has no entry
   */
  ratings?: Readonly<Record<string, ModelsReviewSummaryResponse>> | undefined
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

type PersonProps = {
  person: ModelsStaffProfileResponse
  /** How the reviews that rate this person add up; `undefined` when that is not known */
  rating: ModelsReviewSummaryResponse | undefined
}

const Person = ({ person, rating }: PersonProps) => {
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
      {rating !== undefined &&
        (rating.totalReviews === 0 ? (
          <p className={styles['unrated']}>レビューは、まだありません</p>
        ) : (
          <p>
            <Rating value={rating.averageRating} count={rating.totalReviews} />
          </p>
        ))}
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
export const StaffProfiles = ({ staff, ratings }: StaffProfilesProps) => (
  <ul className={styles['staff']}>
    {staff.map((person) => (
      <Person key={person.id} person={person} rating={ratings?.[person.id]} />
    ))}
  </ul>
)
