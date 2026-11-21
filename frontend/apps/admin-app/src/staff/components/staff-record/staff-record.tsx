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
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import {
  activityNameOf,
  bookingsNameOf,
  bufferNameOf,
  commissionNameOf,
  fullStaffNameOf,
  levelNameOf,
} from '../../staff-format'
import styles from './staff-record.module.css'

export type StaffRecordProps = {
  member: ModelsStaffResponse
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  /** The currency of the salon, which the pay is in */
  currency: string
  /** What can be done with the member: changing them, removing them */
  actions?: ReactNode
}

const writtenOrNone = (text: string | null) =>
  text === null ? null : <WrittenText>{text}</WrittenText>

const namesOrNone = (label: string, names: readonly string[]) =>
  names.length === 0 ? 'なし' : <TagList label={label} items={names} />

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
}: StaffRecordProps) => (
  <div className={styles['record']}>
    <Card title='スタッフ' actions={actions}>
      <DescriptionList
        items={[
          { term: '表示名', description: member.displayName },
          { term: '氏名', description: fullStaffNameOf(member) },
          { term: 'スタッフコード', description: member.staffCode },
          { term: 'レベル', description: levelNameOf(member.level) },
          { term: '役職', description: member.position },
          { term: '状態', description: activityNameOf(member) },
          {
            term: 'ログインアカウント',
            description:
              member.userId === null ? '紐づいていません' : '紐づいています',
          },
          {
            term: '登録した日時',
            description: momentNameAt(member.createdAt, timezone),
          },
        ]}
      />
    </Card>
    <Card title='連絡先'>
      <DescriptionList
        items={[
          { term: 'メールアドレス', description: member.email },
          { term: '電話番号', description: member.phoneNumber },
          {
            term: '予備の電話番号',
            description: member.alternativePhone,
          },
        ]}
      />
    </Card>
    <Card title='雇用'>
      <DescriptionList
        items={[
          {
            term: '雇用形態',
            description: member.employmentType,
          },
          {
            term: '入社日',
            description:
              member.hireDate === null ? null : dayNameOf(member.hireDate),
          },
          {
            term: '基本給',
            description:
              member.baseSalary === null
                ? null
                : amountOf(member.baseSalary, currency),
          },
          {
            term: '歩合率',
            description:
              member.commissionRate === null
                ? null
                : commissionNameOf(member.commissionRate),
          },
        ]}
      />
    </Card>
    <Card title='紹介'>
      <DescriptionList
        items={[
          {
            term: '専門',
            description: namesOrNone('専門', member.specialties),
          },
          {
            term: '資格',
            description: namesOrNone('資格', member.certifications),
          },
          {
            term: '経験年数',
            description:
              member.yearsOfExperience === null
                ? null
                : `${member.yearsOfExperience} 年`,
          },
          { term: '紹介文', description: writtenOrNone(member.bio) },
          {
            term: '写真の URL',
            description: member.imageUrl === null ? null : member.imageUrl,
          },
        ]}
      />
    </Card>
    <Card title='予約の受け方'>
      <DescriptionList
        items={[
          { term: '予約', description: bookingsNameOf(member) },
          {
            term: '同時に担当できる予約',
            description: `${member.maxConcurrentBookings} 件まで`,
          },
          {
            term: '予約の前に確保する時間',
            description: bufferNameOf(member.bufferTimeBefore),
          },
          {
            term: '予約の後に確保する時間',
            description: bufferNameOf(member.bufferTimeAfter),
          },
        ]}
      />
    </Card>
  </div>
)
