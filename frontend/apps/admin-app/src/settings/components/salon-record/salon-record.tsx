import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  DescriptionList,
  Link,
  NONE,
  Table,
  TagList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  calendarFrom,
  coordinatesNameOf,
  ratingNameOf,
  taxRateNameOf,
  weekHoursOf,
} from '../../utils/settings-format'
import styles from './salon-record.module.css'

const { hoursRecord, record, words } = adminSettingsMessages

export type SalonRecordProps = {
  salon: ModelsSalonResponse
  /** Today at the salon: the dates of the calendar before it are not shown */
  today: string
  /** The address of the payment methods of the salon */
  paymentMethodsHref: string
}

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
}: SalonRecordProps) => {
  const say = useSay()
  const place = coordinatesNameOf(salon.latitude, salon.longitude)

  return (
    <div className={styles['record']}>
      <Card title={say(words.salon)}>
        <DescriptionList
          items={[
            { term: say(words.name), description: salon.name },
            { term: say(words.nameKana), description: salon.nameKana },
            {
              term: say(words.description),
              description: <WrittenText>{salon.description}</WrittenText>,
            },
            {
              term: say(record.onlineBooking),
              description: say(
                salon.isActive ? record.accepting : record.paused,
              ),
            },
            {
              term: say(record.rating),
              description: say(ratingNameOf(salon.rating, salon.reviewCount)),
            },
          ]}
        />
      </Card>
      <Card title={say(words.location)}>
        <DescriptionList
          items={[
            { term: say(words.postalCode), description: salon.postalCode },
            { term: say(words.prefecture), description: salon.prefecture },
            { term: say(words.city), description: salon.city },
            { term: say(words.address), description: salon.address },
            { term: say(words.building), description: salon.building },
            {
              term: say(record.place),
              description: place === null ? null : say(place),
            },
          ]}
        />
      </Card>
      <Card title={say(words.contact)}>
        <DescriptionList
          items={[
            { term: say(words.phoneNumber), description: salon.phoneNumber },
            {
              term: say(words.alternativePhone),
              description: salon.alternativePhone,
            },
            { term: say(words.email), description: salon.email },
            { term: say(words.websiteUrl), description: salon.websiteUrl },
          ]}
        />
      </Card>
      <Card title={say(words.photos)}>
        <DescriptionList
          items={[
            { term: say(words.logoUrl), description: salon.logoUrl },
            {
              term: say(words.imageUrls),
              description:
                salon.imageUrls.length === 0 ? (
                  say(NONE)
                ) : (
                  <ul className={styles['addresses']}>
                    {salon.imageUrls.map((address) => (
                      <li key={address}>{address}</li>
                    ))}
                  </ul>
                ),
            },
          ]}
        />
      </Card>
      <Card title={say(words.featuresAndAmenities)}>
        <DescriptionList
          items={[
            {
              term: say(words.features),
              description: (
                <TagList label={say(words.features)} items={salon.features} />
              ),
            },
            {
              term: say(words.amenities),
              description: (
                <TagList label={say(words.amenities)} items={salon.amenities} />
              ),
            },
          ]}
        />
      </Card>
      <Card title={say(words.accounting)}>
        <DescriptionList
          items={[
            { term: say(words.timezone), description: salon.timezone },
            { term: say(words.currency), description: salon.currency },
            {
              term: say(words.taxRate),
              description: say(taxRateNameOf(salon.taxRate)),
            },
            {
              term: say(record.paymentMethods),
              description: (
                <Link href={paymentMethodsHref}>
                  {say(record.toPaymentMethods)}
                </Link>
              ),
            },
          ]}
        />
      </Card>
      <Table
        caption={say(hoursRecord.week)}
        columns={[
          {
            key: 'weekday',
            header: say(hoursRecord.weekday),
            cell: ({ weekday }) => say(termMessages.dayOfWeek[weekday]),
          },
          {
            key: 'hours',
            header: say(hoursRecord.hours),
            cell: ({ hours }) => say(hours),
          },
        ]}
        rows={weekHoursOf(salon.businessHours, salon.timezone)}
        rowKey={({ weekday }) => weekday}
        emptyMessage={say(hoursRecord.noWeek)}
      />
      <Table
        caption={say(hoursRecord.calendar)}
        columns={[
          {
            key: 'day',
            header: say(hoursRecord.date),
            cell: ({ day }) => say(day),
          },
          {
            key: 'hours',
            header: say(hoursRecord.hours),
            cell: ({ hours }) => say(hours),
          },
          {
            key: 'holiday',
            header: say(hoursRecord.holiday),
            cell: ({ holiday }) => say(holiday),
          },
          {
            key: 'notes',
            header: say(hoursRecord.notes),
            cell: ({ notes }) => notes,
          },
        ]}
        rows={calendarFrom(salon.openingHours, today)}
        rowKey={({ date }) => date}
        emptyMessage={say(hoursRecord.noCalendar)}
      />
    </div>
  )
}
