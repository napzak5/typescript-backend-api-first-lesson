import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'
import { Badge, DescriptionList, useSay } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalProfileMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { hairOf } from '../../utils/profile-format'
import styles from './membership-details.module.css'

const { membership: words } = portalProfileMessages

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

/**
 * What the salons keep of a member and the customer cannot change: the
 * rank, the points, the visits, and what a salon wrote down of their hair.
 */
export const MembershipDetails = ({ profile }: MembershipDetailsProps) => {
  const say = useSay()
  /** A day of a visit, or what stands there for a customer who has not come yet */
  const visitOn = (day: string | null): string =>
    say(day === null ? words.noVisit : formats.dayOf(day))

  return (
    <DescriptionList
      items={[
        {
          term: say(words.tier),
          description: (
            <Badge tone='info'>
              {say(termMessages.membershipTier[profile.membershipTier])}
            </Badge>
          ),
        },
        {
          term: say(words.points),
          description: (
            <span className={styles['points']}>
              {say(words.pointsOf(profile.loyaltyPoints))}
            </span>
          ),
        },
        {
          term: say(words.visits),
          description: say(words.visitsOf(profile.visitCount)),
        },
        {
          term: say(words.firstVisit),
          description: visitOn(profile.firstVisitDate),
        },
        {
          term: say(words.lastVisit),
          description: visitOn(profile.lastVisitDate),
        },
        {
          term: say(words.referralCode),
          description: profile.referralCode ?? say(words.notIssued),
        },
        ...hairOf(profile).map(({ term, description }) => ({
          term: say(term),
          description: description === null ? null : say(description),
        })),
      ]}
    />
  )
}
