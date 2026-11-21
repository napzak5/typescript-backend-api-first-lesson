import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  DescriptionList,
  type DescriptionListItem,
  TagList,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { addressOf, telephoneHrefOf, webAddressOf } from '../../salon-format'
import styles from './salon-about.module.css'

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
  const items: DescriptionListItem[] = [
    {
      term: '住所',
      description: [
        ...(salon.postalCode === null ? [] : [`〒${salon.postalCode}`]),
        addressOf(salon),
      ].join(' '),
    },
    {
      term: '電話番号',
      description: (
        <>
          <Telephone phoneNumber={salon.phoneNumber} />
          {salon.alternativePhone !== null && (
            <>
              、<Telephone phoneNumber={salon.alternativePhone} />
            </>
          )}
        </>
      ),
    },
    {
      term: 'メールアドレス',
      description: <a href={`mailto:${salon.email}`}>{salon.email}</a>,
    },
    ...(salon.websiteUrl === null
      ? []
      : [
          {
            term: 'ウェブサイト',
            description: <Website url={salon.websiteUrl} />,
          },
        ]),
    ...(salon.features.length === 0
      ? []
      : [
          {
            term: '特徴',
            description: <TagList label='特徴' items={salon.features} />,
          },
        ]),
    ...(salon.amenities.length === 0
      ? []
      : [
          {
            term: '設備とサービス',
            description: (
              <TagList label='設備とサービス' items={salon.amenities} />
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
