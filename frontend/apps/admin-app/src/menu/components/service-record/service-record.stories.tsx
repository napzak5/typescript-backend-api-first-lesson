import type { Meta, StoryObj } from '@storybook/react-vite'
import { salon } from '../../../bookings/components/examples'
import {
  aDiscountedColour,
  aPackage,
  aService,
  CATEGORIES_OF_THE_MENU,
  SERVICES_OF_THE_MENU,
} from '../examples'
import { ServiceRecord } from './service-record'

const meta: Meta<typeof ServiceRecord> = {
  title: 'Admin/Menu/ServiceRecord',
  component: ServiceRecord,
  args: {
    service: aService(),
    categories: CATEGORIES_OF_THE_MENU,
    services: SERVICES_OF_THE_MENU,
    currency: salon.currency,
    serviceHref: (id) => `/salons/${salon.id}/menu/services/${id}`,
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A cut that customers book online, with an option that may be chosen, one that is always added and is switched off, and more photos */
export const WithOptions: Story = {
  args: {
    service: aService({
      imageUrls: [
        'https://photos.example.com/menu/cut-2.jpg',
        'https://photos.example.com/menu/cut-3.jpg',
      ],
      options: [
        ...aService().options,
        {
          name: '炭酸シャンプー',
          description: null,
          optionType: 'upgrade',
          additionalTime: 0,
          additionalPrice: 550,
          maxQuantity: 2,
          isRequired: true,
          sortOrder: 2,
          isActive: false,
        },
      ],
    }),
  },
}

/** A colour on a discount, with the conditions of a booking and a level the stylist needs */
export const WithConditions: Story = {
  args: { service: aDiscountedColour() },
}

/** A package of a cut and a colour, one of whose services is not on the menu any more */
export const Package: Story = {
  args: {
    service: aPackage(),
    services: SERVICES_OF_THE_MENU.filter(
      ({ id }) => id !== aDiscountedColour().id,
    ),
  },
}
