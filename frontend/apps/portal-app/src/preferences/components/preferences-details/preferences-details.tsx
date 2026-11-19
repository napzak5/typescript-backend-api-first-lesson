import type { ModelsCustomerPreferencesResponse } from '@beauty-salon-frontend/api-client'
import { DescriptionList } from '@beauty-salon-frontend/ui'
import { webAddressOf } from '../../../salons/salon-format'
import { staffNamed, timeSlotOf, UNSET } from '../../preferences-format'
import type { StaffChoice } from '../../staff-choices'
import styles from './preferences-details.module.css'

export type PreferencesDetailsProps = {
  preferences: ModelsCustomerPreferencesResponse
  /**
   * The members of the staff that can be named. One the preferences name
   * who is not among them is not shown: their salon no longer shows them
   */
  staff: readonly StaffChoice[]
}

/** The entries of a list, as a sentence lists them; the word for none when there is none. */
const listed = (entries: readonly string[]): string =>
  entries.length === 0 ? UNSET : entries.join('、')

/**
 * What a customer wants the salons to keep in mind, as they read it: whom
 * they wish for and whom they avoid, when they like to come, what they
 * like of a style, and how they like to be served. What was not said is
 * said to be missing.
 *
 * The address of a picture is a link and no picture: the page loads
 * nothing from a site nobody has looked at.
 */
export const PreferencesDetails = ({
  preferences,
  staff,
}: PreferencesDetailsProps) => {
  const wished = staffNamed(
    preferences.preferredStaffId === null ? [] : [preferences.preferredStaffId],
    staff,
  )
  const style = preferences.stylePreferences
  const images = style?.inspirationImages ?? []

  return (
    <DescriptionList
      items={[
        { term: '指名したいスタッフ', description: listed(wished) },
        {
          term: '避けたいスタッフ',
          description: listed(staffNamed(preferences.avoidStaffIds, staff)),
        },
        {
          term: '希望する時間帯',
          description: listed(preferences.preferredTimeSlots.map(timeSlotOf)),
        },
        {
          term: '希望の長さ',
          description: style?.preferredLength ?? UNSET,
        },
        {
          term: '好きな色',
          description: listed(style?.preferredColors ?? []),
        },
        {
          term: '避けたいスタイル',
          description: listed(style?.avoidStyles ?? []),
        },
        {
          term: '参考の画像',
          description:
            images.length === 0
              ? UNSET
              : images.map((image) => {
                  const address = webAddressOf(image)

                  return (
                    <span key={image} className={styles['line']}>
                      {address === null ? (
                        image
                      ) : (
                        <a href={address} rel='noreferrer'>
                          {image}
                        </a>
                      )}
                    </span>
                  )
                }),
        },
        {
          term: '接客の好み',
          description: preferences.communicationStyle ?? UNSET,
        },
        {
          term: '特別な要望',
          description:
            preferences.specialRequests === null ? (
              UNSET
            ) : (
              <p className={styles['written']}>{preferences.specialRequests}</p>
            ),
        },
      ]}
    />
  )
}
