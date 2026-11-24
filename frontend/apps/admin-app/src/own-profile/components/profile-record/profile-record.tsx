import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  DescriptionList,
  Note,
  TagList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import {
  adminProfileMessages,
  adminStaffMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import type { Ref } from 'react'
import {
  bookingsNameOf,
  levelNameOf,
  yearsNameOf,
} from '../../../staff/utils/staff-format'

const { record } = adminProfileMessages
const { words } = adminStaffMessages

export type ProfileRecordProps = {
  profile: ModelsStaffProfileResponse
  /** The page of the salon in the application of the customers, where they read the profile */
  customerView: string
  /** The heading, which takes the focus when the profile is shown after it was saved */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

/**
 * The profile of a member as the customers are shown it, read by the member
 * themselves: what the salon decides of it, and what they write. Where the
 * customers read it is a link away.
 */
export const ProfileRecord = ({
  profile,
  customerView,
  headingRef,
}: ProfileRecordProps) => {
  const say = useSay()
  const years = yearsNameOf(profile.yearsOfExperience)

  return (
    <Card title={say(record.title)} headingRef={headingRef}>
      <DescriptionList
        items={[
          { term: say(words.displayName), description: profile.displayName },
          {
            term: say(words.level),
            description: say(levelNameOf(profile.level)),
          },
          { term: say(words.position), description: profile.position },
          {
            term: say(words.bookings),
            description: say(bookingsNameOf(profile)),
          },
          {
            term: say(words.specialties),
            description: (
              <TagList
                label={say(words.specialties)}
                items={profile.specialties}
              />
            ),
          },
          {
            term: say(words.certifications),
            description: (
              <TagList
                label={say(words.certifications)}
                items={profile.certifications}
              />
            ),
          },
          {
            term: say(words.yearsOfExperience),
            description: years === null ? null : say(years),
          },
          {
            term: say(words.bio),
            description: <WrittenText>{profile.bio}</WrittenText>,
          },
          { term: say(words.imageUrl), description: profile.imageUrl },
        ]}
      />
      <Note>{say(record.note)}</Note>
      <p>
        <a href={customerView}>{say(record.customerView)}</a>
      </p>
    </Card>
  )
}
