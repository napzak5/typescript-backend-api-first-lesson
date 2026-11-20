import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CATEGORIES_OF_THE_MENU, SERVICES_OF_THE_MENU } from '../examples'
import { ServicesChangeForm } from './services-change-form'

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
      serviceIds: '変えるサービスを、1 件以上選んでください。',
      categoryId:
        'このカテゴリーは、その間に削除されていました。カテゴリーを選び直してください。',
    },
  },
}

/** What went wrong with the attempt as a whole */
export const NotChanged: Story = {
  args: {
    message:
      '選んだサービスのどれかが、その間にメニューから削除されていました。どのサービスも変えていません。いまのメニューから、選び直してください。',
  },
}
