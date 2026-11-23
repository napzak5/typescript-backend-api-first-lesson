import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { webAddressOf } from '@beauty-salon-frontend/fields'
import {
  DescriptionList,
  type DescriptionListItem,
  TagList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { sessionMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { addressOf, telephoneHrefOf } from '../../utils/salon-format'
import styles from './salon-about.module.css'

const { about: words } = portalSalonMessages

export type SalonAboutProps = {
  salon: ModelsSalonResponse
}

const Telephone = ({ phoneNumber }: { phoneNumber: string }) => (
  <a href={telephoneHrefOf(phoneNumber)}>{phoneNumber}</a>
)

const Website = ({ url }: { url: string }) => {
  const address = webAddressOf(url)

  return address === null ? (
    url
  ) : (
    <a href={address} rel='noreferrer'>
      {url}
    </a>
  )
}

/** What a salon says about itself, and how it is reached. */
export const SalonAbout = ({ salon }: SalonAboutProps) => {
  const say = useSay()
  const items: DescriptionListItem[] = [
    {
      term: say(words.address),
      description: [
        ...(salon.postalCode === null
          ? []
          : [say(words.postalCode(salon.postalCode))]),
        addressOf(salon),
      ].join(' '),
    },
    {
      term: say(words.phoneNumber),
      description: (
        <>
          <Telephone phoneNumber={salon.phoneNumber} />
          {salon.alternativePhone !== null && (
            <>
              {say(words.betweenPhoneNumbers)}
              <Telephone phoneNumber={salon.alternativePhone} />
            </>
          )}
        </>
      ),
    },
    {
      term: say(sessionMessages.signInForm.email),
      description: <a href={`mailto:${salon.email}`}>{salon.email}</a>,
    },
    ...(salon.websiteUrl === null
      ? []
      : [
          {
            term: say(words.website),
            description: <Website url={salon.websiteUrl} />,
          },
        ]),
    ...(salon.features.length === 0
      ? []
      : [
          {
            term: say(words.features),
            description: (
              <TagList label={say(words.features)} items={salon.features} />
            ),
          },
        ]),
    ...(salon.amenities.length === 0
      ? []
      : [
          {
            term: say(words.amenities),
            description: (
              <TagList label={say(words.amenities)} items={salon.amenities} />
            ),
          },
        ]),
  ]

  return (
    <div className={styles['about']}>
      {salon.description !== null && (
        <WrittenText className={styles['description']}>
          {salon.description}
        </WrittenText>
      )}
      <DescriptionList items={items} />
    </div>
  )
}
