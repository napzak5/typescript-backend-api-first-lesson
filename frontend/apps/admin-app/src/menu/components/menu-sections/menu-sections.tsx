import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { Link, Table, useSay } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  categoriesById,
  categoryLineOf,
  menuSectionsOf,
  onlineBookingOf,
  priceLineOf,
  serviceStateOf,
} from '../../utils/menu-format'
import styles from './menu-sections.module.css'

const { sections: WORDS } = adminMenuMessages.services

export type MenuSectionsProps = {
  /** The categories of the salon, in the order of the menu */
  categories: readonly ModelsServiceCategoryResponse[]
  /** The services of the salon, in the order of the menu */
  services: readonly ModelsServiceResponse[]
  currency: string
  /** The address of a service */
  serviceHref: (serviceId: string) => string
}

/**
 * The menu as it is kept: a table of services for every category, in the
 * order of the menu, each named with the categories it is below, and last
 * the services of no category. Every service is in it, those switched off
 * as well; its name leads to the service.
 */
export const MenuSections = ({
  categories,
  services,
  currency,
  serviceHref,
}: MenuSectionsProps) => {
  const say = useSay()
  const byId = categoriesById(categories)

  return (
    <div className={styles['sections']}>
      {menuSectionsOf(categories, services).map(({ category, services }) => (
        <Table
          key={category?.id ?? 'none'}
          caption={say(categoryLineOf(category, byId))}
          columns={[
            {
              key: 'name',
              header: say(WORDS.service),
              cell: (service) => (
                <Link href={serviceHref(service.id)}>{service.name}</Link>
              ),
            },
            {
              key: 'duration',
              header: say(WORDS.duration),
              cell: ({ duration }) => say(formats.minutesOf(duration)),
              align: 'end',
            },
            {
              key: 'price',
              header: say(WORDS.price),
              cell: (service) => say(priceLineOf(service, currency)),
            },
            {
              key: 'allowOnlineBooking',
              header: say(WORDS.onlineBooking),
              cell: ({ allowOnlineBooking }) =>
                say(onlineBookingOf(allowOnlineBooking)),
            },
            {
              key: 'state',
              header: say(WORDS.status),
              cell: (service) => say(serviceStateOf(service)),
            },
          ]}
          rows={services}
          rowKey={({ id }) => id}
          emptyMessage={say(WORDS.empty)}
        />
      ))}
    </div>
  )
}
