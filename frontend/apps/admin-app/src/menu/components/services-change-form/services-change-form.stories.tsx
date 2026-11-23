import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CATEGORIES_OF_THE_MENU, SERVICES_OF_THE_MENU } from '../examples'
import { ServicesChangeForm } from './services-change-form'

const { bulk, serviceForm } = adminMenuMessages

const meta: Meta<typeof ServicesChangeForm> = {
  title: 'Admin/Menu/ServicesChangeForm',
  component: ServicesChangeForm,
  args: {
    categories: CATEGORIES_OF_THE_MENU,
    services: SERVICES_OF_THE_MENU,
    submitLabel: '変える',
    onSubmit: fn(),
    actions: (
      <ButtonLink href='/' variant='quiet'>
        やめる
      </ButtonLink>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** The services of the menu in its order, each with its category, and every value kept */
export const Opened: Story = {}

/** What is wrong: no service was chosen, and the category was removed meanwhile */
export const WithErrors: Story = {
  args: {
    errors: {
      serviceIds: bulk.errors.services,
      categoryId: serviceForm.errors.categoryGone,
    },
  },
}

/** What went wrong with the attempt as a whole */
export const NotChanged: Story = {
  args: {
    message: bulk.errors.servicesGone,
  },
}
