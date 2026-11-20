import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import { CATEGORIES_OF_THE_MENU, SERVICES_OF_THE_MENU } from '../examples'
import { MenuSections } from './menu-sections'

const meta: Meta<typeof MenuSections> = {
  title: 'Admin/Menu/MenuSections',
  component: MenuSections,
  args: {
    categories: CATEGORIES_OF_THE_MENU,
    services: SERVICES_OF_THE_MENU,
    currency: salon.currency,
    serviceHref: (id) => `/salons/${salon.id}/menu/services/${id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A cut, a colour on a discount, a category below the colour without services, and a package of no category that is coming soon */
export const Found: Story = {}

/** Every service is in a category */
export const AllInCategories: Story = {
  args: { services: SERVICES_OF_THE_MENU.slice(0, 2) },
}
