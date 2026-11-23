import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsServiceCategoryResponse,
  ModelsServiceCategoryUpdateRequest,
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
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { menuHrefOf } from '../../navigation'
import { servicesKeyOf } from '../../salons/api/salons-api'
import {
  type CategoryRead,
  categoriesKeyOf,
  categoryKeyOf,
  changeCategory,
  readCategories,
  readCategory,
  removeCategory,
} from '../api/menu-api'
import { CategoryForm } from '../components/category-form/category-form'
import {
  afterCategoryRemoval,
  afterCategoryWrite,
  readCategoryChange,
  refusesParent,
} from '../utils/category-form'
import { parentChoicesOf } from '../utils/menu-format'
import { MenuForbidden, MenuPartNotFound, useKeepsMenu } from './keeps-menu'

const { categories: WORDS, names, titles, words } = adminMenuMessages

type CategoryChangeProps = {
  salon: ModelsSalonResponse
  category: ModelsServiceCategoryResponse
  categories: readonly ModelsServiceCategoryResponse[]
  /** Reads the categories anew, after the API refused the parent that was chosen */
  onParentRefused: () => void
}

/**
 * The form of a category, opened with what the menu has of it now. It
 * sends what was changed and nothing else, and a form sent as it was
 * opened asks the API for nothing. The category may be put below any other
 * category but those below it. Beside the form, the category is removed
 * after a dialog has said what becomes of its children and its services.
 */
const CategoryChange = ({
  salon,
  category,
  categories,
  onParentRefused,
}: CategoryChangeProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [removing, setRemoving] = useState(false)
  /** What went wrong with a removal that can be made again: said in the dialog */
  const [message, setMessage] = useState<LocalizedText>()
  const key = categoryKeyOf(category.id)
  const menu = menuHrefOf(salon.id)

  /** The category is not in the menu any more: removed here, or by somebody else meanwhile */
  const gone = (): void => {
    queryClient.removeQueries({ queryKey: categoriesKeyOf(salon.id) })
    queryClient.removeQueries({ queryKey: servicesKeyOf(salon.id) })
    queryClient.setQueryData(key, NOT_FOUND)
  }

  const change = useMutation({
    mutationFn: (request: ModelsServiceCategoryUpdateRequest) =>
      changeCategory(salon.id, category.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ category: changed }) => {
          const read: CategoryRead = { type: 'found', category: changed }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: categoriesKeyOf(salon.id) })
          notify({ tone: 'success', message: WORDS.changed(changed.name) })
          void navigate(menu)
        })
        .with({ type: 'notFound' }, gone)
        .with({ type: 'invalid' }, (refused) => {
          if (refusesParent(refused)) {
            onParentRefused()
          }
          setSaid(afterCategoryWrite(refused))
        })
        .with(
          { type: P.union('forbidden', 'tooManyRequests', 'failed') },
          (refused) => setSaid(afterCategoryWrite(refused)),
        )
        .exhaustive(),
  })

  const removal = useMutation({
    mutationFn: () => removeCategory(salon.id, category.id),
    onSuccess: (outcome) =>
      match(afterCategoryRemoval(outcome, category.name))
        .with({ type: 'done' }, ({ message: done }) => {
          gone()
          notify({ tone: 'success', message: done })
          void navigate(menu)
        })
        .with({ type: 'gone' }, gone)
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setRemoving(false)
          setSaid(aboutTheAttempt(refused))
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readCategoryChange(values, category))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(menu)
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
      <CategoryForm
        category={category}
        parents={parentChoicesOf(categories, category.id)}
        categories={categories}
        displayOrder={category.displayOrder}
        submitLabel={say(words.save)}
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={submit}
        actions={
          <>
            <ButtonLink href={menu} variant='quiet'>
              {say(words.cancel)}
            </ButtonLink>
            <Button variant='danger' onClick={() => setRemoving(true)}>
              {say(words.remove)}
            </Button>
          </>
        }
      />
      <Dialog
        open={removing}
        onClose={close}
        title={say(WORDS.removal.confirm(category.name))}
        description={say(WORDS.removal.description)}
        actions={
          <>
            <Button onClick={close}>{say(words.back)}</Button>
            <Button
              variant='danger'
              pending={removal.isPending}
              onClick={() => {
                setMessage(undefined)
                removal.mutate()
              }}
            >
              {say(words.confirmRemoval)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </>
  )
}

type ChangePartProps = { salon: ModelsSalonResponse; categoryId: string }

/**
 * The category of the address and the categories of the salon, both read
 * anew whenever the screen opens, so that what the form writes on is what
 * the menu holds now; the form once both were.
 */
const ChangePart = ({ salon, categoryId }: ChangePartProps) => {
  const say = useSay()
  const category = useQuery({
    queryKey: categoryKeyOf(categoryId),
    queryFn: () => readCategory(salon.id, categoryId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const categories = useQuery({
    queryKey: categoriesKeyOf(salon.id),
    queryFn: () => readCategories(salon.id),
    staleTime: 0,
  })
  const header = (
    <PageHeader title={say(titles.categoryChange)} description={salon.name} />
  )
  const retry = (): void => {
    void category.refetch()
    void categories.refetch()
  }
  const retrying = category.isFetching || categories.isFetching

  return match([
    category.isFetchedAfterMount ? category.data : undefined,
    categories.isFetchedAfterMount ? categories.data : undefined,
  ])
    .with([{ type: 'notFound' }, P._], () => (
      <MenuPartNotFound salon={salon} said={WORDS.notFound} />
    ))
    .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([reason]) => (
      <>
        {header}
        <UnreadNotice
          message={say(unreadMessageOf(names.category, reason))}
          onRetry={retry}
          pending={retrying}
        />
      </>
    ))
    .with(
      [P._, { type: P.union('notFound', 'tooManyRequests', 'failed') }],
      ([, reason]) => (
        <>
          {header}
          <UnreadNotice
            message={say(unreadMessageOf(names.categories, reason))}
            onRetry={retry}
            pending={retrying}
          />
        </>
      ),
    )
    .with([undefined, P._], [P._, undefined], () => (
      <>
        {header}
        <LoadingIndicator label={say(WORDS.loading)} />
      </>
    ))
    .with([{ type: 'found' }, { type: 'found' }], ([found, { items }]) => (
      <>
        {header}
        <CategoryChange
          salon={salon}
          category={found.category}
          categories={items}
          onParentRefused={() => void categories.refetch()}
        />
      </>
    ))
    .exhaustive()
}

/** Changes a category of the menu of the salon of the address, and removes it, for the owner, a manager and an administrator. */
export const CategoryChangeScreen = () => {
  const say = useSay()
  const { salonId = '', categoryId = '' } = useParams()
  const keeps = useKeepsMenu()

  return (
    <WithSalon salonId={salonId} title={say(titles.categoryChange)}>
      {(salon) =>
        keeps ? (
          <ChangePart key={categoryId} salon={salon} categoryId={categoryId} />
        ) : (
          <MenuForbidden salon={salon} title={titles.categoryChange} />
        )
      }
    </WithSalon>
  )
}
