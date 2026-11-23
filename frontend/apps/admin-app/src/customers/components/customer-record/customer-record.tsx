import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { dayNameOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  Card,
  DescriptionList,
  Link,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { type Referrer, referrerNameOf } from '../../utils/customer-form'
import styles from './customer-record.module.css'
import { ledgerItemsOf } from './ledger-items'

const { record: words, referrer: referrerWords } = adminCustomerMessages
const { visits, chart } = words

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
  /** The address of the chart of the customer: what the staff makes sure of before a treatment */
  chartHref: string
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
  say: (message: LocalizedText) => string,
) =>
  referredBy === null
    ? null
    : match(referrer)
        .with({ type: 'customer' }, (named) => (
          <Link href={customerHref(named.id)}>
            {say(referrerNameOf(named))}
          </Link>
        ))
        .with({ type: 'gone' }, (gone) => say(referrerNameOf(gone)))
        .with(undefined, { type: 'none' }, () => (
          <Link href={customerHref(referredBy)}>{say(referrerWords.link)}</Link>
        ))
        .exhaustive()

/** A day the ledger keeps, or that there was no visit. */
const dayOrNone = (day: string | null): LocalizedText =>
  day === null ? visits.none : dayNameOf(day)

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
  chartHref,
  customerHref,
  referrer,
}: CustomerRecordProps) => {
  const say = useSay()

  return (
    <div className={styles['record']}>
      <Card
        title={say(words.title)}
        actions={
          <>
            <ButtonLink href={bookingHref} variant='primary'>
              {say(words.book)}
            </ButtonLink>
            <ButtonLink href={changeHref}>{say(words.change)}</ButtonLink>
          </>
        }
      >
        <DescriptionList
          items={[
            ...ledgerItemsOf(
              customer,
              referrerShownOf(customer.referredBy, referrer, customerHref, say),
              say,
            ),
            {
              term: say(words.createdAt),
              description: say(momentNameAt(customer.createdAt, timezone)),
            },
            {
              term: say(words.updatedAt),
              description: say(momentNameAt(customer.updatedAt, timezone)),
            },
          ]}
        />
      </Card>
      <Card
        title={say(visits.title)}
        actions={
          <ButtonLink href={pointsHref}>{say(visits.pointHistory)}</ButtonLink>
        }
      >
        <DescriptionList
          items={[
            {
              term: say(visits.firstVisit),
              description: say(dayOrNone(customer.firstVisitDate)),
            },
            {
              term: say(visits.lastVisit),
              description: say(dayOrNone(customer.lastVisitDate)),
            },
            {
              term: say(visits.visits),
              description: say(visits.visitsOf(customer.visitCount)),
            },
            {
              term: say(visits.noShows),
              description: say(visits.noShowsOf(customer.noShowCount)),
            },
            {
              term: say(visits.cancellations),
              description: say(
                visits.cancellationsOf(customer.cancellationCount),
              ),
            },
            {
              term: say(visits.points),
              description: say(visits.pointsOf(customer.loyaltyPoints)),
            },
          ]}
        />
      </Card>
      <Card
        title={say(chart.title)}
        actions={<ButtonLink href={chartHref}>{say(chart.open)}</ButtonLink>}
      >
        <p>{say(chart.about)}</p>
      </Card>
    </div>
  )
}
