import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SalonRemoval } from './salon-removal'

const meta: Meta<typeof SalonRemoval> = {
  title: 'Admin/Settings/SalonRemoval',
  component: SalonRemoval,
  args: {
    name: 'Salon Hikari 表参道店',
    refusal: undefined,
    bookingsHref: '/salons/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01/bookings',
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** What the removal does, and the button that asks */
export const Offered: Story = {}

/** Refused for bookings that are not finished: said with the way to them */
export const BookingsUnfinished: Story = {
  args: {
    refusal: {
      type: 'bookingsUnfinished',
      message:
        'サロン「Salon Hikari 表参道店」には、終わっていない予約（下書き、確定待ち、確定、施術中）があるため、削除できません。予約台帳で、予約を完了するか、キャンセルするか、無断キャンセルにしてから、もう一度お試しください。',
    },
  },
}

/** Refused to an account that no longer removes the salon */
export const Forbidden: Story = {
  args: {
    refusal: {
      type: 'forbidden',
      message:
        'このアカウントでは、このサロンを削除できません。サロンを削除できるのは、そのサロンのオーナーと、管理者です。',
    },
  },
}
