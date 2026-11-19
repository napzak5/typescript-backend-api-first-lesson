import type { ModelsServiceResponse } from '@beauty-salon-frontend/api-client'
import { Badge } from '@beauty-salon-frontend/ui'
import { useId } from 'react'
import { match } from 'ts-pattern'
import { durationOf } from '../../salon-format'
import { type MenuGroup, type Price, priceOf } from '../../salon-menu'
import styles from './service-menu.module.css'

export type ServiceMenuProps = {
  /** The parts of the menu, in their order; at least one */
  groups: readonly MenuGroup[]
  /** The currency the salon names its prices in (`JPY`) */
  currency: string
}

const PriceText = ({ price }: { price: Price }) =>
  match(price)
    .with({ type: 'onConsultation' }, () => <>要相談</>)
    .with({ type: 'amount' }, ({ amount, before, orMore, tax }) => (
      <>
        {before !== null && (
          <span className={styles['before']}>通常 {before}</span>
        )}
        <span className={styles['amount']}>
          {amount}
          {orMore && '〜'}
        </span>
        <span className={styles['tax']}>（{tax}）</span>
      </>
    ))
    .exhaustive()

type ServiceRowProps = {
  service: ModelsServiceResponse
  currency: string
}

const ServiceRow = ({ service, currency }: ServiceRowProps) => {
  const said = service.shortDescription ?? service.description

  return (
    <li className={styles['service']}>
      <div className={styles['what']}>
        <p className={styles['name']}>{service.name}</p>
        {said !== null && <p className={styles['said']}>{said}</p>}
        {(service.requiresConsultation || !service.allowOnlineBooking) && (
          <p>
            {service.requiresConsultation && (
              <Badge className={styles['mark']} tone='info'>
                要カウンセリング
              </Badge>
            )}
            {!service.allowOnlineBooking && (
              <Badge className={styles['mark']}>オンライン予約不可</Badge>
            )}
          </p>
        )}
      </div>
      <p className={styles['duration']}>{durationOf(service.duration)}</p>
      <p className={styles['price']}>
        <PriceText price={priceOf(service, currency)} />
      </p>
    </li>
  )
}

type MenuPartProps = {
  group: MenuGroup
  currency: string
}

const MenuPart = ({ group, currency }: MenuPartProps) => {
  const headingId = useId()

  return (
    <div className={styles['part']}>
      <h3 className={styles['category']} id={headingId}>
        {group.name}
      </h3>
      {group.description !== null && (
        <p className={styles['said']}>{group.description}</p>
      )}
      <ul className={styles['services']} aria-labelledby={headingId}>
        {group.services.map((service) => (
          <ServiceRow key={service.id} service={service} currency={currency} />
        ))}
      </ul>
    </div>
  )
}

/**
 * The menu of a salon: under each category its services, each with how long
 * it takes and what it costs.
 */
export const ServiceMenu = ({ groups, currency }: ServiceMenuProps) => (
  <div className={styles['menu']}>
    {groups.map((group) => (
      <MenuPart key={group.id ?? ''} group={group} currency={currency} />
    ))}
  </div>
)
