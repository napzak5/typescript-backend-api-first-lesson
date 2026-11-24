import type { ModelsStaffResponse } from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  dayNameOf,
  momentNameAt,
} from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  TagList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import {
  activityNameOf,
  bookingsNameOf,
  bufferNameOf,
  commissionNameOf,
  concurrentBookingsNameOf,
  fullStaffNameOf,
  levelNameOf,
  yearsNameOf,
} from '../../utils/staff-format'
import styles from './staff-record.module.css'

const { values, words } = adminStaffMessages

export type StaffRecordProps = {
  member: ModelsStaffResponse
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  /** The currency of the salon, which the pay is in */
  currency: string
  /** What can be done with the member: changing them, removing them */
  actions?: ReactNode
}

/**
 * A member of the staff ledger, as the owner of the salon reads them: who
 * they are, how to reach them, how they are employed and paid, how they
 * are introduced to the customers, and how they take bookings. What the
 * ledger does not have is said to be so.
 */
export const StaffRecord = ({
  member,
  timezone,
  currency,
  actions,
}: StaffRecordProps) => {
  const say = useSay()
  /** A value that may not be recorded, in the language of the page */
  const sayIfAny = (value: LocalizedText | null): string | null =>
    value === null ? null : say(value)

  return (
    <div className={styles['record']}>
      <Card title={say(words.member)} actions={actions}>
        <DescriptionList
          items={[
            { term: say(words.displayName), description: member.displayName },
            {
              term: say(words.fullName),
              description: say(fullStaffNameOf(member)),
            },
            { term: say(words.staffCode), description: member.staffCode },
            {
              term: say(words.level),
              description: say(levelNameOf(member.level)),
            },
            { term: say(words.position), description: member.position },
            {
              term: say(words.status),
              description: say(activityNameOf(member)),
            },
            {
              term: say(words.account),
              description: say(
                member.userId === null ? values.notLinked : values.linked,
              ),
            },
            {
              term: say(words.createdAt),
              description: say(momentNameAt(member.createdAt, timezone)),
            },
          ]}
        />
      </Card>
      <Card title={say(words.contact)}>
        <DescriptionList
          items={[
            { term: say(words.email), description: member.email },
            { term: say(words.phoneNumber), description: member.phoneNumber },
            {
              term: say(words.alternativePhone),
              description: member.alternativePhone,
            },
          ]}
        />
      </Card>
      <Card title={say(words.employment)}>
        <DescriptionList
          items={[
            {
              term: say(words.employmentType),
              description: member.employmentType,
            },
            {
              term: say(words.hireDate),
              description: sayIfAny(
                member.hireDate === null ? null : dayNameOf(member.hireDate),
              ),
            },
            {
              term: say(words.baseSalary),
              description: sayIfAny(
                member.baseSalary === null
                  ? null
                  : amountOf(member.baseSalary, currency),
              ),
            },
            {
              term: say(words.commissionRate),
              description: sayIfAny(
                member.commissionRate === null
                  ? null
                  : commissionNameOf(member.commissionRate),
              ),
            },
          ]}
        />
      </Card>
      <Card title={say(words.introduction)}>
        <DescriptionList
          items={[
            {
              term: say(words.specialties),
              description: (
                <TagList
                  label={say(words.specialties)}
                  items={member.specialties}
                />
              ),
            },
            {
              term: say(words.certifications),
              description: (
                <TagList
                  label={say(words.certifications)}
                  items={member.certifications}
                />
              ),
            },
            {
              term: say(words.yearsOfExperience),
              description: sayIfAny(yearsNameOf(member.yearsOfExperience)),
            },
            {
              term: say(words.bio),
              description: <WrittenText>{member.bio}</WrittenText>,
            },
            { term: say(words.imageUrl), description: member.imageUrl },
          ]}
        />
      </Card>
      <Card title={say(words.bookingSettings)}>
        <DescriptionList
          items={[
            {
              term: say(words.bookings),
              description: say(bookingsNameOf(member)),
            },
            {
              term: say(words.maxConcurrentBookings),
              description: say(
                concurrentBookingsNameOf(member.maxConcurrentBookings),
              ),
            },
            {
              term: say(words.bufferTimeBefore),
              description: say(bufferNameOf(member.bufferTimeBefore)),
            },
            {
              term: say(words.bufferTimeAfter),
              description: say(bufferNameOf(member.bufferTimeAfter)),
            },
          ]}
        />
      </Card>
    </div>
  )
}
