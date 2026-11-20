import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { CATEGORIES_OF_THE_MENU } from '../examples'
import { CategoryTable } from './category-table'

const meta: Meta<typeof CategoryTable> = {
  title: 'Admin/Menu/CategoryTable',
  component: CategoryTable,
  args: {
    categories: CATEGORIES_OF_THE_MENU,
    changeHref: (id) => `/salons/${salon.id}/menu/categories/${id}/edit`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** As an account that keeps the menu sees them: the names lead to their forms */
export const ToKeep: Story = {}

/** As a member of the staff sees them, who does not change the menu */
export const ToRead: Story = {
  args: { changeHref: undefined },
}
