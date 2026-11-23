import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminMenuMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import {
  aDiscountedColour,
  aPackage,
  aService,
  CATEGORIES_OF_THE_MENU,
  SERVICES_OF_THE_MENU,
} from '../examples'
import { ServiceForm } from './service-form'

const { errors, failed } = adminMenuMessages.serviceForm

const meta: Meta<typeof ServiceForm> = {
  title: 'Admin/Menu/ServiceForm',
  component: ServiceForm,
  args: {
    service: null,
    categories: CATEGORIES_OF_THE_MENU,
    services: SERVICES_OF_THE_MENU,
    sortOrder: 4,
    submitLabel: '足す',
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

/** A service that is added: of no category, switched on, given every day, booked online, last in the menu */
export const New: Story = {}

/** A service that is changed: the form opens with what is stored, its option among it */
export const Opened: Story = {
  args: { service: aDiscountedColour(), submitLabel: '変更を保存する' },
}

/** A service with an option, which a package is made of: no box makes it a package */
export const InAPackage: Story = {
  args: { service: aService(), submitLabel: '変更を保存する' },
}

/** A package: the services it is made of, a row each */
export const Package: Story = {
  args: { service: aPackage(), submitLabel: '変更を保存する' },
}

/** What is wrong, under the controls, a row of the package among them */
export const WithErrors: Story = {
  args: {
    service: aPackage(),
    submitLabel: '変更を保存する',
    errors: {
      discountPrice: errors.discountAbovePrice,
      'packageServiceIds.1': errors.packagedTwice,
    },
  },
}

/** What went wrong with the attempt as a whole */
export const NotSent: Story = {
  args: {
    message: failed.entry,
  },
}
