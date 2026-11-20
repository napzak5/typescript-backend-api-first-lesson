import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { aDescribedSalon } from '../examples'
import { SalonForm } from './salon-form'

const meta: Meta<typeof SalonForm> = {
  title: 'Admin/Settings/SalonForm',
  component: SalonForm,
  args: {
    salon: aDescribedSalon(),
    submitLabel: '変更を保存する',
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

/** Opened with a salon that has every value recorded */
export const Recorded: Story = {}

/** Opened with a salon that has little recorded: the controls of what it has not are empty */
export const LittleRecorded: Story = { args: { salon } }

/** What is wrong with the values, at their controls */
export const WithErrors: Story = {
  args: {
    errors: {
      name: 'サロンの名前を、255 文字までで入力してください。',
      latitude:
        '緯度は、-90 から 90 までの数（小数は 8 桁まで）で入力してください。',
      email:
        'このメールアドレスは、ほかのサロンが使っています。ほかのメールアドレスを入力してください。',
      taxRate:
        '税率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。',
    },
  },
}

/** What went wrong with the attempt as a whole */
export const NotChanged: Story = {
  args: {
    message:
      'サロンの情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
