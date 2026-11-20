import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { menuHrefOf, serviceChangeHrefOf, serviceHrefOf } from '../navigation'
import { unreadMessageOf } from '../reading'
import { readServices, servicesKeyOf } from '../salons/salons-api'
import { WithSalon } from '../salons/with-salon'
import { ServiceRecord } from './components/service-record/service-record'
import { useKeepsMenu } from './keeps-menu'
import {
  categoriesKeyOf,
  menuOf,
  readCategories,
  readService,
  serviceKeyOf,
} from './menu-api'

const TITLE = 'サービスの内容'

type ServicePartProps = { salon: ModelsSalonResponse; serviceId: string }

/** What a screen of a service says when there is none to show. */
export const ServiceNotFound = ({ salon }: { salon: ModelsSalonResponse }) => (
  <>
    <PageHeader
      title='サービスが見つかりません'
      description='アドレスが正しいか、お確かめください。メニューから削除したサービスは、表示できません。'
    />
    <p>
      <ButtonLink href={menuHrefOf(salon.id)} variant='secondary'>
        メニューへ
      </ButtonLink>
    </p>
  </>
)

/**
 * A service of the menu, read whenever the screen opens, with the menu it
 * is named in: the categories, and the services a package is made of. An
 * account that changes the menu is offered to change the service.
 */
const ServicePart = ({ salon, serviceId }: ServicePartProps) => {
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
  const header = <PageHeader title={TITLE} description={salon.name} />
  const retry = (): void => {
    void service.refetch()
    void categories.refetch()
    void services.refetch()
  }
  const retrying =
    service.isFetching || categories.isFetching || services.isFetching

  return match([service.data, menuOf(categories.data, services.data)])
    .with([{ type: 'notFound' }, P._], () => <ServiceNotFound salon={salon} />)
    .with([{ type: P.union('tooManyRequests', 'failed') }, P._], ([reason]) => (
      <>
        {header}
        <UnreadNotice
          message={unreadMessageOf('サービス', reason)}
          onRetry={retry}
          retrying={retrying}
        />
      </>
    ))
    .with(
      [P._, { type: P.union('notFound', 'tooManyRequests', 'failed') }],
      ([, reason]) => (
        <>
          {header}
          <UnreadNotice
            message={unreadMessageOf('メニュー', reason)}
            onRetry={retry}
            retrying={retrying}
          />
        </>
      ),
    )
    .with([undefined, P._], [P._, undefined], () => (
      <>
        {header}
        <LoadingIndicator label='サービスを読み込んでいます' />
      </>
    ))
    .with([{ type: 'found' }, { type: 'found' }], ([found, menu]) => (
      <>
        <PageHeader
          title={TITLE}
          description={salon.name}
          actions={
            keeps ? (
              <ButtonLink
                href={serviceChangeHrefOf(salon.id, found.service.id)}
                variant='primary'
              >
                サービスを直す
              </ButtonLink>
            ) : undefined
          }
        />
        <ServiceRecord
          service={found.service}
          categories={menu.categories}
          services={menu.services}
          currency={salon.currency}
          serviceHref={(id) => serviceHrefOf(salon.id, id)}
        />
        <p>
          <ButtonLink href={menuHrefOf(salon.id)} variant='secondary'>
            メニューへ
          </ButtonLink>
        </p>
      </>
    ))
    .exhaustive()
}

/** A service of the menu of the salon of the address, for everybody who works there and an administrator. */
export const ServiceScreen = () => {
  const { salonId = '', serviceId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <ServicePart key={serviceId} salon={salon} serviceId={serviceId} />
      )}
    </WithSalon>
  )
}
