import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  DescriptionList,
  Note,
  TagList,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import {
  bookingsNameOf,
  levelNameOf,
  NOT_RECORDED,
} from '../../../staff/staff-format'

export type ProfileRecordProps = {
  profile: ModelsStaffProfileResponse
  /** The page of the salon in the application of the customers, where they read the profile */
  customerView: string
  /** The heading, which takes the focus when the profile is shown after it was saved */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

const namesOrNone = (label: string, names: readonly string[]) =>
  names.length === 0 ? NOT_RECORDED : <TagList label={label} items={names} />

/**
 * The profile of a member as the customers are shown it, read by the member
 * themselves: what the salon decides of it, and what they write. Where the
 * customers read it is a link away.
 */
export const ProfileRecord = ({
  profile,
  customerView,
  headingRef,
}: ProfileRecordProps) => (
  <Card title='お客様に見せるプロフィール' headingRef={headingRef}>
    <DescriptionList
      items={[
        { term: '表示名', description: profile.displayName },
        { term: 'レベル', description: levelNameOf(profile.level) },
        { term: '役職', description: profile.position ?? NOT_RECORDED },
        { term: '予約', description: bookingsNameOf(profile) },
        {
          term: '専門',
          description: namesOrNone('専門', profile.specialties),
        },
        {
          term: '資格',
          description: namesOrNone('資格', profile.certifications),
        },
        {
          term: '経験年数',
          description:
            profile.yearsOfExperience === null
              ? NOT_RECORDED
              : `${profile.yearsOfExperience} 年`,
        },
        {
          term: '紹介文',
          description:
            profile.bio === null ? (
              NOT_RECORDED
            ) : (
              <WrittenText>{profile.bio}</WrittenText>
            ),
        },
        {
          term: '写真の URL',
          description:
            profile.imageUrl === null ? NOT_RECORDED : profile.imageUrl,
        },
      ]}
    />
    <Note>
      表示名、レベル、役職、予約の受け方は、サロンがスタッフ台帳で決めます。変えたいときは、サロンのオーナーに伝えてください。
    </Note>
    <p>
      <a href={customerView}>お客様からの見え方を、サロンのページで見る</a>
    </p>
  </Card>
)
