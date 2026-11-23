import type {
  ModelsCustomerPreferencesResponse,
  ModelsTimeSlot,
} from '@beauty-salon-frontend/api-client'
import { webAddressOf } from '@beauty-salon-frontend/fields'
import { DescriptionList, useSay, WrittenText } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { preferenceMessages } from '@beauty-salon-shared/i18n/messages/ui'
import styles from './preferences-details.module.css'

const { details, form: words } = preferenceMessages

export type PreferencesDetailsProps = {
  preferences: ModelsCustomerPreferencesResponse
  /**
   * The names of the members of the staff with the given IDs, as the
   * screen names them in every language, in the order of the IDs. What a screen does with a
   * member nobody shows any more is its own: it leaves them out, or says
   * that there is one
   */
  staffNames: (ids: readonly string[]) => readonly LocalizedText[]
}

/** The entries of a list, as a sentence lists them; the word for none when there is none. */
const listed = (entries: readonly string[]): LocalizedText =>
  entries.length === 0 ? details.unset : details.listed(entries)

/** The time slots, as they are read: 「10:00〜12:00、14:00〜16:00」; the word for none when there is none. */
const timeSlotsOf = (slots: readonly ModelsTimeSlot[]): LocalizedText =>
  slots.length === 0 ? details.unset : details.timeSlots(slots)

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
  const say = useSay()
  const unset = say(details.unset)
  const wished = staffNames(
    preferences.preferredStaffId === null ? [] : [preferences.preferredStaffId],
  )
  const style = preferences.stylePreferences
  const images = style?.inspirationImages ?? []

  return (
    <DescriptionList
      items={[
        {
          term: say(words.preferredStaff),
          description: say(listed(wished.map(say))),
        },
        {
          term: say(words.avoidedStaff),
          description: say(
            listed(staffNames(preferences.avoidStaffIds).map(say)),
          ),
        },
        {
          term: say(words.timeSlots),
          description: say(timeSlotsOf(preferences.preferredTimeSlots)),
        },
        {
          term: say(words.preferredLength),
          description: style?.preferredLength ?? unset,
        },
        {
          term: say(words.preferredColors),
          description: say(listed(style?.preferredColors ?? [])),
        },
        {
          term: say(words.avoidedStyles),
          description: say(listed(style?.avoidStyles ?? [])),
        },
        {
          term: say(details.inspirationImages),
          description:
            images.length === 0
              ? unset
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
          term: say(words.communicationStyle),
          description: preferences.communicationStyle ?? unset,
        },
        {
          term: say(words.specialRequests),
          description:
            preferences.specialRequests === null ? (
              unset
            ) : (
              <WrittenText>{preferences.specialRequests}</WrittenText>
            ),
        },
      ]}
    />
  )
}
