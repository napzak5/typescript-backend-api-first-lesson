import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  Card,
  DescriptionList,
  Link,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { dayNameOf, momentNameAt } from '../../../salon-time'
import { type Referrer, referrerNameOf } from '../../customer-form'
import { countNameOf } from '../../customer-format'
import styles from './customer-record.module.css'
import { ledgerItemsOf } from './ledger-items'

export type CustomerRecordProps = {
  customer: ModelsCustomerResponse
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The address of the screen that changes the customer */
  changeHref: string
  /** The address of the screen that enters a booking of the customer at the salon */
  bookingHref: string
  /** The address of the points of the customer: the balance, the history, and their recording */
  pointsHref: string
  /** The address of the page of another customer: the one who referred this one */
  customerHref: (customerId: string) => string
  /**
   * The customer who referred this one, as they were read to be named;
   * `undefined` while they are read, or when they could not be
   */
  referrer: Referrer | undefined
}

/**
 * The customer who referred another: their name, which leads to their
 * page, once they were read; until then the page is led to all the same.
 * One who was removed from the ledger has no page to lead to.
 */
const referrerShownOf = (
  referredBy: string | null,
  referrer: Referrer | undefined,
  customerHref: (customerId: string) => string,
) =>
  referredBy === null
    ? null
    : match(referrer)
        .with({ type: 'customer' }, (named) => (
          <Link href={customerHref(named.id)}>{referrerNameOf(named)}</Link>
        ))
        .with({ type: 'gone' }, (gone) => referrerNameOf(gone))
        .with(undefined, { type: 'none' }, () => (
          <Link href={customerHref(referredBy)}>紹介したお客様</Link>
        ))
        .exhaustive()

/** A day the ledger keeps, or that there is none. */
const dayOrNone = (day: string | null, none: string): string =>
  day === null ? none : dayNameOf(day)

/**
 * What the ledger keeps of a customer: who they are and how to reach them,
 * their hair and what they like, how the salon treats them, and the notes;
 * then their visits and points, which the bookings and the sales keep up.
 * What was not given is said to be missing.
 */
export const CustomerRecord = ({
  customer,
  timezone,
  changeHref,
  bookingHref,
  pointsHref,
  customerHref,
  referrer,
}: CustomerRecordProps) => (
  <div className={styles['record']}>
    <Card
      title='台帳'
      actions={
        <>
          <ButtonLink href={bookingHref} variant='primary'>
            予約を入れる
          </ButtonLink>
          <ButtonLink href={changeHref} variant='secondary'>
            台帳を直す
          </ButtonLink>
        </>
      }
    >
      <DescriptionList
        items={[
          ...ledgerItemsOf(
            customer,
            referrerShownOf(customer.referredBy, referrer, customerHref),
          ),
          {
            term: '登録日時',
            description: momentNameAt(customer.createdAt, timezone),
          },
          {
            term: '最後に直した日時',
            description: momentNameAt(customer.updatedAt, timezone),
          },
        ]}
      />
    </Card>
    <Card
      title='来店とポイント'
      actions={
        <ButtonLink href={pointsHref} variant='secondary'>
          ポイントの履歴
        </ButtonLink>
      }
    >
      <DescriptionList
        items={[
          {
            term: '初回来店日',
            description: dayOrNone(customer.firstVisitDate, '来店なし'),
          },
          {
            term: '最終来店日',
            description: dayOrNone(customer.lastVisitDate, '来店なし'),
          },
          {
            term: '来店回数',
            description: countNameOf(customer.visitCount, '回'),
          },
          {
            term: '無断キャンセル',
            description: countNameOf(customer.noShowCount, '回'),
          },
          {
            term: 'キャンセル',
            description: countNameOf(customer.cancellationCount, '回'),
          },
          {
            term: 'ポイント',
            description: countNameOf(customer.loyaltyPoints, 'ポイント'),
          },
        ]}
      />
    </Card>
  </div>
)
