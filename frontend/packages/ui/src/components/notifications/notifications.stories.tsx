import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent } from 'storybook/test'
import { Button } from '../button/button'
import {
  type Notification,
  NotificationOutlet,
  NotificationProvider,
  useNotifications,
} from './notifications'

/** A screen that notifies when its buttons are pressed. */
const Screen = (notification: Notification) => {
  const { notify } = useNotifications()

  return (
    <>
      <NotificationOutlet />
      <p>
        <Button onClick={() => notify(notification)}>予約を確定する</Button>{' '}
        <Button
          onClick={() =>
            notify({ tone: 'info', message: '予約の一覧を更新しました。' })
          }
        >
          一覧を更新する
        </Button>
      </p>
    </>
  )
}

const meta: Meta<typeof Screen> = {
  title: 'Components/Notifications',
  component: Screen,
  decorators: [
    (Story) => (
      <NotificationProvider>
        <Story />
      </NotificationProvider>
    ),
  ],
  args: {
    tone: 'success',
    message: '予約を確定しました。',
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Before anything was done: the place of the notification is empty. */
export const NothingToSay: Story = {}

/** Does what makes the screen notify. */
const confirmTheBooking: NonNullable<Story['play']> = async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('button', { name: '予約を確定する' }))
}

export const Success: Story = {
  play: confirmTheBooking,
}

export const Info: Story = {
  args: { tone: 'info', message: '次回の予約は 12 月 3 日（木）です。' },
  play: confirmTheBooking,
}

export const Warning: Story = {
  args: {
    tone: 'warning',
    message: '予約を確定しました。確認のメールは送信できませんでした。',
  },
  play: confirmTheBooking,
}

export const Danger: Story = {
  args: { tone: 'danger', message: '予約を確定できませんでした。' },
  play: confirmTheBooking,
}
