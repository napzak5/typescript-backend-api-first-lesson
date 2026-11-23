import type { ModelsServiceCategoryResponse } from '@beauty-salon-frontend/api-client'
import { categoryNameOf } from '@beauty-salon-frontend/salon-screens'
import { Link, NONE, Table, useSay } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  categoriesById,
  categoryPathOf,
  categoryStateOf,
} from '../../utils/menu-format'

const { table: WORDS } = adminMenuMessages.categories

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
  const say = useSay()
  const byId = categoriesById(categories)

  return (
    <Table
      caption={say(WORDS.caption)}
      captionHidden
      columns={[
        {
          key: 'name',
          header: say(WORDS.name),
          cell: (category) =>
            changeHref === undefined ? (
              category.name
            ) : (
              <Link href={changeHref(category.id)}>{category.name}</Link>
            ),
        },
        {
          key: 'parent',
          header: say(WORDS.parent),
          cell: ({ parentId }) => {
            const parent = parentId === null ? undefined : byId.get(parentId)

            return parent === undefined
              ? say(NONE)
              : categoryPathOf(parent, byId)
          },
        },
        {
          key: 'category',
          header: say(WORDS.type),
          cell: ({ category }) => say(categoryNameOf(category)),
        },
        {
          key: 'displayOrder',
          header: say(WORDS.displayOrder),
          cell: ({ displayOrder }) => say(formats.numberOf(displayOrder)),
          align: 'end',
        },
        {
          key: 'color',
          header: say(WORDS.color),
          cell: ({ color }) => color,
        },
        {
          key: 'isActive',
          header: say(WORDS.status),
          cell: (category) => say(categoryStateOf(category)),
        },
      ]}
      rows={categories}
      rowKey={({ id }) => id}
      emptyMessage={say(WORDS.empty)}
    />
  )
}
