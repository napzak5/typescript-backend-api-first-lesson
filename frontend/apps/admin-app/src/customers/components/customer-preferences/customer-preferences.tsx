import type {
  ModelsCustomerPreferencesResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { DescriptionList, WrittenText } from '@beauty-salon-frontend/ui'
import styles from './customer-preferences.module.css'

export type CustomerPreferencesProps = {
  preferences: ModelsCustomerPreferencesResponse
  /**
   * The profiles of the members of the staff the preferences name, under
   * their IDs. One who is not among them is no longer shown by a salon
   */
  staff: ReadonlyMap<string, Pick<ModelsStaffProfileResponse, 'displayName'>>
}

const UNSET = '指定なし'

/** What a member is called who is no longer shown by a salon: removed, or not working there now */
const UNLISTED = '一覧にないスタッフ'

/** The entries of a list, as a sentence lists them; the word for none when there is none. */
const listed = (entries: readonly string[]): string =>
  entries.length === 0 ? UNSET : entries.join('、')

/**
 * What a customer wants the salon to keep in mind, as the customer or the
 * staff set it: whom they wish for and whom they avoid, when they like to
 * come, what they like of a style, and how they like to be served. A
 * member of the staff is named as the salons show them; one who is shown
 * no more is said to be so. The address of a picture is text and no link:
 * the screen loads nothing from a site nobody has looked at.
 */
export const CustomerPreferences = ({
  preferences,
  staff,
}: CustomerPreferencesProps) => {
  const named = (ids: readonly string[]): string[] =>
    ids.map((id) => staff.get(id)?.displayName ?? UNLISTED)
  const style = preferences.stylePreferences
  const images = style?.inspirationImages ?? []

  return (
    <DescriptionList
      items={[
        {
          term: '指名したいスタッフ',
          description: listed(
            named(
              preferences.preferredStaffId === null
                ? []
                : [preferences.preferredStaffId],
            ),
          ),
        },
        {
          term: '避けたいスタッフ',
          description: listed(named(preferences.avoidStaffIds)),
        },
        {
          term: '希望する時間帯',
          description: listed(
            preferences.preferredTimeSlots.map(
              ({ startTime, endTime }) => `${startTime}〜${endTime}`,
            ),
          ),
        },
        { term: '希望の長さ', description: style?.preferredLength ?? UNSET },
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
              : images.map((image) => (
                  <span key={image} className={styles['line']}>
                    {image}
                  </span>
                )),
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
