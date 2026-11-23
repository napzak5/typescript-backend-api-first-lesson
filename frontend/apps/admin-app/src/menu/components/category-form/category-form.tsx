import type { ModelsServiceCategoryResponse } from '@beauty-salon-frontend/api-client'
import {
  CATEGORY_CHOICES,
  WEB_ADDRESS_DESCRIPTION,
} from '@beauty-salon-frontend/fields'
import {
  Checkbox,
  FieldRow,
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  Select,
  TextArea,
  TextField,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { LONGEST_NAME } from '../../utils/category-form'
import { categoriesById, categoryPathOf } from '../../utils/menu-format'

const { form: WORDS } = adminMenuMessages.categories

export type CategoryFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /**
   * The category the form opens with. `null` for a new one: the form then
   * opens with a category of the top that is switched on and comes last
   */
  category: ModelsServiceCategoryResponse | null
  /** The categories the category may be put below, in the order of the menu */
  parents: readonly ModelsServiceCategoryResponse[]
  /** The categories of the salon, which the parents are named among */
  categories: readonly ModelsServiceCategoryResponse[]
  /** Where a new category goes in the order of the menu */
  displayOrder: number
}

/**
 * Everything a category of the menu keeps: its name and kind, the
 * category it is below, its place in the order, how it looks, and whether
 * the customers see it. A control is named as the property of the request
 * is; the browser keeps the values, and the form hands them over when it
 * is sent.
 */
export const CategoryForm = ({
  category,
  parents,
  categories,
  displayOrder,
  message,
  errors = NO_ERRORS,
  ...form
}: CategoryFormProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)
  const byId = categoriesById(categories)

  return (
    <Form {...form} message={said.message} errors={errors}>
      <TextField
        label={say(WORDS.name)}
        name='name'
        autoComplete='off'
        required
        description={say(WORDS.nameDescription(LONGEST_NAME))}
        defaultValue={category?.name}
        error={said.errors['name']}
      />
      <Select
        label={say(WORDS.parent)}
        name='parentId'
        placeholder={say(WORDS.noParent)}
        options={parents.map((parent) => ({
          value: parent.id,
          label: categoryPathOf(parent, byId),
        }))}
        description={say(WORDS.parentDescription)}
        defaultValue={category?.parentId ?? ''}
        error={said.errors['parentId']}
      />
      <FieldRow>
        <Select
          label={say(WORDS.type)}
          name='category'
          required
          placeholder={say(WORDS.choose)}
          options={options(CATEGORY_CHOICES)}
          defaultValue={category?.category ?? ''}
          error={said.errors['category']}
        />
        <TextField
          label={say(WORDS.displayOrder)}
          name='displayOrder'
          inputMode='numeric'
          autoComplete='off'
          required
          description={say(WORDS.displayOrderDescription)}
          defaultValue={String(category?.displayOrder ?? displayOrder)}
          error={said.errors['displayOrder']}
        />
      </FieldRow>
      <TextArea
        label={say(WORDS.description)}
        name='description'
        defaultValue={category?.description ?? undefined}
        error={said.errors['description']}
      />
      <TextField
        label={say(WORDS.color)}
        name='color'
        autoComplete='off'
        width='short'
        description={say(WORDS.colorDescription)}
        defaultValue={category?.color ?? undefined}
        error={said.errors['color']}
      />
      <TextField
        label={say(WORDS.icon)}
        name='iconUrl'
        type='url'
        autoComplete='off'
        description={say(WEB_ADDRESS_DESCRIPTION)}
        defaultValue={category?.iconUrl ?? undefined}
        error={said.errors['iconUrl']}
      />
      <Checkbox
        label={say(WORDS.active)}
        name='isActive'
        description={say(WORDS.activeDescription)}
        defaultChecked={category?.isActive ?? true}
        error={said.errors['isActive']}
      />
    </Form>
  )
}
