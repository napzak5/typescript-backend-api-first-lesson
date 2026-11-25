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
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
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
import { afterServiceWrite, readServiceEntry } from '../utils/service-form'
import { MenuForbidden, useKeepsMenu } from './keeps-menu'

const { names, services: WORDS, titles, words } = adminMenuMessages

type ServiceEntryProps = {
  salon: ModelsSalonResponse
  categories: readonly ModelsServiceCategoryResponse[]
  services: readonly ModelsServiceResponse[]
  /**
   * Reads the menu anew after the API refused a value: the form checks
   * every value first, so the API refuses one only when the menu changed
   * meanwhile (the category, or a service of the package, was removed)
   */
  readMenuAgain: () => void
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
  readMenuAgain,
}: ServiceEntryProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const entry = useMutation({
    mutationFn: (request: ModelsServiceCreateRequest) =>
      addService(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ service }) => {
          const read: ServiceRead = { type: 'found', service }
          queryClient.setQueryData(serviceKeyOf(service.id), read)
          queryClient.removeQueries({ queryKey: servicesKeyOf(salon.id) })
          notify({ tone: 'success', message: WORDS.added(service.name) })
          void navigate(serviceHrefOf(salon.id, service.id))
        })
        // The salon was removed meanwhile
        .with({ type: 'notFound' }, () =>
          queryClient.setQueryData(salonKeyOf(salon.id), NOT_FOUND),
        )
        .with({ type: 'invalid' }, (refused) => {
          readMenuAgain()
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
      submitLabel={say(words.add)}
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={menuHrefOf(salon.id)} variant='quiet'>
          {say(words.cancel)}
        </ButtonLink>
      }
    />
  )
}

type EntryPartProps = { salon: ModelsSalonResponse }

/** The categories and the services there are, read anew, and the form once both were. */
const EntryPart = ({ salon }: EntryPartProps) => {
  const say = useSay()
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
      <PageHeader title={say(titles.serviceEntry)} description={salon.name} />
      {match(
        menuOf(
          categories.isFetchedAfterMount ? categories.data : undefined,
          services.isFetchedAfterMount ? services.data : undefined,
        ),
      )
        .with(undefined, () => (
          <LoadingIndicator label={say(words.loadingMenu)} />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.menu, reason))}
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
            readMenuAgain={readAgain}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** Adds a service to the menu of the salon of the address, for the owner, a manager and an administrator. */
export const ServiceEntryScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const keeps = useKeepsMenu()

  return (
    <WithSalon salonId={salonId} title={say(titles.serviceEntry)}>
      {(salon) =>
        keeps ? (
          <EntryPart key={salon.id} salon={salon} />
        ) : (
          <MenuForbidden salon={salon} title={titles.serviceEntry} />
        )
      }
    </WithSalon>
  )
}
