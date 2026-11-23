import { unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  categoryChangeHrefOf,
  categoryEntryHrefOf,
  serviceEntryHrefOf,
  serviceHrefOf,
  servicesChangeHrefOf,
} from '../../navigation'
import { readServices, servicesKeyOf } from '../../salons/api/salons-api'
import { categoriesKeyOf, menuOf, readCategories } from '../api/menu-api'
import { CategoryTable } from '../components/category-table/category-table'
import { MenuSections } from '../components/menu-sections/menu-sections'
import { useKeepsMenu } from './keeps-menu'
import styles from './menu-screen.module.css'

const { menu: WORDS, names, titles, words } = adminMenuMessages

type MenuPartProps = { salon: ModelsSalonResponse }

/**
 * The menu of the salon as it is kept, read whenever the screen opens: the
 * services by category, and the categories. An account that changes the
 * menu is offered to add a service and a category, to change several
 * services at once, and to change each category; a service is changed
 * from its page.
 */
const MenuPart = ({ salon }: MenuPartProps) => {
  const say = useSay()
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
        title={say(titles.menu)}
        description={salon.name}
        actions={
          keeps ? (
            <ButtonLink href={serviceEntryHrefOf(salon.id)} variant='primary'>
              {say(WORDS.addService)}
            </ButtonLink>
          ) : undefined
        }
        otherActions={
          keeps ? (
            <>
              <ButtonLink href={categoryEntryHrefOf(salon.id)}>
                {say(WORDS.addCategory)}
              </ButtonLink>
              <ButtonLink href={servicesChangeHrefOf(salon.id)}>
                {say(WORDS.changeServices)}
              </ButtonLink>
            </>
          ) : undefined
        }
      />
      {match(menuOf(categories.data, services.data))
        .with(undefined, () => (
          <LoadingIndicator label={say(words.loadingMenu)} />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.menu, reason))}
              onRetry={() => {
                void categories.refetch()
                void services.refetch()
              }}
              pending={categories.isFetching || services.isFetching}
            />
          ),
        )
        .with({ type: 'found' }, ({ categories: kept, services: offered }) => (
          <div className={styles['parts']}>
            <section className={styles['part']} aria-labelledby={servicesName}>
              <h2 className={styles['name']} id={servicesName}>
                {say(WORDS.services)}
              </h2>
              {kept.length === 0 && offered.length === 0 ? (
                <EmptyState
                  title={say(WORDS.empty)}
                  description={say(WORDS.emptyDescription)}
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
              <h2 className={styles['name']}>{say(WORDS.categories)}</h2>
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
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.menu)}>
      {(salon) => <MenuPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
