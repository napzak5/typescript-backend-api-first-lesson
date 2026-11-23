import type { ModelsServiceResponse } from '@beauty-salon-frontend/api-client'
import { Badge, Link, Note, useSay } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { useId } from 'react'
import { match } from 'ts-pattern'
import { type MenuGroup, type Price, priceOf } from '../../utils/salon-menu'
import styles from './service-menu.module.css'

const { menu: words } = portalSalonMessages

export type ServiceMenuProps = {
  /** The parts of the menu, in their order; at least one */
  groups: readonly MenuGroup[]
  /** The currency the salon names its prices in (`JPY`) */
  currency: string
  /**
   * The address of the screen where a service is booked. Without it no
   * service leads there: the salon takes no bookings
   */
  bookingHref?: BookingHref | undefined
}

type BookingHref = (service: ModelsServiceResponse) => string

const PriceText = ({ price }: { price: Price }) => {
  const say = useSay()

  return match(price)
    .with({ type: 'onConsultation' }, () => <>{say(words.onConsultation)}</>)
    .with({ type: 'amount' }, ({ amount, before, orMore, tax }) => (
      <>
        {before !== null && (
          <span className={styles['before']}>
            {say(words.regularPrice(before))}
          </span>
        )}
        <span className={styles['amount']}>
          {say(orMore ? words.orMore(amount) : amount)}
        </span>
        <span className={styles['tax']}>{say(tax)}</span>
      </>
    ))
    .exhaustive()
}

type ServiceRowProps = {
  service: ModelsServiceResponse
  currency: string
  bookingHref: BookingHref | undefined
}

const ServiceRow = ({ service, currency, bookingHref }: ServiceRowProps) => {
  const say = useSay()
  const said = service.shortDescription ?? service.description

  return (
    <li className={styles['service']}>
      <div className={styles['what']}>
        <p className={styles['name']}>{service.name}</p>
        {said !== null && <Note size='small'>{said}</Note>}
        {(service.requiresConsultation || !service.allowOnlineBooking) && (
          <p>
            {service.requiresConsultation && (
              <Badge className={styles['mark']} tone='info'>
                {say(words.consultationRequired)}
              </Badge>
            )}
            {!service.allowOnlineBooking && (
              <Badge className={styles['mark']}>
                {say(words.noOnlineBooking)}
              </Badge>
            )}
          </p>
        )}
        {bookingHref !== undefined && service.allowOnlineBooking && (
          <p>
            {/* Every service has this link: its name says which one it books */}
            <Link
              href={bookingHref(service)}
              aria-label={say(words.bookOf(service.name))}
            >
              {say(words.book)}
            </Link>
          </p>
        )}
      </div>
      <p className={styles['duration']}>
        {say(formats.durationOf(service.duration))}
      </p>
      <p className={styles['price']}>
        <PriceText price={priceOf(service, currency)} />
      </p>
    </li>
  )
}

type MenuPartProps = {
  group: MenuGroup
  currency: string
  bookingHref: BookingHref | undefined
}

const MenuPart = ({ group, currency, bookingHref }: MenuPartProps) => {
  const say = useSay()
  const headingId = useId()

  return (
    <div className={styles['part']}>
      <h3 className={styles['category']} id={headingId}>
        {group.type === 'category' ? group.name : say(words.unsorted)}
      </h3>
      {group.type === 'category' && group.description !== null && (
        <Note size='small'>{group.description}</Note>
      )}
      <ul className={styles['services']} aria-labelledby={headingId}>
        {group.services.map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            currency={currency}
            bookingHref={bookingHref}
          />
        ))}
      </ul>
    </div>
  )
}

/**
 * The menu of a salon: under each category its services, each with how long
 * it takes and what it costs, and the way to book it where a customer can
 * do that themselves.
 */
export const ServiceMenu = ({
  groups,
  currency,
  bookingHref,
}: ServiceMenuProps) => (
  <div className={styles['menu']}>
    {groups.map((group) => (
      <MenuPart
        key={group.type === 'category' ? group.id : group.type}
        group={group}
        currency={currency}
        bookingHref={bookingHref}
      />
    ))}
  </div>
)
