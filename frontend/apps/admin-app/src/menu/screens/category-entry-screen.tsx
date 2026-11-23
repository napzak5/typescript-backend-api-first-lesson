import { NOT_FOUND, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsServiceCategoryCreateRequest,
  ModelsServiceCategoryResponse,
} from '@beauty-salon-frontend/api-client'
import { salonKeyOf, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  inJapanese,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { menuHrefOf } from '../../navigation'
import {
  addCategory,
  type CategoryRead,
  categoriesKeyOf,
  categoryKeyOf,
  readCategories,
} from '../api/menu-api'
import { CategoryForm } from '../components/category-form/category-form'
import {
  afterCategoryWrite,
  readCategoryEntry,
  refusesParent,
} from '../utils/category-form'
import { nextDisplayOrderOf } from '../utils/menu-format'
import { MenuForbidden, useKeepsMenu } from './keeps-menu'

const TITLE = 'カテゴリーを足す'

type CategoryEntryProps = {
  salon: ModelsSalonResponse
  categories: readonly ModelsServiceCategoryResponse[]
  /** Reads the categories anew, after the API refused the parent that was chosen */
  onParentRefused: () => void
}

/**
 * The form of a new category of the menu, below any of the categories
 * there are, and last in the order unless it is given another place. The
 * menu that was read is dropped: the new category belongs in it.
 */
const CategoryEntry = ({
  salon,
  categories,
  onParentRefused,
}: CategoryEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
  const entry = useMutation({
    mutationFn: (request: ModelsServiceCategoryCreateRequest) =>
      addCategory(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ category }) => {
          const read: CategoryRead = { type: 'found', category }
          queryClient.setQueryData(categoryKeyOf(category.id), read)
          queryClient.removeQueries({ queryKey: categoriesKeyOf(salon.id) })
          notify({
            tone: 'success',
            message: `カテゴリー「${category.name}」を、メニューに足しました。`,
          })
          void navigate(menuHrefOf(salon.id))
        })
        // The salon was removed meanwhile
        .with({ type: 'notFound' }, () =>
          queryClient.setQueryData(salonKeyOf(salon.id), NOT_FOUND),
        )
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

  const submit = (values: FormData): void =>
    match(readCategoryEntry(values))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <CategoryForm
      category={null}
      parents={categories}
      categories={categories}
      displayOrder={nextDisplayOrderOf(categories)}
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

/** The categories there are, read anew, and the form once they were. */
const EntryPart = ({ salon }: EntryPartProps) => {
  const categories = useQuery({
    queryKey: categoriesKeyOf(salon.id),
    queryFn: () => readCategories(salon.id),
    staleTime: 0,
  })
  const shown = categories.isFetchedAfterMount ? categories.data : undefined

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {match(shown)
        .with(undefined, () => (
          <LoadingIndicator label='カテゴリーを読み込んでいます' />
        ))
        .with(
          { type: P.union('notFound', 'tooManyRequests', 'failed') },
          (reason) => (
            <UnreadNotice
              message={inJapanese(
                unreadMessageOf(writtenInJapanese('カテゴリー'), reason),
              )}
              onRetry={() => void categories.refetch()}
              pending={categories.isFetching}
            />
          ),
        )
        .with({ type: 'found' }, ({ items }) => (
          <CategoryEntry
            salon={salon}
            categories={items}
            onParentRefused={() => void categories.refetch()}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** Adds a category to the menu of the salon of the address, for the owner, a manager and an administrator. */
export const CategoryEntryScreen = () => {
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
