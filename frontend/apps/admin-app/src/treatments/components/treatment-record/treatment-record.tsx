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
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  adminInventoryMessages,
  adminMenuMessages,
  adminStaffMessages,
  adminTreatmentMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import {
  serviceNameOf,
  staffNameOf,
} from '../../../bookings/utils/day-bookings'
import { productNameOf } from '../../../inventory/utils/stock-format'
import { quantityOf } from '../../../products/utils/quantity'
import {
  customerCalled,
  satisfactionNameOf,
  wasChanged,
} from '../../utils/treatment-format'
import styles from './treatment-record.module.css'

const { record: WORDS } = adminTreatmentMessages

export type TreatmentRecordProps = {
  record: ModelsTreatmentRecordResponse
  /** The time zone of the salon, which the moments are shown in */
  timezone: string
  /** The booking, as the record names it: 「BK-4F7H-2KQM（2026年11月20日（金））」 */
  bookingName: LocalizedText
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
  const say = useSay()
  const servicesOf = (ids: readonly string[]): string[] =>
    ids.map(
      (id) =>
        serviceNameOf(id, services) ?? say(adminMenuMessages.removedService),
    )

  return (
    <div className={styles['record']}>
      <Card title={say(WORDS.treatment)} actions={actions}>
        <DescriptionList
          items={[
            {
              term: say(WORDS.customer),
              description:
                customer === undefined ? (
                  say(customerCalled(customer))
                ) : (
                  <Link href={customerHref}>
                    {say(customerCalled(customer))}
                  </Link>
                ),
            },
            {
              term: say(WORDS.booking),
              description: <Link href={bookingHref}>{say(bookingName)}</Link>,
            },
            {
              term: say(WORDS.staff),
              description:
                staffNameOf(record.staffId, staff) ??
                say(adminStaffMessages.unlisted),
            },
            {
              term: say(WORDS.services),
              description: (
                <TagList
                  label={say(WORDS.services)}
                  items={servicesOf(record.services)}
                />
              ),
            },
            {
              term: say(WORDS.techniques),
              description: (
                <TagList
                  label={say(WORDS.techniques)}
                  items={record.techniques}
                />
              ),
            },
            {
              term: say(WORDS.processingTime),
              description:
                record.processingTime === null
                  ? null
                  : say(formats.minutesOf(record.processingTime)),
            },
            {
              term: say(WORDS.writtenAt),
              description: say(momentNameAt(record.createdAt, timezone)),
            },
            ...(wasChanged(record)
              ? [
                  {
                    term: say(WORDS.changedAt),
                    description: say(momentNameAt(record.updatedAt, timezone)),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      <Card title={say(WORDS.consultation)}>
        <DescriptionList
          items={[
            {
              term: say(WORDS.consultationNotes),
              description: (
                <WrittenText>{record.consultationNotes}</WrittenText>
              ),
            },
            {
              term: say(WORDS.scalpCondition),
              description: <WrittenText>{record.scalpCondition}</WrittenText>,
            },
            {
              term: say(WORDS.hairCondition),
              description: <WrittenText>{record.hairCondition}</WrittenText>,
            },
            {
              term: say(WORDS.colorFormula),
              description: <WrittenText>{record.colorFormula}</WrittenText>,
            },
          ]}
        />
      </Card>
      <Card title={say(WORDS.materials)}>
        <Table<Row>
          caption={say(WORDS.materialList)}
          captionHidden
          columns={[
            {
              key: 'product',
              header: say(WORDS.product),
              cell: ({ material: { productId } }) =>
                say(productNameOf(products.find(({ id }) => id === productId))),
            },
            {
              key: 'quantity',
              header: say(WORDS.quantity),
              cell: ({ material: { quantity, unit } }) =>
                say(adminInventoryMessages.inUnit(quantityOf(quantity), unit)),
            },
            {
              key: 'lotNumber',
              header: say(WORDS.lotNumber),
              cell: ({ material: { lotNumber } }) => lotNumber,
            },
            {
              key: 'notes',
              header: say(WORDS.notes),
              wrap: 'lines',
              cell: ({ material: { notes } }) => notes,
            },
          ]}
          rows={record.materials.map((material, place) => ({
            place,
            material,
          }))}
          // The materials have no IDs: a row is its place in the list
          rowKey={({ place }) => String(place)}
          emptyMessage={say(WORDS.noMaterials)}
        />
      </Card>
      <Card title={say(WORDS.result)}>
        <DescriptionList
          items={[
            {
              term: say(WORDS.resultNotes),
              description: <WrittenText>{record.resultNotes}</WrittenText>,
            },
            {
              term: say(WORDS.satisfaction),
              description: say(
                record.customerSatisfaction === null
                  ? WORDS.notAnswered
                  : satisfactionNameOf(record.customerSatisfaction),
              ),
            },
            {
              term: say(WORDS.nextRecommendedDate),
              description:
                record.nextRecommendedDate === null
                  ? null
                  : say(dayNameOf(record.nextRecommendedDate)),
            },
            {
              term: say(WORDS.nextRecommendedServices),
              description: (
                <TagList
                  label={say(WORDS.nextRecommendedServices)}
                  items={servicesOf(record.nextRecommendedServices)}
                />
              ),
            },
            {
              term: say(WORDS.homeCareSuggestions),
              description: (
                <WrittenText>{record.homeCareSuggestions}</WrittenText>
              ),
            },
            {
              term: say(WORDS.staffEvaluation),
              description: <WrittenText>{record.staffEvaluation}</WrittenText>,
            },
          ]}
        />
      </Card>
    </div>
  )
}
