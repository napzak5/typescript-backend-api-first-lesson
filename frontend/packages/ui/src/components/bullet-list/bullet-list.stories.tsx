import type { Meta, StoryObj } from '@storybook/react-vite'
import { BulletList } from './bullet-list'

const meta: Meta<typeof BulletList> = {
  title: 'Components/BulletList',
  component: BulletList,
  args: {
    'aria-label': 'まとめられない理由',
    children: [
      <li key='bookings'>山田 花子 様には、これからの予約があります。</li>,
      <li key='points'>
        ポイントの残高が 2 人で違うときは、まとめる前に、どちらかの残高を 0
        にしてください。
      </li>,
    ],
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
