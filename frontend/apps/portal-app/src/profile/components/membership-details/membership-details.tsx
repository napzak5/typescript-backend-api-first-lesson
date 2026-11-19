import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'
import { Badge, DescriptionList } from '@beauty-salon-frontend/ui'
import {
  calendarDayOf,
  hairOf,
  pointsOf,
  tierNameOf,
  visitsOf,
} from '../../profile-format'
import styles from './membership-details.module.css'

export type MembershipDetailsProps = {
  profile: Pick<
    ModelsCustomerProfileResponse,
    | 'membershipTier'
    | 'loyaltyPoints'
    | 'visitCount'
    | 'firstVisitDate'
    | 'lastVisitDate'
    | 'referralCode'
    | 'hairType'
    | 'hairThickness'
    | 'scalpCondition'
  >
}

/** What stands where a day would, for a customer who has not come yet */
const NO_VISIT = 'まだ来店がありません'

/**
 * What the salons keep of a member and the customer cannot change: the
 * rank, the points, the visits, and what a salon wrote down of their hair.
 */
export const MembershipDetails = ({ profile }: MembershipDetailsProps) => (
  <DescriptionList
    items={[
      {
        term: '会員ランク',
        description: (
          <Badge tone='info'>{tierNameOf(profile.membershipTier)}</Badge>
        ),
      },
      {
        term: 'ポイント',
        description: (
          <span className={styles['points']}>
            {pointsOf(profile.loyaltyPoints)}
          </span>
        ),
      },
      { term: '来店回数', description: visitsOf(profile.visitCount) },
      {
        term: '初めての来店',
        description:
          profile.firstVisitDate === null
            ? NO_VISIT
            : calendarDayOf(profile.firstVisitDate),
      },
      {
        term: '最後の来店',
        description:
          profile.lastVisitDate === null
            ? NO_VISIT
            : calendarDayOf(profile.lastVisitDate),
      },
      { term: '紹介コード', description: profile.referralCode ?? '未発行' },
      ...hairOf(profile),
    ]}
  />
)
