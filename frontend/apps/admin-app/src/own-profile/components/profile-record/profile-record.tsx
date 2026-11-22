import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  DescriptionList,
  Note,
  TagList,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import { bookingsNameOf, levelNameOf } from '../../../staff/utils/staff-format'

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
}: ProfileRecordProps) => (
  <Card title='お客様に見せるプロフィール' headingRef={headingRef}>
    <DescriptionList
      items={[
        { term: '表示名', description: profile.displayName },
        { term: 'レベル', description: levelNameOf(profile.level) },
        { term: '役職', description: profile.position },
        { term: '予約', description: bookingsNameOf(profile) },
        {
          term: '専門',
          description: <TagList label={'専門'} items={profile.specialties} />,
        },
        {
          term: '資格',
          description: (
            <TagList label={'資格'} items={profile.certifications} />
          ),
        },
        {
          term: '経験年数',
          description:
            profile.yearsOfExperience === null
              ? null
              : `${profile.yearsOfExperience} 年`,
        },
        {
          term: '紹介文',
          description: <WrittenText>{profile.bio}</WrittenText>,
        },
        {
          term: '写真の URL',
          description: profile.imageUrl === null ? null : profile.imageUrl,
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
