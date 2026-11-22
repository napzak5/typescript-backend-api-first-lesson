import { NOT_FOUND, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsServiceCategoryResponse,
  ModelsServiceCreateRequest,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { salonKeyOf, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { menuHrefOf, serviceHrefOf } from '../../navigation'
import { readServices, servicesKeyOf } from '../../salons/api/salons-api'
import {
  addService,
  categoriesKeyOf,
  menuOf,
  readCategories,
  type ServiceRead,
  serviceKeyOf,
} from '../api/menu-api'
import { ServiceForm } from '../components/service-form/service-form'
import { nextSortOrderOf } from '../utils/menu-format'
import {
  afterServiceWrite,
  readServiceEntry,
  refusesChoice,
} from '../utils/service-form'
import { MenuForbidden, useKeepsMenu } from './keeps-menu'

const TITLE = 'サービスを足す'

type ServiceEntryProps = {
  salon: ModelsSalonResponse
  categories: readonly ModelsServiceCategoryResponse[]
  services: readonly ModelsServiceResponse[]
  /** Reads the menu anew, after the API refused a choice it offered */
  onChoiceRefused: () => void
}

/**
 * The form of a new service of the menu, of any of the categories there
 * are, and last in the order unless it is given another place. The menu
 * that was read is dropped: the new service belongs in it, and the page
 * of the service is shown with what the API wrote.
 */
const ServiceEntry = ({
  salon,
  categories,
  services,
  onChoiceRefused,
}: ServiceEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const entry = useMutation({
    mutationFn: (request: ModelsServiceCreateRequest) =>
      addService(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ service }) => {
          const read: ServiceRead = { type: 'found', service }
          queryClient.setQueryData(serviceKeyOf(service.id), read)
          queryClient.removeQueries({ queryKey: servicesKeyOf(salon.id) })
          notify({
            tone: 'success',
            message: `サービス「${service.name}」を、メニューに足しました。`,
          })
          void navigate(serviceHrefOf(salon.id, service.id))
        })
        // The salon was removed meanwhile
        .with({ type: 'notFound' }, () =>
          queryClient.setQueryData(salonKeyOf(salon.id), NOT_FOUND),
        )
        .with({ type: 'invalid' }, (refused) => {
          if (refusesChoice(refused)) {
            onChoiceRefused()
          }
          setSaid(afterServiceWrite(refused, 'entry'))
        })
        .with(
          { type: P.union('forbidden', 'tooManyRequests', 'failed') },
          (refused) => setSaid(afterServiceWrite(refused, 'entry')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readServiceEntry(values))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <ServiceForm
      service={null}
      categories={categories}
      services={services}
      sortOrder={nextSortOrderOf(services)}
      submitLabel='足す'
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={menuHrefOf(salon.id)} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type EntryPartProps = { salon: ModelsSalonResponse }

/** The categories and the services there are, read anew, and the form once both were. */
const EntryPart = ({ salon }: EntryPartProps) => {
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
  const readAgain = (): void => {
    void categories.refetch()
    void services.refetch()
  }

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {match(
        menuOf(
          categories.isFetchedAfterMount ? categories.data : undefined,
          services.isFetchedAfterMount ? services.data : undefined,
        ),
      )
        .with(undefined, () => (
          <LoadingIndicator label='メニューを読み込んでいます' />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={unreadMessageOf('メニュー', reason)}
              onRetry={readAgain}
              pending={categories.isFetching || services.isFetching}
            />
          ),
        )
        .with({ type: 'found' }, (menu) => (
          <ServiceEntry
            salon={salon}
            categories={menu.categories}
            services={menu.services}
            onChoiceRefused={readAgain}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** Adds a service to the menu of the salon of the address, for the owner, a manager and an administrator. */
export const ServiceEntryScreen = () => {
  const { salonId = '' } = useParams()
  const keeps = useKeepsMenu()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <EntryPart key={salon.id} salon={salon} />
        ) : (
          <MenuForbidden salon={salon} title={TITLE} />
        )
      }
    </WithSalon>
  )
}
