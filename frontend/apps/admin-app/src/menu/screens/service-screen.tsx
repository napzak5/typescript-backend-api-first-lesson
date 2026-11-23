import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  menuHrefOf,
  serviceChangeHrefOf,
  serviceHrefOf,
} from '../../navigation'
import { readServices, servicesKeyOf } from '../../salons/api/salons-api'
import {
  categoriesKeyOf,
  menuOf,
  readCategories,
  readService,
  serviceKeyOf,
} from '../api/menu-api'
import { ServiceRecord } from '../components/service-record/service-record'
import { MenuPartNotFound, useKeepsMenu } from './keeps-menu'

const { names, services: WORDS, titles, words } = adminMenuMessages

type ServicePartProps = { salon: ModelsSalonResponse; serviceId: string }

/**
 * A service of the menu, read whenever the screen opens, with the menu it
 * is named in: the categories, and the services a package is made of. An
 * account that changes the menu is offered to change the service.
 */
const ServicePart = ({ salon, serviceId }: ServicePartProps) => {
  const say = useSay()
  const keeps = useKeepsMenu()
  const service = useQuery({
    queryKey: serviceKeyOf(serviceId),
    queryFn: () => readService(salon.id, serviceId),
    staleTime: 0,
  })
  const categories = useQuery({
    queryKey: categoriesKeyOf(salon.id),
    queryFn: () => readCategories(salon.id),
  })
  const services = useQuery({
    queryKey: servicesKeyOf(salon.id),
    queryFn: () => readServices(salon.id),
  })
  const header = (actions?: ReactNode) => (
    <PageHeader
      title={say(titles.service)}
      description={salon.name}
      actions={actions}
    />
  )
  const retry = (): void => {
    void service.refetch()
    void categories.refetch()
    void services.refetch()
  }
  const retrying =
    service.isFetching || categories.isFetching || services.isFetching

  return match([service.data, menuOf(categories.data, services.data)])
    .with([{ type: 'notFound' }, P._], () => (
      <MenuPartNotFound salon={salon} said={WORDS.notFound} />
    ))
    .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([reason]) => (
      <>
        {header()}
        <UnreadNotice
          message={say(unreadMessageOf(names.service, reason))}
          onRetry={retry}
          pending={retrying}
        />
      </>
    ))
    .with(
      [P._, { type: P.union('notFound', 'tooManyRequests', 'failed') }],
      ([, reason]) => (
        <>
          {header()}
          <UnreadNotice
            message={say(unreadMessageOf(names.menu, reason))}
            onRetry={retry}
            pending={retrying}
          />
        </>
      ),
    )
    .with([undefined, P._], [P._, undefined], () => (
      <>
        {header()}
        <LoadingIndicator label={say(WORDS.loading)} />
      </>
    ))
    .with([{ type: 'found' }, { type: 'found' }], ([found, menu]) => (
      <>
        {header(
          keeps ? (
            <ButtonLink
              href={serviceChangeHrefOf(salon.id, found.service.id)}
              variant='primary'
            >
              {say(WORDS.change)}
            </ButtonLink>
          ) : undefined,
        )}
        <ServiceRecord
          service={found.service}
          categories={menu.categories}
          services={menu.services}
          currency={salon.currency}
          serviceHref={(id) => serviceHrefOf(salon.id, id)}
        />
        <ButtonLink href={menuHrefOf(salon.id)}>{say(words.toMenu)}</ButtonLink>
      </>
    ))
    .exhaustive()
}

/** A service of the menu of the salon of the address, for everybody who works there and an administrator. */
export const ServiceScreen = () => {
  const say = useSay()
  const { salonId = '', serviceId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.service)}>
      {(salon) => (
        <ServicePart key={serviceId} salon={salon} serviceId={serviceId} />
      )}
    </WithSalon>
  )
}
