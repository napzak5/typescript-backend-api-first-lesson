import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { Link, Table } from '@beauty-salon-frontend/ui'
import { minutesNameOf } from '../../../treatments/utils/treatment-format'
import {
  categoriesById,
  categoryPathOf,
  menuSectionsOf,
  priceLineOf,
  serviceStateOf,
} from '../../utils/menu-format'
import styles from './menu-sections.module.css'

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
  const byId = categoriesById(categories)

  return (
    <div className={styles['sections']}>
      {menuSectionsOf(categories, services).map(({ category, services }) => (
        <Table
          key={category?.id ?? 'none'}
          caption={
            category === null ? '未分類' : categoryPathOf(category, byId)
          }
          columns={[
            {
              key: 'name',
              header: 'サービス',
              cell: (service) => (
                <Link href={serviceHref(service.id)}>{service.name}</Link>
              ),
            },
            {
              key: 'duration',
              header: '所要時間',
              cell: ({ duration }) => minutesNameOf(duration),
              align: 'end',
            },
            {
              key: 'price',
              header: '料金',
              cell: (service) => priceLineOf(service, currency),
            },
            {
              key: 'allowOnlineBooking',
              header: 'オンライン予約',
              cell: ({ allowOnlineBooking }) =>
                allowOnlineBooking ? '受ける' : '受けない',
            },
            {
              key: 'state',
              header: '状態',
              cell: (service) => serviceStateOf(service),
            },
          ]}
          rows={services}
          rowKey={({ id }) => id}
          emptyMessage='このカテゴリーのサービスはありません'
        />
      ))}
    </div>
  )
}
