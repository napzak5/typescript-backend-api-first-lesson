import type { ModelsServiceCategoryResponse } from '@beauty-salon-frontend/api-client'
import {
  Checkbox,
  Form,
  type FormProps,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { CATEGORY_OPTIONS } from '../../../customers/customer-format'
import { categoriesById, categoryPathOf } from '../../menu-format'
import styles from './category-form.module.css'

export type CategoryFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
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
  errors = {},
  ...form
}: CategoryFormProps) => {
  const byId = categoriesById(categories)

  return (
    <Form {...form} errors={errors}>
      <TextField
        label='名前'
        name='name'
        autoComplete='off'
        required
        description='100 文字まで。お客様のメニューの見出しになります。'
        defaultValue={category?.name}
        error={errors['name']}
      />
      <Select
        label='親カテゴリー'
        name='parentId'
        placeholder='なし（最上位のカテゴリー）'
        options={parents.map((parent) => ({
          value: parent.id,
          label: categoryPathOf(parent, byId),
        }))}
        description='このカテゴリーを、ほかのカテゴリーの下に置きます。'
        defaultValue={category?.parentId ?? ''}
        error={errors['parentId']}
      />
      <div className={styles['pair']}>
        <Select
          label='種類'
          name='category'
          required
          placeholder='選んでください'
          options={CATEGORY_OPTIONS}
          defaultValue={category?.category ?? ''}
          error={errors['category']}
        />
        <TextField
          label='表示順'
          name='displayOrder'
          inputMode='numeric'
          autoComplete='off'
          required
          description='0 以上の整数。小さいものから並びます。'
          defaultValue={String(category?.displayOrder ?? displayOrder)}
          error={errors['displayOrder']}
        />
      </div>
      <TextArea
        label='説明'
        name='description'
        rows={3}
        defaultValue={category?.description ?? undefined}
        error={errors['description']}
      />
      <TextField
        label='色'
        name='color'
        autoComplete='off'
        className={styles['short']}
        description='#C8A2C8 のように、# と 16 進数 6 桁で。'
        defaultValue={category?.color ?? undefined}
        error={errors['color']}
      />
      <TextField
        label='アイコンの URL'
        name='iconUrl'
        type='url'
        autoComplete='off'
        description='http:// か https:// で始まる、500 文字までの URL。'
        defaultValue={category?.iconUrl ?? undefined}
        error={errors['iconUrl']}
      />
      <Checkbox
        label='有効'
        name='isActive'
        description='外すと、お客様のメニューにこの見出しが出なくなり、このカテゴリーのサービスは「その他」に並びます。'
        defaultChecked={category?.isActive ?? true}
        error={errors['isActive']}
      />
    </Form>
  )
}
