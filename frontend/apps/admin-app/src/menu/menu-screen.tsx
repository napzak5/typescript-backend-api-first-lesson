import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  categoryChangeHrefOf,
  categoryEntryHrefOf,
  serviceEntryHrefOf,
  serviceHrefOf,
} from '../navigation'
import { unreadMessageOf } from '../reading'
import { readServices, servicesKeyOf } from '../salons/salons-api'
import { WithSalon } from '../salons/with-salon'
import { CategoryTable } from './components/category-table/category-table'
import { MenuSections } from './components/menu-sections/menu-sections'
import { useKeepsMenu } from './keeps-menu'
import { categoriesKeyOf, menuOf, readCategories } from './menu-api'
import styles from './menu-screen.module.css'

const TITLE = 'メニュー'

type MenuPartProps = { salon: ModelsSalonResponse }

/**
 * The menu of the salon as it is kept, read whenever the screen opens: the
 * services by category, and the categories. An account that changes the
 * menu is offered to add a service and a category, and to change each
 * category; a service is changed from its page.
 */
const MenuPart = ({ salon }: MenuPartProps) => {
  const keeps = useKeepsMenu()
  const servicesName = useId()
  const categories = useQuery({
    queryKey: categoriesKeyOf(salon.id),
    queryFn: () => readCategories(salon.id),
    staleTime: 0,
  })
  const services = useQuery({
    queryKey: servicesKeyOf(salon.id),
    queryFn: () => readServices(salon.id),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader
        title={TITLE}
        description={salon.name}
        actions={
          keeps ? (
            <>
              <ButtonLink href={serviceEntryHrefOf(salon.id)} variant='primary'>
                サービスを足す
              </ButtonLink>
              <ButtonLink
                href={categoryEntryHrefOf(salon.id)}
                variant='secondary'
              >
                カテゴリーを足す
              </ButtonLink>
            </>
          ) : undefined
        }
      />
      {match(menuOf(categories.data, services.data))
        .with(undefined, () => (
          <LoadingIndicator label='メニューを読み込んでいます' />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={unreadMessageOf('メニュー', reason)}
              onRetry={() => {
                void categories.refetch()
                void services.refetch()
              }}
              retrying={categories.isFetching || services.isFetching}
            />
          ),
        )
        .with({ type: 'found' }, ({ categories: kept, services: offered }) => (
          <div className={styles['parts']}>
            <section className={styles['part']} aria-labelledby={servicesName}>
              <h2 className={styles['name']} id={servicesName}>
                サービス
              </h2>
              {kept.length === 0 && offered.length === 0 ? (
                <EmptyState
                  title='メニューにサービスはありません'
                  description='カテゴリーを足して、メニューを分けておけます。'
                />
              ) : (
                <MenuSections
                  categories={kept}
                  services={offered}
                  currency={salon.currency}
                  serviceHref={(id) => serviceHrefOf(salon.id, id)}
                />
              )}
            </section>
            {/* The frame of the table is the region of the categories, named by its caption */}
            <div className={styles['part']}>
              <h2 className={styles['name']}>カテゴリー</h2>
              <CategoryTable
                categories={kept}
                changeHref={
                  keeps ? (id) => categoryChangeHrefOf(salon.id, id) : undefined
                }
              />
            </div>
          </div>
        ))
        .exhaustive()}
    </>
  )
}

/** The menu of the salon of the address, for everybody who works there and an administrator. */
export const MenuScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <MenuPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
