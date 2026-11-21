import type {
  ModelsSalonResponse,
  ModelsServiceBulkUpdateRequest,
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import {
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { menuHrefOf } from '../navigation'
import { readServices, servicesKeyOf } from '../salons/salons-api'
import { ServicesChangeForm } from './components/services-change-form/services-change-form'
import { MenuForbidden, useKeepsMenu } from './keeps-menu'
import {
  categoriesKeyOf,
  changeServices,
  menuOf,
  readCategories,
} from './menu-api'
import {
  afterServicesChange,
  changedMessageOf,
  readServicesChange,
  refusesCategory,
} from './services-change'

const TITLE = 'サービスをまとめて変える'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type ServicesChangeProps = {
  salon: ModelsSalonResponse
  categories: readonly ModelsServiceCategoryResponse[]
  services: readonly ModelsServiceResponse[]
  /** Reads the menu anew, after the API refused a service or a category it offered */
  readMenuAgain: () => void
}

/**
 * The form that gives the services chosen the values chosen, all of them
 * or none. The menu that was read is dropped once they are changed, and
 * read again when the API said that something chosen is not there any
 * more.
 */
const ServicesChange = ({
  salon,
  categories,
  services,
  readMenuAgain,
}: ServicesChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const menu = menuHrefOf(salon.id)
  const change = useMutation({
    mutationFn: (request: ModelsServiceBulkUpdateRequest) =>
      changeServices(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'changed' }, ({ updated }) => {
          queryClient.removeQueries({ queryKey: servicesKeyOf(salon.id) })
          notify({ tone: 'success', message: changedMessageOf(updated) })
          void navigate(menu)
        })
        .with({ type: 'servicesGone' }, (refused) => {
          readMenuAgain()
          setSaid(afterServicesChange(refused))
        })
        .with({ type: 'invalid' }, (refused) => {
          if (refusesCategory(refused)) {
            readMenuAgain()
          }
          setSaid(afterServicesChange(refused))
        })
        .with(
          { type: P.union('forbidden', 'tooManyRequests', 'failed') },
          (refused) => setSaid(afterServicesChange(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readServicesChange(values))
      .with({ type: 'invalid' }, ({ says }) => setSaid(says))
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        change.mutate(request)
      })
      .exhaustive()

  return (
    <ServicesChangeForm
      categories={categories}
      services={services}
      submitLabel='変える'
      message={said.message}
      errors={said.errors}
      pending={change.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={menu} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

type ChangePartProps = { salon: ModelsSalonResponse }

/** The categories and the services there are, read anew, and the form once both were. */
const ChangePart = ({ salon }: ChangePartProps) => {
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
              retrying={categories.isFetching || services.isFetching}
            />
          ),
        )
        .with({ type: 'found' }, (menu) => (
          <ServicesChange
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

/** Gives several services of the menu of the salon of the address the same values, for the owner, a manager and an administrator. */
export const ServicesChangeScreen = () => {
  const { salonId = '' } = useParams()
  const keeps = useKeepsMenu()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <ChangePart key={salon.id} salon={salon} />
        ) : (
          <MenuForbidden salon={salon} title={TITLE} />
        )
      }
    </WithSalon>
  )
}
