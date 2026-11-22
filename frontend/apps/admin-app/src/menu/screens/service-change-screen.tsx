import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
  ModelsServiceUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  aboutTheAttempt,
  Button,
  ButtonLink,
  Dialog,
  type FormSays,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
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
  categoriesKeyOf,
  changeService,
  menuOf,
  readCategories,
  readService,
  removeService,
  type ServiceRead,
  serviceKeyOf,
} from '../api/menu-api'
import { ServiceForm } from '../components/service-form/service-form'
import { packagesOf } from '../utils/menu-format'
import {
  afterServiceRemoval,
  afterServiceWrite,
  inUseMessageOf,
  readServiceChange,
  refusesChoice,
} from '../utils/service-form'
import { MenuForbidden, useKeepsMenu } from './keeps-menu'
import { ServiceNotFound } from './service-screen'

const TITLE = 'サービスを直す'

type ServiceChangeProps = {
  salon: ModelsSalonResponse
  service: ModelsServiceResponse
  categories: readonly ModelsServiceCategoryResponse[]
  services: readonly ModelsServiceResponse[]
  /** Reads the menu anew: after the API refused a choice it offered, and before a refused removal is explained */
  readMenuAgain: () => Promise<readonly ModelsServiceResponse[] | undefined>
}

/**
 * The form of a service, opened with what the menu has of it now. It sends
 * what was changed and nothing else, and a form sent as it was opened asks
 * the API for nothing. Beside the form, the service is removed after a
 * dialog has said what becomes of the bookings that have it; one that a
 * package or a booking not over yet holds stays, and the reason is said
 * with what to do first.
 */
const ServiceChange = ({
  salon,
  service,
  categories,
  services,
  readMenuAgain,
}: ServiceChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const [removing, setRemoving] = useState(false)
  /** What went wrong with a removal that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  const key = serviceKeyOf(service.id)
  const menu = menuHrefOf(salon.id)
  const page = serviceHrefOf(salon.id, service.id)

  /** The service is not in the menu any more: removed here, or by somebody else meanwhile */
  const gone = (): void => {
    queryClient.removeQueries({ queryKey: servicesKeyOf(salon.id) })
    queryClient.setQueryData(key, NOT_FOUND)
  }

  const change = useMutation({
    mutationFn: (request: ModelsServiceUpdateRequest) =>
      changeService(salon.id, service.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ service: changed }) => {
          const read: ServiceRead = { type: 'found', service: changed }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: servicesKeyOf(salon.id) })
          notify({
            tone: 'success',
            message: `サービス「${changed.name}」を直しました。`,
          })
          void navigate(page)
        })
        .with({ type: 'notFound' }, gone)
        .with({ type: 'invalid' }, (refused) => {
          if (refusesChoice(refused)) {
            void readMenuAgain()
          }
          setSaid(afterServiceWrite(refused, 'change'))
        })
        .with(
          { type: P.union('forbidden', 'tooManyRequests', 'failed') },
          (refused) => setSaid(afterServiceWrite(refused, 'change')),
        )
        .exhaustive(),
  })

  const removal = useMutation({
    mutationFn: () => removeService(salon.id, service.id),
    onSuccess: (outcome) =>
      match(afterServiceRemoval(outcome, service.name))
        .with({ type: 'done' }, ({ message: done }) => {
          gone()
          notify({ tone: 'success', message: done })
          void navigate(menu)
        })
        .with({ type: 'gone' }, gone)
        .with({ type: 'inUse' }, async () => {
          const now = await readMenuAgain()
          setRemoving(false)
          setSaid(
            aboutTheAttempt(
              inUseMessageOf(
                service.name,
                packagesOf(now ?? services, service.id),
              ),
            ),
          )
        })
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setRemoving(false)
          setSaid(aboutTheAttempt(refused))
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readServiceChange(values, service))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(page)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        change.mutate(value)
      })
      .exhaustive()

  const close = (): void => {
    setRemoving(false)
    setMessage(undefined)
  }

  return (
    <>
      <ServiceForm
        service={service}
        categories={categories}
        services={services}
        sortOrder={service.sortOrder}
        submitLabel='変更を保存する'
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={submit}
        actions={
          <>
            <ButtonLink href={page} variant='quiet'>
              やめる
            </ButtonLink>
            <Button variant='danger' onClick={() => setRemoving(true)}>
              削除
            </Button>
          </>
        }
      />
      <Dialog
        open={removing}
        onClose={close}
        title={`サービス「${service.name}」を削除しますか？`}
        description='メニューから消え、お客様もサロンも、このサービスで予約を入れられなくなります。すでにある予約の施術明細は、そのまま残ります。削除したサービスは、元に戻せません。'
        actions={
          <>
            <Button onClick={close}>戻る</Button>
            <Button
              variant='danger'
              pending={removal.isPending}
              onClick={() => {
                setMessage(undefined)
                removal.mutate()
              }}
            >
              削除する
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      </Dialog>
    </>
  )
}

type ChangePartProps = { salon: ModelsSalonResponse; serviceId: string }

/**
 * The service of the address, the categories and the services of the
 * salon, all read anew whenever the screen opens, so that what the form
 * writes on is what the menu holds now; the form once all were. The
 * service is not read again when the window comes back: the form compares
 * what is sent with what it was opened with.
 */
const ChangePart = ({ salon, serviceId }: ChangePartProps) => {
  const service = useQuery({
    queryKey: serviceKeyOf(serviceId),
    queryFn: () => readService(salon.id, serviceId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
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
  const header = <PageHeader title={TITLE} description={salon.name} />
  const retry = (): void => {
    void service.refetch()
    void categories.refetch()
    void services.refetch()
  }
  const retrying =
    service.isFetching || categories.isFetching || services.isFetching
  const readMenuAgain = async (): Promise<
    readonly ModelsServiceResponse[] | undefined
  > => {
    void categories.refetch()
    const now = await services.refetch()

    return now.data?.type === 'found' ? now.data.items : undefined
  }
  const shown = service.isFetchedAfterMount ? service.data : undefined
  const menu = menuOf(
    categories.isFetchedAfterMount ? categories.data : undefined,
    services.isFetchedAfterMount ? services.data : undefined,
  )

  return match(shown)
    .with({ type: 'notFound' }, () => <ServiceNotFound salon={salon} />)
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={unreadMessageOf('サービス', reason)}
          onRetry={retry}
          pending={retrying}
        />
      </>
    ))
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label='サービスを読み込んでいます' />
      </>
    ))
    .with({ type: 'found' }, (found) =>
      match(menu)
        .with(undefined, () => (
          <>
            {header}
            <LoadingIndicator label='メニューを読み込んでいます' />
          </>
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <>
              {header}
              <UnreadNotice
                message={unreadMessageOf('メニュー', reason)}
                onRetry={retry}
                pending={retrying}
              />
            </>
          ),
        )
        .with({ type: 'found' }, (read) => (
          <>
            {header}
            <ServiceChange
              salon={salon}
              service={found.service}
              categories={read.categories}
              services={read.services}
              readMenuAgain={readMenuAgain}
            />
          </>
        ))
        .exhaustive(),
    )
    .exhaustive()
}

/** Changes a service of the menu of the salon of the address, and removes it, for the owner, a manager and an administrator. */
export const ServiceChangeScreen = () => {
  const { salonId = '', serviceId = '' } = useParams()
  const keeps = useKeepsMenu()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <ChangePart key={serviceId} salon={salon} serviceId={serviceId} />
        ) : (
          <MenuForbidden salon={salon} title={TITLE} />
        )
      }
    </WithSalon>
  )
}
