import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent } from 'storybook/test'
import { Button } from '../button/button'
import { NO_CHANGE_MESSAGE } from '../form/form-values'
import {
  type Notification,
  NotificationOutlet,
  NotificationProvider,
  useNotifications,
} from './notifications'

/** What a screen shows: the place of the notification, and the buttons that notify. */
const Content = (notification: Notification) => {
  const { notify } = useNotifications()

  return (
    <>
      <NotificationOutlet />
      <p>
        <Button onClick={() => notify(notification)}>予約を確定する</Button>{' '}
        <Button
          onClick={() =>
            notify({
              tone: 'info',
              message: {
                en: 'Updated the list of bookings.',
                ja: '予約の一覧を更新しました。',
              },
            })
          }
        >
          一覧を更新する
        </Button>
      </p>
    </>
  )
}

/**
 * A screen that notifies when its buttons are pressed, inside the frame of
 * an application, which provides the notification; `alone`, without it.
 */
const Screen = ({
  alone = false,
  ...notification
}: Notification & { alone?: boolean }) =>
  alone ? (
    <Content {...notification} />
  ) : (
    <NotificationProvider>
      <Content {...notification} />
    </NotificationProvider>
  )

const meta: Meta<typeof Screen> = {
  title: 'Components/Notifications',
  component: Screen,
  args: {
    tone: 'success',
    message: { en: 'Confirmed the booking.', ja: '予約を確定しました。' },
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
  args: {
    tone: 'info',
    message: {
      en: 'Your next booking is on Thu, December 3.',
      ja: '次回の予約は 12 月 3 日（木）です。',
    },
  },
  play: confirmTheBooking,
}

export const Warning: Story = {
  args: {
    tone: 'warning',
    message: {
      en: 'Confirmed the booking. Could not send the confirmation email.',
      ja: '予約を確定しました。確認のメールは送信できませんでした。',
    },
  },
  play: confirmTheBooking,
}

export const Danger: Story = {
  args: {
    tone: 'danger',
    message: {
      en: 'Could not confirm the booking.',
      ja: '予約を確定できませんでした。',
    },
  },
  play: confirmTheBooking,
}

/**
 * A message of the catalogues: the notification says it in the language
 * of the page, and anew when another one is chosen.
 */
export const NothingChanged: Story = {
  args: { tone: 'info', message: NO_CHANGE_MESSAGE },
  play: confirmTheBooking,
}

/**
 * A screen drawn without the frame of an application, as a test may draw
 * it: what it notifies is shown nowhere, and nothing fails.
 */
export const Alone: Story = {
  args: { alone: true },
  play: confirmTheBooking,
}
