import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  DescriptionList,
  NONE,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalProfileMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  addressLinesOf,
  categoryNamesOf,
  contactsOf,
  fullNameOf,
  kanaOf,
} from '../../utils/profile-format'
import styles from './profile-details.module.css'

const { controls, parts, details } = portalProfileMessages

export type ProfileDetailsProps = {
  profile: ModelsCustomerProfileResponse
}

/**
 * What a customer told the salons about themselves, as they read it: who
 * they are, how to reach them, where they live, and what they like. What
 * was not said is said to be missing.
 */
export const ProfileDetails = ({ profile }: ProfileDetailsProps) => {
  const say = useSay()
  const address = addressLinesOf(profile).map((line) =>
    typeof line === 'string' ? line : say(line),
  )
  const liked = categoryNamesOf(profile.preferences?.preferredServices ?? [])
  const notes = profile.preferences?.notes ?? null
  const contacts = contactsOf(profile)

  return (
    <DescriptionList
      items={[
        { term: say(parts.name), description: fullNameOf(profile) },
        { term: say(details.kana), description: kanaOf(profile) },
        { term: say(details.email), description: profile.email },
        { term: say(controls.phoneNumber), description: profile.phoneNumber },
        {
          term: say(controls.alternativePhone),
          description: profile.alternativePhone,
        },
        {
          term: say(parts.address),
          description:
            address.length === 0
              ? null
              : address.map((line) => (
                  <span key={line} className={styles['line']}>
                    {line}
                  </span>
                )),
        },
        {
          term: say(controls.birthDate),
          description:
            profile.birthDate === null
              ? null
              : say(formats.dayOf(profile.birthDate)),
        },
        {
          term: say(controls.gender),
          description:
            profile.gender === null
              ? null
              : say(termMessages.gender[profile.gender]),
        },
        { term: say(controls.occupation), description: profile.occupation },
        {
          term: say(controls.preferredServices),
          description: say(liked.length === 0 ? NONE : details.listed(liked)),
        },
        {
          term: say(controls.notes),
          description: <WrittenText>{notes}</WrittenText>,
        },
        {
          term: say(parts.contacts),
          description: say(
            contacts.length === 0 ? NONE : details.listed(contacts),
          ),
        },
      ]}
    />
  )
}
