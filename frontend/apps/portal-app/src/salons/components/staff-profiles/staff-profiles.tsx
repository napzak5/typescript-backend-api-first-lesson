import type {
  ModelsReviewSummaryResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Badge,
  CardList,
  DescriptionList,
  Rating,
  TagList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import styles from './staff-profiles.module.css'

const { staff: words } = portalSalonMessages

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
const roleOf = (person: ModelsStaffProfileResponse): LocalizedText =>
  words.role(
    person.position,
    termMessages.staffLevel[person.level],
    person.yearsOfExperience,
  )

type PersonProps = {
  person: ModelsStaffProfileResponse
  /** How the reviews that rate this person add up; `undefined` when that is not known */
  rating: ModelsReviewSummaryResponse | undefined
}

const Person = ({ person, rating }: PersonProps) => {
  const say = useSay()
  const skills = [
    ...(person.specialties.length === 0
      ? []
      : [
          {
            term: say(words.specialties),
            description: (
              <TagList
                label={say(words.specialtiesOf(person.displayName))}
                items={person.specialties}
              />
            ),
          },
        ]),
    ...(person.certifications.length === 0
      ? []
      : [
          {
            term: say(words.certifications),
            description: (
              <TagList
                label={say(words.certificationsOf(person.displayName))}
                items={person.certifications}
              />
            ),
          },
        ]),
  ]

  return (
    <>
      <h3 className={styles['name']}>{person.displayName}</h3>
      <p className={styles['role']}>{say(roleOf(person))}</p>
      {rating !== undefined &&
        (rating.totalReviews === 0 ? (
          <p className={styles['unrated']}>
            {say(portalSalonMessages.reviews.noneYet)}
          </p>
        ) : (
          <p>
            <Rating value={rating.averageRating} count={rating.totalReviews} />
          </p>
        ))}
      {!person.canReceiveBookings && (
        <p>
          <Badge>{say(words.takesNoBookings)}</Badge>
        </p>
      )}
      {person.bio !== null && <WrittenText>{person.bio}</WrittenText>}
      {skills.length > 0 && <DescriptionList items={skills} />}
    </>
  )
}

/** The people of a salon, as the salon shows them to its customers. */
export const StaffProfiles = ({ staff, ratings }: StaffProfilesProps) => (
  <CardList items={staff} itemKey={({ id }) => id} layout='tiles'>
    {(person) => <Person person={person} rating={ratings?.[person.id]} />}
  </CardList>
)
