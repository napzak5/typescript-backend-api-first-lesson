import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  DescriptionList,
  Link,
  Table,
  TagList,
} from '@beauty-salon-frontend/ui'
import { weekdayNameOf } from '../../../shifts/shift-week'
import { NOT_RECORDED } from '../../../staff/staff-format'
import {
  calendarFrom,
  coordinatesNameOf,
  ratingNameOf,
  taxRateNameOf,
  weekHoursOf,
} from '../../settings-format'
import styles from './salon-record.module.css'

export type SalonRecordProps = {
  salon: ModelsSalonResponse
  /** Today at the salon: the dates of the calendar before it are not shown */
  today: string
  /** The address of the payment methods of the salon */
  paymentMethodsHref: string
}

const writtenOrNone = (text: string | null) =>
  text === null ? NOT_RECORDED : <p className={styles['written']}>{text}</p>

const addressOrNone = (address: string | null) =>
  address === null ? (
    NOT_RECORDED
  ) : (
    <span className={styles['address']}>{address}</span>
  )

const namesOrNone = (label: string, names: readonly string[]) =>
  names.length === 0 ? 'なし' : <TagList label={label} items={names} />

/**
 * Everything a salon keeps of itself: what the customers are shown of it
 * (its name, its place, how to reach it, its photos), what it charges tax
 * at and where its payment methods are, and its hours, by the day of the
 * week and by the date from today on.
 */
export const SalonRecord = ({
  salon,
  today,
  paymentMethodsHref,
}: SalonRecordProps) => (
  <div className={styles['record']}>
    <Card title='サロン'>
      <DescriptionList
        items={[
          { term: '名前', description: salon.name },
          { term: 'カナ', description: salon.nameKana ?? NOT_RECORDED },
          { term: '紹介', description: writtenOrNone(salon.description) },
          {
            term: 'オンライン予約',
            description: salon.isActive ? '受け付ける' : '止めている',
          },
          {
            term: '評価',
            description: ratingNameOf(salon.rating, salon.reviewCount),
          },
        ]}
      />
    </Card>
    <Card title='所在地'>
      <DescriptionList
        items={[
          { term: '郵便番号', description: salon.postalCode ?? NOT_RECORDED },
          { term: '都道府県', description: salon.prefecture },
          { term: '市区町村', description: salon.city },
          { term: '町名・番地', description: salon.address },
          { term: '建物', description: salon.building ?? NOT_RECORDED },
          {
            term: '地図の位置',
            description: coordinatesNameOf(salon.latitude, salon.longitude),
          },
        ]}
      />
    </Card>
    <Card title='連絡先'>
      <DescriptionList
        items={[
          { term: '電話番号', description: salon.phoneNumber },
          {
            term: '予備の電話番号',
            description: salon.alternativePhone ?? NOT_RECORDED,
          },
          { term: 'メールアドレス', description: addressOrNone(salon.email) },
          {
            term: '公式サイト',
            description: addressOrNone(salon.websiteUrl),
          },
        ]}
      />
    </Card>
    <Card title='写真'>
      <DescriptionList
        items={[
          { term: 'ロゴの URL', description: addressOrNone(salon.logoUrl) },
          {
            term: '写真の URL',
            description:
              salon.imageUrls.length === 0 ? (
                'なし'
              ) : (
                <ul className={styles['addresses']}>
                  {salon.imageUrls.map((address) => (
                    <li key={address}>{addressOrNone(address)}</li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </Card>
    <Card title='特徴と設備'>
      <DescriptionList
        items={[
          { term: '特徴', description: namesOrNone('特徴', salon.features) },
          { term: '設備', description: namesOrNone('設備', salon.amenities) },
        ]}
      />
    </Card>
    <Card title='会計'>
      <DescriptionList
        items={[
          { term: 'タイムゾーン', description: salon.timezone },
          { term: '通貨', description: salon.currency },
          { term: '税率', description: taxRateNameOf(salon.taxRate) },
          {
            term: '支払い方法',
            description: (
              <Link href={paymentMethodsHref}>支払い方法を見る</Link>
            ),
          },
        ]}
      />
    </Card>
    <Table
      caption='営業時間'
      columns={[
        {
          key: 'weekday',
          header: '曜日',
          cell: ({ weekday }) => weekdayNameOf(weekday),
        },
        { key: 'hours', header: '営業時間', cell: ({ hours }) => hours },
      ]}
      rows={weekHoursOf(salon.businessHours, salon.timezone)}
      rowKey={({ weekday }) => weekday}
      emptyMessage='営業時間はありません'
    />
    <Table
      caption='営業日カレンダー'
      columns={[
        { key: 'day', header: '日付', cell: ({ day }) => day },
        { key: 'hours', header: '営業時間', cell: ({ hours }) => hours },
        {
          key: 'holiday',
          header: '祝日・休業日',
          cell: ({ holiday }) => holiday,
        },
        { key: 'notes', header: '備考', cell: ({ notes }) => notes },
      ]}
      rows={calendarFrom(salon.openingHours, today)}
      rowKey={({ date }) => date}
      emptyMessage='今日からの日付はありません。曜日ごとの営業時間で営業します。'
    />
  </div>
)
