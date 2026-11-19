import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'
import { DescriptionList } from '@beauty-salon-frontend/ui'
import {
  addressLinesOf,
  calendarDayOf,
  categoryNamesOf,
  contactsOf,
  fullNameOf,
  genderNameOf,
  kanaOf,
  UNSAID,
} from '../../profile-format'
import styles from './profile-details.module.css'

export type ProfileDetailsProps = {
  profile: ModelsCustomerProfileResponse
}

/**
 * What a customer told the salons about themselves, as they read it: who
 * they are, how to reach them, where they live, and what they like. What
 * was not said is said to be missing.
 */
export const ProfileDetails = ({ profile }: ProfileDetailsProps) => {
  const address = addressLinesOf(profile)
  const liked = categoryNamesOf(profile.preferences?.preferredServices ?? [])
  const notes = profile.preferences?.notes ?? null
  const contacts = contactsOf(profile)

  return (
    <DescriptionList
      items={[
        { term: 'お名前', description: fullNameOf(profile) },
        { term: 'フリガナ', description: kanaOf(profile) ?? UNSAID },
        { term: 'メールアドレス', description: profile.email },
        { term: '電話番号', description: profile.phoneNumber },
        {
          term: '予備の電話番号',
          description: profile.alternativePhone ?? UNSAID,
        },
        {
          term: '住所',
          description:
            address.length === 0
              ? UNSAID
              : address.map((line) => (
                  <span key={line} className={styles['line']}>
                    {line}
                  </span>
                )),
        },
        {
          term: '生年月日',
          description:
            profile.birthDate === null
              ? UNSAID
              : calendarDayOf(profile.birthDate),
        },
        {
          term: '性別',
          description:
            profile.gender === null ? UNSAID : genderNameOf(profile.gender),
        },
        { term: '職業', description: profile.occupation ?? UNSAID },
        {
          term: '好みのメニュー',
          description: liked.length === 0 ? UNSAID : liked.join('、'),
        },
        {
          term: 'サロンに伝えておきたいこと',
          description:
            notes === null ? (
              UNSAID
            ) : (
              <p className={styles['notes']}>{notes}</p>
            ),
        },
        {
          term: '受け取る連絡',
          description: contacts.length === 0 ? 'なし' : contacts.join('、'),
        },
      ]}
    />
  )
}
