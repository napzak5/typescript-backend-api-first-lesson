import type {
  ModelsCustomerPreferencesResponse,
  ModelsTimeSlot,
} from '@beauty-salon-frontend/api-client'
import { webAddressOf } from '@beauty-salon-frontend/fields'
import { DescriptionList, WrittenText } from '@beauty-salon-frontend/ui'
import styles from './preferences-details.module.css'

export type PreferencesDetailsProps = {
  preferences: ModelsCustomerPreferencesResponse
  /**
   * The names of the members of the staff with the given IDs, as the
   * screen names them, in the order of the IDs. What a screen does with a
   * member nobody shows any more is its own: it leaves them out, or says
   * that there is one
   */
  staffNames: (ids: readonly string[]) => readonly string[]
}

/** What stands where a preference would, when the customer has none */
const UNSET = '指定なし'

/** The entries of a list, as a sentence lists them; the word for none when there is none. */
const listed = (entries: readonly string[]): string =>
  entries.length === 0 ? UNSET : entries.join('、')

/** A time slot as it is read: 「10:00〜12:00」. */
const timeSlotOf = ({ startTime, endTime }: ModelsTimeSlot): string =>
  `${startTime}〜${endTime}`

/**
 * What a customer wants the salons to keep in mind, as it is read: whom
 * they wish for and whom they avoid, when they like to come, what they
 * like of a style, and how they like to be served. What was not said is
 * said to be missing.
 *
 * The address of a picture is a link and no picture: the page loads
 * nothing from a site nobody has looked at. A stored value that is no
 * address of the web is text.
 */
export const PreferencesDetails = ({
  preferences,
  staffNames,
}: PreferencesDetailsProps) => {
  const wished = staffNames(
    preferences.preferredStaffId === null ? [] : [preferences.preferredStaffId],
  )
  const style = preferences.stylePreferences
  const images = style?.inspirationImages ?? []

  return (
    <DescriptionList
      items={[
        { term: '指名したいスタッフ', description: listed(wished) },
        {
          term: '避けたいスタッフ',
          description: listed(staffNames(preferences.avoidStaffIds)),
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
              <WrittenText>{preferences.specialRequests}</WrittenText>
            ),
        },
      ]}
    />
  )
}
