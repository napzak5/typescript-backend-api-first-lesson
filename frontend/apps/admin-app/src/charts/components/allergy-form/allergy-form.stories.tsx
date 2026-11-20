import { ButtonLink } from '@beauty-salon-frontend/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { anAllergy } from '../examples'
import { AllergyForm } from './allergy-form'

const meta: Meta<typeof AllergyForm> = {
  title: 'Admin/Charts/AllergyForm',
  component: AllergyForm,
  args: {
    today: '2026-11-20',
    submitLabel: '記録する',
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

/** An allergy that is recorded: nothing chosen yet */
export const New: Story = {}

/** An allergy that is changed: the form opens with what is stored */
export const Opened: Story = {
  args: { allergy: anAllergy(), submitLabel: '変更を保存する' },
}

/** What is wrong, under the controls */
export const WithErrors: Story = {
  args: {
    errors: {
      allergenName: 'このお客様には、同じアレルゲンの記録があります。',
      severityType: '重篤度を選んでください。',
      confirmedDate: '確かめた日は、今日までにしてください。',
    },
  },
}

/** The allergy is on its way */
export const Sending: Story = {
  args: { allergy: anAllergy(), submitLabel: '変更を保存する', pending: true },
}

/** The allergy could not be sent */
export const NotSent: Story = {
  args: {
    message:
      'アレルギーを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
  },
}
