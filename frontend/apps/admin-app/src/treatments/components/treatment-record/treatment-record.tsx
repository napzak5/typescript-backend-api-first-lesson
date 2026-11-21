import type {
  ModelsCustomerResponse,
  ModelsProductResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
  ModelsTreatmentMaterial,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import { dayNameOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  Link,
  Table,
  TagList,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { UNLISTED_STAFF } from '../../../bookings/booking-format'
import { serviceNameOf, staffNameOf } from '../../../bookings/day-bookings'
import {
  customerCalled,
  minutesNameOf,
  NOT_ANSWERED,
  NOT_RECORDED,
  productNameOf,
  quantityNameOf,
  REMOVED_PRODUCT,
  satisfactionNameOf,
  wasChanged,
} from '../../treatment-format'
import styles from './treatment-record.module.css'

export type TreatmentRecordProps = {
  record: ModelsTreatmentRecordResponse
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  /** The booking, as the record names it: 「BK-4F7H-2KQM（2026年11月20日（金））」 */
  bookingName: string
  bookingHref: string
  /** The customer; `undefined` for one who left the ledger */
  customer: Pick<ModelsCustomerResponse, 'lastName' | 'firstName'> | undefined
  customerHref: string
  /** The members of the staff of the salon */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** The services of the salon */
  services: readonly Pick<ModelsServiceResponse, 'id' | 'name'>[]
  /** The products of the salon */
  products: readonly Pick<
    ModelsProductResponse,
    'id' | 'name' | 'productCode'
  >[]
  /** What can be done with the record: changing it, removing it */
  actions?: ReactNode
}

/** A material of the record, at its place in the list */
type Row = { place: number; material: ModelsTreatmentMaterial }

const writtenOrNone = (text: string | null) =>
  text === null ? NOT_RECORDED : <p className={styles['written']}>{text}</p>

const namesOrNone = (label: string, names: readonly string[]) =>
  names.length === 0 ? NOT_RECORDED : <TagList label={label} items={names} />

/**
 * A treatment record, as a member of the staff reads it before the next
 * treatment: what was done and by whom, the counselling and the state of
 * the scalp and of the hair with the colour formula, the materials used
 * with their lots, and what came of it with what was recommended next.
 * What was not recorded is said to be so.
 */
export const TreatmentRecord = ({
  record,
  timezone,
  bookingName,
  bookingHref,
  customer,
  customerHref,
  staff,
  services,
  products,
  actions,
}: TreatmentRecordProps) => {
  const servicesOf = (ids: readonly string[]): string[] =>
    ids.map((id) => serviceNameOf(id, services))

  return (
    <div className={styles['record']}>
      <Card title='施術' actions={actions}>
        <DescriptionList
          items={[
            {
              term: 'お客様',
              description:
                customer === undefined ? (
                  customerCalled(customer)
                ) : (
                  <Link href={customerHref}>{customerCalled(customer)}</Link>
                ),
            },
            {
              term: '予約',
              description: <Link href={bookingHref}>{bookingName}</Link>,
            },
            {
              term: '担当',
              description: staffNameOf(record.staffId, staff) ?? UNLISTED_STAFF,
            },
            {
              term: '提供したサービス',
              description: (
                <TagList
                  label='提供したサービス'
                  items={servicesOf(record.services)}
                />
              ),
            },
            {
              term: '技法',
              description: namesOrNone('技法', record.techniques),
            },
            {
              term: '施術時間',
              description:
                record.processingTime === null
                  ? NOT_RECORDED
                  : minutesNameOf(record.processingTime),
            },
            {
              term: '書いた日時',
              description: momentNameAt(record.createdAt, timezone),
            },
            ...(wasChanged(record)
              ? [
                  {
                    term: '最後に直した日時',
                    description: momentNameAt(record.updatedAt, timezone),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      <Card title='カウンセリングと状態'>
        <DescriptionList
          items={[
            {
              term: 'カウンセリングのメモ',
              description: writtenOrNone(record.consultationNotes),
            },
            {
              term: '頭皮の状態',
              description: writtenOrNone(record.scalpCondition),
            },
            {
              term: '毛髪の状態',
              description: writtenOrNone(record.hairCondition),
            },
            {
              term: 'カラー剤の配合',
              description: writtenOrNone(record.colorFormula),
            },
          ]}
        />
      </Card>
      <Card title='使った商材'>
        <Table<Row>
          caption='使った商材の一覧'
          captionHidden
          columns={[
            {
              key: 'product',
              header: '商品',
              cell: ({ material: { productId } }) => {
                const product = products.find(({ id }) => id === productId)

                return product === undefined
                  ? REMOVED_PRODUCT
                  : productNameOf(product)
              },
            },
            {
              key: 'quantity',
              header: '量',
              cell: ({ material }) => quantityNameOf(material),
            },
            {
              key: 'lotNumber',
              header: 'ロット番号',
              cell: ({ material: { lotNumber } }) => lotNumber ?? '',
            },
            {
              key: 'notes',
              header: 'メモ',
              cell: ({ material: { notes } }) =>
                notes === null ? (
                  ''
                ) : (
                  <span className={styles['notes']}>{notes}</span>
                ),
            },
          ]}
          rows={record.materials.map((material, place) => ({
            place,
            material,
          }))}
          // The materials have no IDs: a row is its place in the list
          rowKey={({ place }) => String(place)}
          emptyMessage='使った商材はありません'
        />
      </Card>
      <Card title='結果と次回'>
        <DescriptionList
          items={[
            {
              term: '結果のメモ',
              description: writtenOrNone(record.resultNotes),
            },
            {
              term: 'お客様の満足度',
              description:
                record.customerSatisfaction === null
                  ? NOT_ANSWERED
                  : satisfactionNameOf(record.customerSatisfaction),
            },
            {
              term: '次に勧める日',
              description:
                record.nextRecommendedDate === null
                  ? NOT_RECORDED
                  : dayNameOf(record.nextRecommendedDate),
            },
            {
              term: '次に勧めるサービス',
              description: namesOrNone(
                '次に勧めるサービス',
                servicesOf(record.nextRecommendedServices),
              ),
            },
            {
              term: 'ホームケアの提案',
              description: writtenOrNone(record.homeCareSuggestions),
            },
            {
              term: '申し送り',
              description: writtenOrNone(record.staffEvaluation),
            },
          ]}
        />
      </Card>
    </div>
  )
}
