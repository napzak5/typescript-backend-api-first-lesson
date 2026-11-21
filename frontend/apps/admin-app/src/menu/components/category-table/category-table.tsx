import type { ModelsServiceCategoryResponse } from '@beauty-salon-frontend/api-client'
import { categoryNameOf } from '@beauty-salon-frontend/salon-screens'
import { Link, Table } from '@beauty-salon-frontend/ui'
import { NOT_RECORDED } from '../../../staff/staff-format'
import {
  categoriesById,
  categoryPathOf,
  categoryStateOf,
} from '../../menu-format'

export type CategoryTableProps = {
  /** The categories of the salon, in the order of the menu; at least one */
  categories: readonly ModelsServiceCategoryResponse[]
  /**
   * The address that changes a category, for an account that may change
   * the menu; without it, the names lead nowhere
   */
  changeHref?: ((categoryId: string) => string) | undefined
}

/**
 * The categories of the menu, in its order: each with the category it is
 * below, its kind, its place in the order, its colour and whether it is
 * switched on. For an account that keeps the menu, the name leads to the
 * form that changes the category. The screen heads the table, so its
 * caption is for assistive technology only.
 */
export const CategoryTable = ({
  categories,
  changeHref,
}: CategoryTableProps) => {
  const byId = categoriesById(categories)

  return (
    <Table
      caption='カテゴリー'
      captionHidden
      columns={[
        {
          key: 'name',
          header: '名前',
          cell: (category) =>
            changeHref === undefined ? (
              category.name
            ) : (
              <Link href={changeHref(category.id)}>{category.name}</Link>
            ),
        },
        {
          key: 'parent',
          header: '親',
          cell: ({ parentId }) => {
            const parent = parentId === null ? undefined : byId.get(parentId)

            return parent === undefined ? 'なし' : categoryPathOf(parent, byId)
          },
        },
        {
          key: 'category',
          header: '種類',
          cell: ({ category }) => categoryNameOf(category),
        },
        {
          key: 'displayOrder',
          header: '表示順',
          cell: ({ displayOrder }) => displayOrder,
          align: 'end',
        },
        {
          key: 'color',
          header: '色',
          cell: ({ color }) => color ?? NOT_RECORDED,
        },
        {
          key: 'isActive',
          header: '状態',
          cell: (category) => categoryStateOf(category),
        },
      ]}
      rows={categories}
      rowKey={({ id }) => id}
      emptyMessage='カテゴリーはありません'
    />
  )
}
